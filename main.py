"""
IndustrialMind — FastAPI application entry point.

Registers all routers, configures CORS, and manages service lifecycles.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from routes import ingest, query, graph, compliance, rca
from services.neo4j_client import close_driver
from services.embedder import _get_embeddings, _get_chroma_client
from services.claude_client import _get_client as _get_groq_client

# ── Logging ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan (startup / shutdown) ────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀  IndustrialMind starting up …")
    # Pre-warm embedding model and clients so first request is fast
    logger.info("⏳  Pre-warming embedding model (all-MiniLM-L6-v2) …")
    _get_embeddings()
    _get_chroma_client()
    try:
        _get_groq_client()
    except RuntimeError:
        logger.warning("GROQ_API_KEY not set — skipping Groq pre-warm")
    logger.info("✅  All services warmed up and ready")
    yield
    # Cleanup
    close_driver()
    logger.info("🛑  IndustrialMind shut down")


# ── App factory ──────────────────────────────────────────────────────────

settings = get_settings()

app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    description=(
        "IndustrialMind API — RAG-powered industrial knowledge assistant "
        "backed by ChromaDB (vector store), Neo4j (knowledge graph), "
        "and Claude claude-sonnet-4-6 (LLM)."
    ),
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────
app.include_router(ingest.router)
app.include_router(query.router)
app.include_router(graph.router)
app.include_router(compliance.router)
app.include_router(rca.router)


# ── Root health probe ───────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    return {
        "service": settings.APP_TITLE,
        "version": settings.APP_VERSION,
        "status": "running",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}
