"""
IndustrialMind — RAG query endpoint.

POST /query
  • Accepts a natural-language question.
  • When ?structured=true (default): returns rich JSON with timeline, status, etc.
  • When ?structured=false: returns plain answer + source citations.
"""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Any

from services.embedder import query_similar
from services.claude_client import rag_query, rag_query_structured

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
    content: str | None = None


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceInfo]
    model: str


class TimelineEntry(BaseModel):
    date: str
    id: str
    type: str
    description: str
    source: str
    severity: str | None = None
    status: str | None = None


class StructuredQueryResponse(BaseModel):
    structured: bool = True
    model: str
    overall_status: str
    risk_level: str
    total_incidents: int
    total_work_orders: int
    executive_summary: str
    equipment_tag: str | None = None
    timeline: list[TimelineEntry]
    recommendations: list[str]
    key_insights: list[str]
    sources: list[SourceInfo]
    response_time_ms: float | None = None


# ── Endpoint ─────────────────────────────────────────────────────────────

@router.post(
    "",
    summary="Ask a question with RAG",
)
async def ask_question(
    body: QueryRequest,
    structured: bool = Query(default=True, description="Return rich structured JSON response"),
) -> Any:
    """
    Retrieve relevant document chunks and generate an answer via the LLM.
    Set structured=true (default) for the rich UI response with timeline & insights.
    """
    t_start = time.monotonic()

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
        if structured:
            result = rag_query_structured(body.question, chunks, max_tokens=body.max_tokens)
        else:
            result = rag_query(body.question, chunks, max_tokens=body.max_tokens)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("LLM generation failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM generation error: {exc}",
        ) from exc

    elapsed_ms = round((time.monotonic() - t_start) * 1000, 1)

    if result.get("structured"):
        result["response_time_ms"] = elapsed_ms

    return result
