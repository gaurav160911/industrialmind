"""
IndustrialMind — RAG query endpoint.

POST /query
  • Accepts a natural-language question.
  • Retrieves the top-k relevant chunks from ChromaDB.
  • Sends them as context to Claude claude-sonnet-4-6 and returns the answer.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from services.embedder import query_similar
from services.claude_client import rag_query

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/query", tags=["RAG Query"])


# ── Request / Response models ────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str = Field(..., min_length=3, description="Natural-language question")
    top_k: int = Field(default=5, ge=1, le=20, description="Number of context chunks to retrieve")
    max_tokens: int | None = Field(default=None, ge=64, le=8192, description="Override max response tokens")


class SourceInfo(BaseModel):
    source: str | None
    chunk_index: int | None
    distance: float | None


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceInfo]
    model: str


# ── Endpoint ─────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=QueryResponse,
    summary="Ask a question with RAG",
)
async def ask_question(body: QueryRequest):
    """
    Retrieve relevant document chunks and generate an answer via Claude.
    """
    # 1. Retrieve context
    try:
        chunks = query_similar(body.question, n_results=body.top_k)
    except Exception as exc:
        logger.exception("ChromaDB retrieval failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Vector retrieval error: {exc}",
        ) from exc

    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No relevant documents found. Please ingest documents first.",
        )

    # 2. Generate answer
    try:
        result = rag_query(
            body.question,
            chunks,
            max_tokens=body.max_tokens,
        )
    except RuntimeError as exc:
        # Typically missing API key
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Claude generation failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM generation error: {exc}",
        ) from exc

    return result
