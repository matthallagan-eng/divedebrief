import hashlib

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from ..analysis.ascent import violation_segments
from ..analysis.stats import fingerprint, summarize
from ..config import settings
from ..database import get_db
from ..models import Dive, Sample, Upload
from ..parsing.uddf import UDDFParseError, parse_uddf
from ..schemas import UploadOut, UploadResult

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_SUFFIXES = (".uddf", ".xml")


@router.post("", response_model=UploadResult)
async def upload_uddf(file: UploadFile = File(...), db: Session = Depends(get_db)):
    filename = file.filename or "upload.uddf"
    if not filename.lower().endswith(ALLOWED_SUFFIXES):
        raise HTTPException(400, "File must be a .uddf or .xml UDDF export")

    contents = await file.read(settings.max_upload_bytes + 1)
    if len(contents) > settings.max_upload_bytes:
        raise HTTPException(400, f"File too large (max {settings.max_upload_bytes // 2**20} MB)")

    try:
        parsed = parse_uddf(contents)
    except UDDFParseError as e:
        raise HTTPException(400, f"Could not parse UDDF: {e}")

    prints = {id(d): fingerprint(d) for d in parsed.dives}
    existing = set(
        db.scalars(select(Dive.fingerprint).where(Dive.fingerprint.in_(prints.values())))
    )

    new_dives = []
    for d in parsed.dives:
        fp = prints[id(d)]
        if fp in existing:
            continue
        existing.add(fp)  # also skips a dive repeated within the same file
        new_dives.append(d)

    skipped = len(parsed.dives) - len(new_dives)
    if not new_dives:
        return UploadResult(
            upload_id=None, filename=filename, added=0, skipped=skipped, warnings=parsed.warnings
        )

    upload = Upload(
        filename=filename,
        sha256=hashlib.sha256(contents).hexdigest(),
        dives_added=len(new_dives),
        dives_skipped=skipped,
    )
    db.add(upload)

    for d in new_dives:
        stats = summarize(d)
        segments = violation_segments(
            [s.t_s for s in d.samples],
            [s.depth_m for s in d.samples],
            settings.default_ascent_limit_m_per_min,
        )
        dive = Dive(
            upload=upload,
            fingerprint=prints[id(d)],
            started_at=d.started_at,
            duration_s=stats.duration_s,
            max_depth_m=stats.max_depth_m,
            avg_depth_m=stats.avg_depth_m,
            min_temp_k=stats.min_temp_k,
            computer_model=d.computer_model,
            computer_serial=d.computer_serial,
            ascent_violations=len(segments),
        )
        db.add(dive)
        db.flush()
        db.execute(
            insert(Sample),
            [
                {"dive_id": dive.id, "t_s": s.t_s, "depth_m": s.depth_m, "temp_k": s.temp_k}
                for s in d.samples
            ],
        )

    db.commit()
    return UploadResult(
        upload_id=upload.id,
        filename=filename,
        added=len(new_dives),
        skipped=skipped,
        warnings=parsed.warnings,
    )


@router.get("", response_model=list[UploadOut])
def list_uploads(db: Session = Depends(get_db)):
    return db.scalars(select(Upload).order_by(Upload.uploaded_at.desc())).all()


@router.delete("/{upload_id}", status_code=204)
def delete_upload(upload_id: int, db: Session = Depends(get_db)):
    upload = db.get(Upload, upload_id)
    if upload is None:
        raise HTTPException(404, "Upload not found")
    db.delete(upload)
    db.commit()
