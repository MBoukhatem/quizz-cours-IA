"""Upload, list and delete course documents."""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime

from fastapi import APIRouter, File, HTTPException, UploadFile

from config import get_settings
from models import database as db
from models.schemas import DocumentInfo, DocumentList, UploadResponse
from services.document_processor import process_file
from services.logger import get_audit_logger
from services.vectorstore import get_vectorstore

router = APIRouter()
logger = logging.getLogger("tuteur_quiz.upload")

ALLOWED_EXT = {".pdf", ".md", ".markdown", ".txt"}


@router.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)) -> UploadResponse:
    settings = get_settings()
    filename = file.filename or "unknown"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail=f"Format non supporté: {ext}. Acceptés: {', '.join(sorted(ALLOWED_EXT))}",
        )

    document_id = f"doc_{uuid.uuid4().hex[:12]}"
    os.makedirs(settings.upload_dir, exist_ok=True)
    safe_name = f"{document_id}_{os.path.basename(filename)}"
    dest_path = os.path.join(settings.upload_dir, safe_name)

    content = await file.read()
    with open(dest_path, "wb") as fh:
        fh.write(content)

    try:
        chunks = process_file(dest_path)
        if not chunks:
            raise HTTPException(status_code=422, detail="Aucun texte extractible du fichier.")
        # Override source metadata to the original filename for nicer citations.
        for c in chunks:
            c.source = filename
        n_indexed = get_vectorstore().index_chunks(document_id, chunks)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Indexing failed for %s", filename)
        raise HTTPException(status_code=500, detail=f"Erreur d'indexation: {exc}") from exc

    db.save_document(document_id, filename, n_indexed)
    get_audit_logger().info(
        event_type="document_uploaded",
        extra_data={
            "document_id": document_id,
            "filename": filename,
            "n_chunks": n_indexed,
            "size_bytes": len(content),
        },
    )
    return UploadResponse(
        document_id=document_id,
        filename=filename,
        n_chunks=n_indexed,
        status="indexed",
        message=f"{n_indexed} chunks indexés.",
    )


@router.get("/documents", response_model=DocumentList)
async def list_documents_endpoint() -> DocumentList:
    rows = db.list_documents()
    docs = [
        DocumentInfo(
            document_id=r["document_id"],
            filename=r["filename"],
            n_chunks=r["n_chunks"],
            uploaded_at=datetime.fromisoformat(r["uploaded_at"]),
        )
        for r in rows
    ]
    return DocumentList(documents=docs, total=len(docs))


@router.delete("/documents/{document_id}")
async def delete_document_endpoint(document_id: str) -> dict:
    deleted_chunks = get_vectorstore().delete_document(document_id)
    deleted = db.delete_document(document_id)
    if not deleted and deleted_chunks == 0:
        raise HTTPException(status_code=404, detail=f"Document non trouvé: {document_id}")
    get_audit_logger().info(
        event_type="document_deleted",
        extra_data={"document_id": document_id, "chunks_removed": deleted_chunks},
    )
    return {"document_id": document_id, "deleted": True, "chunks_removed": deleted_chunks}
