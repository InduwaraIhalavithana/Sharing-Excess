import io
import secrets
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import settings

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}
ALLOWED_MIMES      = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_SIZE_BYTES     = 5 * 1024 * 1024  # 5 MB
MAX_DIMENSION      = 1600             # longest side after resizing, in pixels
MAX_PIXELS         = 40_000_000       # refuse "decompression bomb" images
Image.MAX_IMAGE_PIXELS = MAX_PIXELS

# Cloudinary — active only when all three env vars are set
_cloud_name = settings.cloudinary_cloud_name
_api_key    = settings.cloudinary_api_key
_api_secret = settings.cloudinary_api_secret
_USE_CLOUDINARY = False

if _cloud_name and _api_key and _api_secret:
    try:
        import cloudinary
        import cloudinary.uploader
        cloudinary.config(
            cloud_name=_cloud_name,
            api_key=_api_key,
            api_secret=_api_secret,
            secure=True,
        )
        _USE_CLOUDINARY = True
    except ImportError:
        pass  # cloudinary package not installed; fall back to local


def process_image(content: bytes) -> bytes:
    """Decode, fix orientation, shrink and re-encode as WebP.

    Re-encoding proves the file really is an image and drops EXIF metadata
    (phone photos carry the GPS position of the donor's home).
    """
    try:
        with Image.open(io.BytesIO(content)) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
            img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
            out = io.BytesIO()
            img.save(out, format="WEBP", quality=82, method=4)
            return out.getvalue()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError):
        raise HTTPException(400, "That file is not a valid image.") from None


async def save_upload(file: UploadFile, prefix: str = "img") -> str:
    """Validate and store an uploaded image. Returns a public URL."""
    if file.content_type not in ALLOWED_MIMES:
        raise HTTPException(400, "Invalid file type. Only JPEG, PNG, GIF, WebP allowed.")

    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Invalid file extension.")

    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(400, "File too large. Maximum size is 5 MB.")
    content = process_image(content)

    if _USE_CLOUDINARY:
        import cloudinary.uploader
        result = cloudinary.uploader.upload(
            io.BytesIO(content),
            folder="sharing_excess",
            public_id=f"{prefix}_{secrets.token_hex(8)}",
            resource_type="image",
            overwrite=False,
        )
        return result["secure_url"]

    # Local fallback
    filename = f"{prefix}_{secrets.token_hex(16)}.webp"
    (UPLOAD_DIR / filename).write_bytes(content)
    return f"/uploads/{filename}"


def delete_upload(url: str | None) -> None:
    """Remove a photo we stored locally (/uploads/<name>). Cloud-hosted photos are left to the cloud account."""
    if url and url.startswith("/uploads/"):
        (UPLOAD_DIR / url.rsplit("/", 1)[-1]).unlink(missing_ok=True)
