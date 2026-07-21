"""
IndustrialMind — Groq LLM client (free tier, powered by LLaMA 3.3 70B)
"""
import json
import logging
import re
from groq import Groq
from config import get_settings

logger = logging.getLogger(__name__)

_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        s = get_settings()
        if not s.llm_api_key:
            raise RuntimeError(
                "No LLM API key is set. Configure GROQ_API_KEY (preferred) or ANTHROPIC_API_KEY "
                "with a Groq API key from https://console.groq.com."
            )
        _client = Groq(api_key=s.llm_api_key)
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


_STRUCTURED_SYSTEM = (
    "You are IndustrialMind, an expert AI for industrial operations, maintenance, and compliance. "
    "Always respond with ONLY a valid JSON object — no markdown fences, no prose outside the JSON."
)

_STRUCTURED_PROMPT_TEMPLATE = """\
Use ONLY the context below to answer the question.
Then emit a single JSON object with exactly this schema (all fields required):

{{
  "overall_status": "string — one of: Normal | Needs Attention | Critical",
  "risk_level": "string — one of: LOW | MEDIUM | HIGH | CRITICAL",
  "total_incidents": number,
  "total_work_orders": number,
  "executive_summary": "string — 2-4 sentence plain-text summary, no markdown",
  "equipment_tag": "string — equipment tag extracted from question/context, e.g. P-101A",
  "timeline": [
    {{
      "date": "string — e.g. Apr 30 2024 or — Pending",
      "id": "string — e.g. INC-2024-019",
      "type": "string — one of: NEAR MISS | MAINTENANCE | DEFERRED | INSPECTION | INCIDENT",
      "description": "string — one sentence description",
      "source": "string — source filename",
      "severity": "string or null — one of: High | Medium | Low | null",
      "status": "string or null — one of: Completed | Deferred | Open | null"
    }}
  ],
  "recommendations": ["string", "..."],
  "key_insights": ["string", "..."]
}}

Rules:
- timeline items must be sorted newest first (most recent date at top)
- Include all incidents AND work orders found in context as timeline entries
- recommendations: 3-6 specific, actionable bullet strings
- key_insights: 3-5 short analytical insight strings
- If information is unknown, use reasonable defaults

## Context

{context_block}

## Question

{question}
"""


def rag_query_structured(question: str, context_chunks: list[dict], *, max_tokens: int | None = None) -> dict:
    """
    RAG query that asks the LLM to return a rich structured JSON response.
    Falls back to plain rag_query() result if JSON parsing fails.
    """
    context_lines = []
    for i, chunk in enumerate(context_chunks, 1):
        source = chunk.get("metadata", {}).get("source", "unknown")
        context_lines.append(f"[Source {i}: {source}]\n{chunk['content']}")
    context_block = "\n\n---\n\n".join(context_lines)

    prompt = _STRUCTURED_PROMPT_TEMPLATE.format(
        context_block=context_block,
        question=question,
    )

    raw = ask_claude(
        prompt,
        system=_STRUCTURED_SYSTEM,
        max_tokens=max_tokens or 4096,
        temperature=0.2,
    )

    # Strip any accidental markdown fences
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip(), flags=re.MULTILINE)

    try:
        structured = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("Structured JSON parse failed — falling back to plain answer")
        plain = rag_query(question, context_chunks, max_tokens=max_tokens)
        plain["structured"] = False
        return plain

    # Attach raw sources for the Sources & Evidence panel
    sources = [
        {
            "source": c.get("metadata", {}).get("source"),
            "chunk_index": c.get("metadata", {}).get("chunk_index"),
            "distance": c.get("distance"),
            "content": c.get("content", ""),
        }
        for c in context_chunks
    ]

    s = get_settings()
    return {
        **structured,
        "sources": sources,
        "model": s.GROQ_MODEL,
        "structured": True,
    }