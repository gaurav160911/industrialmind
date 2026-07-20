"""
IndustrialMind — Root Cause Analysis (RCA) endpoint.

POST /rca/analyze
  • Fetches equipment node, failure events, incidents, and regulations
    from the Neo4j knowledge graph.
  • Computes a risk score and risk level.
  • Generates a 150-200 word RCA narrative via the Groq LLM.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from services.neo4j_client import run_cypher
from services.claude_client import ask_claude

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/rca", tags=["Root Cause Analysis"])


# ── Request / Response models ────────────────────────────────────────────

class RCARequest(BaseModel):
    equipment_tag: str = Field(
        ...,
        min_length=1,
        description="Equipment tag identifier (e.g. 'P-101A')",
    )


class RCAResponse(BaseModel):
    equipment_tag: str
    risk_score: int
    risk_level: str          # HIGH | MEDIUM | LOW
    failure_count: int
    incident_count: int
    narrative: str


# ── Cypher query ─────────────────────────────────────────────────────────

_CYPHER = """
MATCH (e:Equipment {tag: $tag})
OPTIONAL MATCH (e)-[:HAD_FAILURE]->(f:FailureEvent)
OPTIONAL MATCH (i:Incident)-[:INVOLVES]->(e)
OPTIONAL MATCH (e)-[:GOVERNED_BY]->(r:Regulation)
RETURN e,
       collect(DISTINCT f) AS failures,
       collect(DISTINCT i) AS incidents,
       collect(DISTINCT r) AS regs
"""


# ── Helpers ──────────────────────────────────────────────────────────────

def _node_to_str(node: Any) -> str:
    """Convert a Neo4j node / dict to a compact key=value string."""
    if node is None:
        return "N/A"
    props = dict(node) if not isinstance(node, dict) else node
    return "  ".join(f"{k}={v}" for k, v in props.items())


def _build_context(
    equipment: Any,
    failures: list[Any],
    incidents: list[Any],
    regs: list[Any],
) -> str:
    lines: list[str] = []

    lines.append("=== EQUIPMENT ===")
    lines.append(_node_to_str(equipment))

    lines.append("\n=== FAILURE EVENTS ===")
    if failures:
        for f in failures:
            lines.append(f"- {_node_to_str(f)}")
    else:
        lines.append("None recorded.")

    lines.append("\n=== INCIDENTS ===")
    if incidents:
        for i in incidents:
            lines.append(f"- {_node_to_str(i)}")
    else:
        lines.append("None recorded.")

    lines.append("\n=== GOVERNING REGULATIONS ===")
    if regs:
        for r in regs:
            lines.append(f"- {_node_to_str(r)}")
    else:
        lines.append("None recorded.")

    return "\n".join(lines)


def _compute_risk(failure_count: int, incident_count: int) -> tuple[int, str]:
    score = min(100, failure_count * 15 + incident_count * 25)
    if score >= 70:
        level = "HIGH"
    elif score >= 35:
        level = "MEDIUM"
    else:
        level = "LOW"
    return score, level


# ── Endpoint ─────────────────────────────────────────────────────────────

@router.post(
    "/analyze",
    response_model=RCAResponse,
    summary="Generate a Root Cause Analysis for a piece of equipment",
)
async def analyze_rca(body: RCARequest):
    """
    Pull graph data for the given equipment tag, compute risk metrics,
    and generate an LLM-powered RCA narrative.
    """
    # 1. Fetch graph data
    try:
        rows = run_cypher(_CYPHER, {"tag": body.equipment_tag})
    except Exception as exc:
        logger.exception("Neo4j query failed for tag=%s", body.equipment_tag)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Graph query error: {exc}",
        ) from exc

    # 2. Validate equipment exists
    if not rows or rows[0].get("e") is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Equipment tag '{body.equipment_tag}' not found in the knowledge graph.",
        )

    row = rows[0]
    equipment  = row["e"]
    failures   = row.get("failures") or []
    incidents  = row.get("incidents") or []
    regs       = row.get("regs") or []

    # 3. Risk scoring
    failure_count  = len(failures)
    incident_count = len(incidents)
    risk_score, risk_level = _compute_risk(failure_count, incident_count)

    # 4. Build context for LLM
    context = _build_context(equipment, failures, incidents, regs)

    system_prompt = (
        "You are an expert industrial reliability engineer writing RCA reports "
        "for a plant maintenance team."
    )
    user_prompt = (
        f"Using ONLY the data below, write a 150-200 word Root Cause Analysis report "
        f"for equipment tag {body.equipment_tag}.\n\n"
        f"Cover:\n"
        f"1. Failure pattern observed\n"
        f"2. Most likely root cause\n"
        f"3. Contributing factors\n"
        f"4. One specific corrective action\n\n"
        f"Cite equipment tags, work order numbers, and dates directly from the data. "
        f"Be concise and technical.\n\n"
        f"## DATA\n\n{context}"
    )

    # 5. Generate narrative
    try:
        narrative = ask_claude(user_prompt, system=system_prompt)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("LLM generation failed for tag=%s", body.equipment_tag)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM generation error: {exc}",
        ) from exc

    return RCAResponse(
        equipment_tag=body.equipment_tag,
        risk_score=risk_score,
        risk_level=risk_level,
        failure_count=failure_count,
        incident_count=incident_count,
        narrative=narrative,
    )
