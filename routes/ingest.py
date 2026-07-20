"""
IndustrialMind — Document upload / ingestion endpoint.

POST /ingest/upload
  • Accepts a file (PDF or TXT) via multipart form-data.
  • Optionally accepts extra metadata fields (document_type, facility, etc.).
  • Saves the file to disk, runs the embedder pipeline, and returns
    a JSON summary.
"""

from __future__ import annotations

import logging
import os
import shutil
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from config import get_settings
from services.embedder import ingest_document

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ingest", tags=["Ingestion"])


@router.post(
    "/upload",
    summary="Upload and ingest a document",
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    file: UploadFile = File(..., description="PDF or TXT document to ingest"),
    document_type: str = Form(default="general", description="e.g. SOP, manual, report"),
    facility: str = Form(default="", description="Facility or plant name"),
):
    """
    Upload a document, extract text, embed, and store in ChromaDB.
    """
    settings = get_settings()

    # ── Validate file type ───────────────────────────────────────────
    allowed = {".pdf", ".txt", ".json", ".csv"}
    suffix = Path(file.filename or "unknown").suffix.lower()
    if suffix not in allowed:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{suffix}'. Allowed: {sorted(allowed)}",
        )

    # ── Validate size (rough check via content-length header) ────────
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if file.size and file.size > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB} MB limit",
        )

    # ── Persist to disk ─────────────────────────────────────────────
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    dest = upload_dir / file.filename
    try:
        with dest.open("wb") as buf:
            shutil.copyfileobj(file.file, buf)
    except Exception as exc:
        logger.exception("Failed to save uploaded file")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save file: {exc}",
        ) from exc
    finally:
        await file.close()

    # ── Run ingestion pipeline ───────────────────────────────────────
    metadata = {"document_type": document_type}
    if facility:
        metadata["facility"] = facility

    try:
        result = ingest_document(dest, metadata=metadata)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Ingestion pipeline failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ingestion failed: {exc}",
        ) from exc

    return {
        "status": "ingested",
        **result,
    }
