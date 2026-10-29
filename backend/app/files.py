"""Private files the diver uploads: card photos and dive photos.

They live under settings.upload_dir/<kind>/<user id>/, with random names that
the database rows hold, and are only ever served to their owner.
"""
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse

from .config import settings

# What a file starts with -> (media type, file suffix)
SIGNATURES: list[tuple[bytes, str, str]] = [
    (b"\xff\xd8\xff", "image/jpeg", ".jpg"),
    (b"\x89PNG\r\n\x1a\n", "image/png", ".png"),
    (b"%PDF", "application/pdf", ".pdf"),
]
MEDIA = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".pdf": "application/pdf"}
PHOTOS = ("image/jpeg", "image/png", "image/webp")


def sniff(contents: bytes) -> tuple[str, str] | None:
    """(media type, suffix) from the file's own bytes, not its name."""
    if contents[:4] == b"RIFF" and contents[8:12] == b"WEBP":
        return "image/webp", ".webp"
    for magic, media, suffix in SIGNATURES:
        if contents.startswith(magic):
            return media, suffix
    return None


def media(name: str | None) -> str | None:
    return MEDIA.get(Path(name).suffix) if name else None


def _folder(kind: str, user_id: int) -> Path:
    return Path(settings.upload_dir) / kind / str(user_id)


async def save(file: UploadFile, kind: str, user_id: int, allowed: tuple[str, ...], what: str) -> str:
    """Checks and stores an upload; returns its new name. what: e.g. "a JPEG, PNG or WebP photo"."""
    contents = await file.read(settings.max_upload_bytes + 1)
    if len(contents) > settings.max_upload_bytes:
        raise HTTPException(400, f"File too large (max {settings.max_upload_bytes // 2**20} MB)")
    found = sniff(contents)
    if found is None or found[0] not in allowed:
        raise HTTPException(400, f"Use {what}")
    folder = _folder(kind, user_id)
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{found[1]}"
    # Written whole, then renamed into place, so a failed upload leaves no half file
    partial = folder / f"{name}.part"
    partial.write_bytes(contents)
    partial.replace(folder / name)
    return name


def remove(kind: str, user_id: int, *names: str | None) -> None:
    for name in names:
        if name:
            (_folder(kind, user_id) / name).unlink(missing_ok=True)


def serve(kind: str, user_id: int, name: str | None, missing: str) -> FileResponse:
    path = _folder(kind, user_id) / name if name else None
    if path is None or not path.is_file():
        raise HTTPException(404, missing)
    # Private: never kept by shared caches
    return FileResponse(path, media_type=media(name), headers={"Cache-Control": "private, no-store"})
