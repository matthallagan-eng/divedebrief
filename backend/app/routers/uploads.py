import hashlib

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import delete, insert, select
from sqlalchemy.orm import Session

from ..analysis.stats import fingerprint, summarize
from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..models import Dive, DiveTank, Sample, Upload, User
from ..parsing.fit import parse_fit
from ..parsing.model import ParsedDive, ParseError
from ..parsing.uddf import parse_uddf
from ..schemas import UploadOut, UploadResult
from ..scoring.store import ensure_scores

router = APIRouter(prefix="/uploads", tags=["uploads"])

# Suffix -> (format name, parser)
PARSERS = {".uddf": ("UDDF", parse_uddf), ".xml": ("UDDF", parse_uddf), ".fit": ("FIT", parse_fit)}


def _fill(dive: Dive, d: ParsedDive, source: str) -> None:
    """Set a dive's summary, metadata and source from a parsed dive."""
    stats = summarize(d)
    dive.started_at = d.started_at
    dive.duration_s = stats.duration_s
    dive.max_depth_m = stats.max_depth_m
    dive.avg_depth_m = stats.avg_depth_m
    dive.min_temp_k = stats.min_temp_k
    dive.computer_model = d.computer_model
    dive.computer_serial = d.computer_serial
    dive.water_type = d.water_type
    dive.latitude = d.latitude
    dive.longitude = d.longitude
    dive.source = source


def _sampled_tank(dive: Dive, d: ParsedDive) -> None:
    """Tank pressures from the dive computer's transmitter, if it has one.
    A tank size the diver already entered is kept."""
    pressures = [s.tank_pressure_bar for s in d.samples if s.tank_pressure_bar is not None]
    if len(pressures) < 2 or pressures[-1] >= pressures[0]:
        return
    volume = dive.tank.volume_l if dive.tank else None
    dive.tank = DiveTank(volume_l=volume, start_bar=pressures[0], end_bar=pressures[-1], source="sampled")


def _store_samples(db: Session, dive_id: int, d: ParsedDive) -> None:
    db.execute(
        insert(Sample),
        [
            {
                "dive_id": dive_id,
                "t_s": s.t_s,
                "depth_m": s.depth_m,
                "temp_k": s.temp_k,
                "heart_rate": s.heart_rate,
                "tank_pressure_bar": s.tank_pressure_bar,
                "ndl_s": s.ndl_s,
            }
            for s in d.samples
        ],
    )


@router.post("", response_model=UploadResult)
async def upload_dives(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    filename = file.filename or "upload.uddf"
    suffix = next((s for s in PARSERS if filename.lower().endswith(s)), None)
    if suffix is None:
        raise HTTPException(400, "File must be a .fit file or a .uddf or .xml UDDF export")
    kind, parse = PARSERS[suffix]

    contents = await file.read(settings.max_upload_bytes + 1)
    if len(contents) > settings.max_upload_bytes:
        raise HTTPException(400, f"File too large (max {settings.max_upload_bytes // 2**20} MB)")

    try:
        parsed = parse(contents)
    except ParseError as e:
        raise HTTPException(400, f"Could not parse {kind}: {e}")

    source = kind.lower()
    prints = {id(d): fingerprint(d.started_at) for d in parsed.dives}
    existing = {
        dive.fingerprint: dive
        for dive in db.scalars(
            select(Dive).where(Dive.user_id == user.id, Dive.fingerprint.in_(prints.values()))
        )
    }

    new_dives: list[ParsedDive] = []
    upgraded: list[Dive] = []
    seen: set[str] = set()  # also skips a dive repeated within the same file
    for d in parsed.dives:
        fp = prints[id(d)]
        if fp in seen:
            continue
        seen.add(fp)
        stored_dive = existing.get(fp)
        if stored_dive is None:
            new_dives.append(d)
        elif source == "fit" and stored_dive.source != "fit":
            # Swap in the watch's own recording; the dive keeps its id and upload
            _fill(stored_dive, d, source)
            db.execute(delete(Sample).where(Sample.dive_id == stored_dive.id))
            _store_samples(db, stored_dive.id, d)
            _sampled_tank(stored_dive, d)
            stored_dive.scores = []  # recomputed below from the new samples
            upgraded.append(stored_dive)

    skipped = len(parsed.dives) - len(new_dives) - len(upgraded)
    if not new_dives:
        db.commit()
        ensure_scores(db, user.id, upgraded)
        return UploadResult(
            upload_id=None,
            filename=filename,
            added=0,
            updated=len(upgraded),
            skipped=skipped,
            warnings=parsed.warnings,
        )

    upload = Upload(
        user_id=user.id,
        filename=filename,
        sha256=hashlib.sha256(contents).hexdigest(),
        dives_added=len(new_dives),
        dives_skipped=skipped,
    )
    db.add(upload)

    stored: list[Dive] = []
    for d in new_dives:
        dive = Dive(upload=upload, user_id=user.id, fingerprint=prints[id(d)])
        _fill(dive, d, source)
        db.add(dive)
        stored.append(dive)
        db.flush()
        _store_samples(db, dive.id, d)
        _sampled_tank(dive, d)

    db.commit()
    ensure_scores(db, user.id, stored + upgraded)
    return UploadResult(
        upload_id=upload.id,
        filename=filename,
        added=len(new_dives),
        updated=len(upgraded),
        skipped=skipped,
        warnings=parsed.warnings,
    )


@router.get("", response_model=list[UploadOut])
def list_uploads(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(
        select(Upload).where(Upload.user_id == user.id).order_by(Upload.uploaded_at.desc())
    ).all()


@router.delete("/{upload_id}", status_code=204)
def delete_upload(
    upload_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    upload = db.scalar(select(Upload).where(Upload.id == upload_id, Upload.user_id == user.id))
    if upload is None:
        raise HTTPException(404, "Upload not found")
    db.delete(upload)
    db.commit()
