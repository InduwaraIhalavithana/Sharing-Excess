import secrets
from pathlib import Path
from fastapi import HTTPException, UploadFile

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}
ALLOWED_MIMES      = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_SIZE_BYTES     = 5 * 1024 * 1024  # 5 MB


async def save_upload(file: UploadFile, prefix: str = "img") -> str:
    """Save an uploaded image, return the URL path (e.g. /uploads/abc123.jpg)."""
    if file.content_type not in ALLOWED_MIMES:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, GIF, WebP allowed.")

    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file extension.")

    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File too large. Max 5 MB.")

    filename = f"{prefix}_{secrets.token_hex(16)}.{ext}"
    dest = UPLOAD_DIR / filename
    dest.write_bytes(content)

    return f"/uploads/{filename}"
