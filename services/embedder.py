"""
IndustrialMind — Embedder service.
"""

from __future__ import annotations

import hashlib
import json
import csv
import logging
from pathlib import Path
from typing import Any

# pyrefly: ignore [missing-import]
import chromadb
# pyrefly: ignore [missing-import]
import pdfplumber
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from config import get_settings

logger = logging.getLogger(__name__)

_chroma_client: chromadb.HttpClient | None = None
_embeddings: HuggingFaceEmbeddings | None = None


def _get_chroma_client() -> chromadb.PersistentClient:
    global _chroma_client
    if _chroma_client is None:
        s = get_settings()
        # Use in-process PersistentClient — no separate service needed
        _chroma_client = chromadb.PersistentClient(path=s.CHROMA_PERSIST_PATH)
        logger.info("ChromaDB in-process client ready at %s", s.CHROMA_PERSIST_PATH)
    return _chroma_client


def _get_embeddings() -> HuggingFaceEmbeddings:
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name="all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
        )
        logger.info("Loaded embedding model all-MiniLM-L6-v2")
    return _embeddings


def extract_text_from_pdf(path: str | Path) -> str:
    pages: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
    full_text = "\n\n".join(pages)
    if not full_text.strip():
        raise ValueError(f"No extractable text found in {path}")
    return full_text


def extract_text_from_txt(path: str | Path) -> str:
    return Path(path).read_text(encoding="utf-8")


def extract_text_from_json(path: str | Path) -> str:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return json.dumps(data, indent=2)


def extract_text_from_csv(path: str | Path) -> str:
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(" | ".join(f"{k}: {v}" for k, v in row.items()))
    return "\n".join(rows)


EXTRACTORS: dict[str, Any] = {
    ".pdf": extract_text_from_pdf,
    ".txt": extract_text_from_txt,
    ".json": extract_text_from_json,
    ".csv": extract_text_from_csv,
}


def chunk_text(text: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(text)


def ingest_document(file_path: str | Path, metadata: dict | None = None) -> dict:
    file_path = Path(file_path)
    suffix = file_path.suffix.lower()

    extractor = EXTRACTORS.get(suffix)
    if extractor is None:
        raise ValueError(f"Unsupported file type: {suffix}. Supported: {list(EXTRACTORS.keys())}")

    text = extractor(file_path)
    chunks = chunk_text(text)
    doc_id = hashlib.sha256(text.encode()).hexdigest()[:16]

    base_meta = {"source": file_path.name, "document_id": doc_id}
    if metadata:
        base_meta.update(metadata)

    ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
    metadatas = [{**base_meta, "chunk_index": i} for i in range(len(chunks))]

    emb_model = _get_embeddings()
    embeddings = emb_model.embed_documents(chunks)

    settings = get_settings()
    client = _get_chroma_client()
    collection = client.get_or_create_collection(name=settings.CHROMA_COLLECTION)
    collection.upsert(ids=ids, documents=chunks, embeddings=embeddings, metadatas=metadatas)

    logger.info("Ingested %s (%d chunks) into '%s'", file_path.name, len(chunks), settings.CHROMA_COLLECTION)
    return {"document_id": doc_id, "filename": file_path.name, "chunk_count": len(chunks), "collection": settings.CHROMA_COLLECTION}


def query_similar(query: str, n_results: int = 5) -> list[dict]:
    settings = get_settings()
    client = _get_chroma_client()
    collection = client.get_or_create_collection(name=settings.CHROMA_COLLECTION)

    emb_model = _get_embeddings()
    query_embedding = emb_model.embed_query(query)

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )

    hits: list[dict] = []
    for doc, meta, dist in zip(results["documents"][0], results["metadatas"][0], results["distances"][0]):
        hits.append({"content": doc, "metadata": meta, "distance": dist})
    return hits