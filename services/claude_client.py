"""
IndustrialMind — Groq LLM client (free tier, powered by LLaMA 3.3 70B)
"""
import logging
from groq import Groq
from config import get_settings

logger = logging.getLogger(__name__)

_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        s = get_settings()
        if not s.GROQ_API_KEY:
            raise RuntimeError(
                "GROQ_API_KEY is not set. "
                "Get a free key at https://console.groq.com and add it to your .env file."
            )
        _client = Groq(api_key=s.GROQ_API_KEY)
        logger.info("Groq client initialised (model: %s)", s.GROQ_MODEL)
    return _client


def ask_claude(prompt: str, *, system: str | None = None, max_tokens: int | None = None, temperature: float = 0.3) -> str:
    """Send a prompt to Groq and return the text response."""
    client = _get_client()
    s = get_settings()

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    response = client.chat.completions.create(
        model=s.GROQ_MODEL,
        messages=messages,
        max_tokens=max_tokens or s.CLAUDE_MAX_TOKENS,
        temperature=temperature,
    )
    return response.choices[0].message.content


def rag_query(question: str, context_chunks: list[dict], *, max_tokens: int | None = None) -> dict:
    """RAG: build context from chunks and ask the LLM."""
    context_lines = []
    for i, chunk in enumerate(context_chunks, 1):
        source = chunk.get("metadata", {}).get("source", "unknown")
        context_lines.append(f"[Source {i}: {source}]\n{chunk['content']}")

    context_block = "\n\n---\n\n".join(context_lines)

    system = (
        "You are IndustrialMind, an expert AI for industrial operations, "
        "maintenance, and compliance. Answer precisely and cite sources."
    )
    prompt = (
        f"Use ONLY the context below to answer.\n\n"
        f"## Context\n\n{context_block}\n\n"
        f"## Question\n\n{question}"
    )

    answer = ask_claude(prompt, system=system, max_tokens=max_tokens)

    sources = [
        {
            "source": c.get("metadata", {}).get("source"),
            "chunk_index": c.get("metadata", {}).get("chunk_index"),
            "distance": c.get("distance"),
        }
        for c in context_chunks
    ]
    s = get_settings()
    return {"answer": answer, "sources": sources, "model": s.GROQ_MODEL}