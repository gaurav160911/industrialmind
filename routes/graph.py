"""
IndustrialMind — Neo4j / Knowledge-graph query endpoint.

POST /graph/query   — execute a read-only Cypher query
POST /graph/write   — execute a write Cypher query
GET  /graph/health  — Neo4j connectivity check
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from services.neo4j_client import run_cypher, run_cypher_write, health_check

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/graph", tags=["Knowledge Graph"])


# ── Request / Response models ────────────────────────────────────────────

class CypherRequest(BaseModel):
    query: str = Field(..., min_length=5, description="Cypher statement to execute")
    parameters: dict[str, Any] | None = Field(default=None, description="Cypher query parameters")
    database: str | None = Field(default=None, description="Target Neo4j database name")


class CypherReadResponse(BaseModel):
    records: list[dict[str, Any]]
    count: int


class CypherWriteResponse(BaseModel):
    counters: dict[str, Any]


# ── Endpoints ────────────────────────────────────────────────────────────

@router.post(
    "/query",
    response_model=CypherReadResponse,
    summary="Execute a read Cypher query",
)
async def cypher_read(body: CypherRequest):
    """Run an arbitrary read-only Cypher query and return results."""
    try:
        records = run_cypher(
            body.query,
            body.parameters,
            database=body.database,
        )
    except Exception as exc:
        logger.exception("Neo4j read query failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Neo4j query error: {exc}",
        ) from exc

    return {"records": records, "count": len(records)}


@router.post(
    "/write",
    response_model=CypherWriteResponse,
    summary="Execute a write Cypher query",
)
async def cypher_write(body: CypherRequest):
    """Run a write Cypher transaction and return summary counters."""
    try:
        counters = run_cypher_write(
            body.query,
            body.parameters,
            database=body.database,
        )
    except Exception as exc:
        logger.exception("Neo4j write query failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Neo4j write error: {exc}",
        ) from exc

    return {"counters": counters}


@router.get(
    "/health",
    summary="Neo4j health check",
)
async def neo4j_health():
    """Return Neo4j server info and connectivity status."""
    try:
        info = health_check()
    except Exception as exc:
        logger.exception("Neo4j health check failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Neo4j unreachable: {exc}",
        ) from exc

    return info


# ── Equipment subgraph (D3 force-graph format) ───────────────────────────

_SUBGRAPH_CYPHER = """
MATCH (e:Equipment {tag: $tag})
OPTIONAL MATCH (e)-[r1:HAD_FAILURE]->(f:FailureEvent)
OPTIONAL MATCH (e)-[r2:GOVERNED_BY]->(reg:Regulation)
OPTIONAL MATCH (i:Incident)-[r3:INVOLVES]->(e)
OPTIONAL MATCH (e)-[r4:HAS_COMPLIANCE]->(c:ComplianceTask)
RETURN e,
       collect(DISTINCT f)   AS failures,
       collect(DISTINCT reg) AS regs,
       collect(DISTINCT i)   AS incidents,
       collect(DISTINCT c)   AS compliance
"""


def _node_id(node: dict, node_type: str) -> str | None:
    """Extract a stable unique ID for a node based on its type."""
    if node_type == "failure":
        return node.get("wo_number")
    if node_type == "regulation":
        return node.get("standard")
    if node_type == "incident":
        return node.get("report_no")
    if node_type == "compliance":
        return node.get("inspection_type")
    return None  # equipment handled separately


def _node_label(node: dict, node_type: str) -> str:
    """Return a human-readable label for a node."""
    if node_type == "failure":
        return node.get("failure_mode") or node.get("wo_number") or "FailureEvent"
    if node_type == "regulation":
        return node.get("standard") or node.get("reference") or "Regulation"
    if node_type == "incident":
        return node.get("description") or node.get("report_no") or "Incident"
    if node_type == "compliance":
        return node.get("inspection_type") or node.get("task_id") or "ComplianceTask"
    return "Unknown"


@router.get(
    "/subgraph",
    summary="Get equipment subgraph in D3 force-graph format",
)
async def get_subgraph(tag: str):
    """
    Return all nodes and relationships for an equipment tag as D3-compatible
    ``{ nodes, links }`` JSON suitable for force-directed graph rendering.
    """
    try:
        rows = run_cypher(_SUBGRAPH_CYPHER, {"tag": tag})
    except Exception as exc:
        logger.exception("Subgraph query failed for tag=%s", tag)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Graph query error: {exc}",
        ) from exc

    if not rows or rows[0].get("e") is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Equipment tag '{tag}' not found in the knowledge graph.",
        )

    row        = rows[0]
    equip      = dict(row["e"])
    failures   = [dict(n) for n in (row.get("failures")   or []) if n]
    regs       = [dict(n) for n in (row.get("regs")       or []) if n]
    incidents  = [dict(n) for n in (row.get("incidents")  or []) if n]
    compliance = [dict(n) for n in (row.get("compliance") or []) if n]

    equip_id = equip.get("tag", tag)
    nodes: list[dict] = [{"id": equip_id, "label": equip.get("name", equip_id), "type": "equipment", "props": equip}]
    links: list[dict] = []

    related: list[tuple[list[dict], str, str]] = [
        (failures,   "failure",    "HAD_FAILURE"),
        (regs,       "regulation", "GOVERNED_BY"),
        (incidents,  "incident",   "INVOLVES"),
        (compliance, "compliance", "HAS_COMPLIANCE"),
    ]

    seen_ids: set[str] = {equip_id}

    for group, node_type, rel_type in related:
        for node in group:
            nid = _node_id(node, node_type)
            if not nid:
                continue  # skip nodes with no usable id
            if nid not in seen_ids:
                nodes.append({
                    "id":    nid,
                    "label": _node_label(node, node_type),
                    "type":  node_type,
                    "props": node,
                })
                seen_ids.add(nid)

            # Incidents point TO equipment; all others point FROM equipment
            if node_type == "incident":
                links.append({"source": nid, "target": equip_id, "type": rel_type})
            else:
                links.append({"source": equip_id, "target": nid, "type": rel_type})

    return {"nodes": nodes, "links": links}
