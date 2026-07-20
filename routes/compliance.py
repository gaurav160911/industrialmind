"""
IndustrialMind — Compliance endpoints.

POST /compliance/overdue
  • Queries Neo4j for maintenance tasks, inspections, or calibrations
    whose due-date has passed without completion.
  • Optionally filters by facility, asset type, or severity.
  • Returns a JSON list of overdue items with days-overdue calculated.

POST /compliance/generate-car
  • Pulls overdue tasks and failure/incident/regulation graph data for
    a given equipment tag.
  • Uses the LLM to generate a formal Corrective Action Report (CAR).

The endpoint assumes a graph schema like:

    (:Asset)-[:HAS_TASK]->(:MaintenanceTask {
        title, due_date, status, severity, facility
    })
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from services.neo4j_client import run_cypher
from services.claude_client import ask_claude

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/compliance", tags=["Compliance"])


# ── Request / Response models ────────────────────────────────────────────

class OverdueRequest(BaseModel):
    facility: str | None = Field(default=None, description="Filter by facility name")
    asset_type: str | None = Field(default=None, description="Filter by asset type label")
    severity: str | None = Field(default=None, description="Filter by severity (critical, high, medium, low)")
    as_of: date | None = Field(default=None, description="Reference date (default: today)")


class OverdueItem(BaseModel):
    task_id: str | None = None
    title: str | None = None
    asset_name: str | None = None
    facility: str | None = None
    severity: str | None = None
    due_date: str | None = None
    days_overdue: int | None = None
    status: str | None = None


class OverdueResponse(BaseModel):
    overdue_count: int
    as_of: str
    items: list[OverdueItem]


# ── Endpoint ─────────────────────────────────────────────────────────────

@router.post(
    "/overdue",
    response_model=OverdueResponse,
    summary="Check for overdue maintenance / compliance items",
)
async def check_overdue(body: OverdueRequest | None = None):
    """
    Query the knowledge graph for tasks whose ``due_date`` is before
    the reference date and whose ``status`` is not 'completed'.
    """
    body = body or OverdueRequest()
    ref_date = body.as_of or date.today()
    ref_str = ref_date.isoformat()

    # Build dynamic WHERE clauses
    conditions = [
        "t.due_date < $ref_date",
        "t.status <> 'completed'",
        "t.overdue = true",
    ]
    params: dict[str, Any] = {"ref_date": ref_str}

    if body.facility:
        conditions.append("t.facility = $facility")
        params["facility"] = body.facility
    if body.severity:
        conditions.append("t.severity = $severity")
        params["severity"] = body.severity.lower()
    if body.asset_type:
        conditions.append("labels(a) CONTAINS $asset_type")
        params["asset_type"] = body.asset_type

    where_clause = " AND ".join(conditions)

    cypher = f"""
        MATCH (a)-[:HAS_COMPLIANCE]->(t:ComplianceTask)
        WHERE {where_clause}
        RETURN
            t.task_id      AS task_id,
            t.inspection_type AS title,
            a.name         AS asset_name,
            a.area         AS facility,
            t.standard     AS severity,
            t.due_date     AS due_date,
            t.status       AS status,
            t.days_overdue AS days_overdue
        ORDER BY days_overdue DESC
    """

    try:
        records = run_cypher(cypher, params)
    except Exception as exc:
        logger.exception("Overdue compliance query failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Graph query error: {exc}",
        ) from exc

    return OverdueResponse(
        overdue_count=len(records),
        as_of=ref_str,
        items=[OverdueItem(**r) for r in records],
    )


# ── Corrective Action Report (CAR) ───────────────────────────────────────

_CAR_OVERDUE_CYPHER = """
    MATCH (a:Equipment {tag: $tag})-[:HAS_COMPLIANCE]->(t:ComplianceTask)
    WHERE t.overdue = true
    RETURN
        t.task_id        AS task_id,
        t.inspection_type AS title,
        a.name           AS asset_name,
        a.area           AS facility,
        t.standard       AS severity,
        t.due_date       AS due_date,
        t.status         AS status,
        t.days_overdue   AS days_overdue
    ORDER BY days_overdue DESC
"""

_CAR_GRAPH_CYPHER = """
    MATCH (e:Equipment {tag: $tag})
    OPTIONAL MATCH (e)-[:HAD_FAILURE]->(f:FailureEvent)
    OPTIONAL MATCH (i:Incident)-[:INVOLVES]->(e)
    OPTIONAL MATCH (e)-[:GOVERNED_BY]->(r:Regulation)
    RETURN e,
           collect(DISTINCT f) AS failures,
           collect(DISTINCT i) AS incidents,
           collect(DISTINCT r) AS regs
"""


class CARRequest(BaseModel):
    equipment_tag: str = Field(
        ...,
        min_length=1,
        description="Equipment tag identifier (e.g. 'P-101A')",
    )


class CARResponse(BaseModel):
    equipment_tag: str
    car_document: str


def _fmt_node(node: Any) -> str:
    """Convert a Neo4j node / dict to a compact key=value string."""
    if node is None:
        return "N/A"
    props = dict(node) if not isinstance(node, dict) else node
    return "  ".join(f"{k}={v}" for k, v in props.items())


@router.post(
    "/generate-car",
    response_model=CARResponse,
    summary="Generate a Corrective Action Report for an equipment tag",
)
async def generate_car(body: CARRequest):
    """
    Pull overdue compliance tasks and failure/incident/regulation graph
    data for the given equipment tag, then generate a formal Corrective
    Action Report via the LLM.
    """
    today_str = date.today().isoformat()

    # 1. Overdue compliance tasks
    try:
        overdue = run_cypher(
            _CAR_OVERDUE_CYPHER,
            {"tag": body.equipment_tag, "today": today_str},
        )
    except Exception as exc:
        logger.exception("CAR overdue query failed for tag=%s", body.equipment_tag)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Graph query error: {exc}",
        ) from exc

    if not overdue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"No overdue compliance items found for equipment tag "
                f"'{body.equipment_tag}'. A CAR is not required at this time."
            ),
        )

    # 2. Failure / incident / regulation data
    try:
        graph_rows = run_cypher(_CAR_GRAPH_CYPHER, {"tag": body.equipment_tag})
    except Exception as exc:
        logger.exception("CAR graph query failed for tag=%s", body.equipment_tag)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Graph query error: {exc}",
        ) from exc

    graph_row   = graph_rows[0] if graph_rows else {}
    equipment   = graph_row.get("e")
    failures    = graph_row.get("failures") or []
    incidents   = graph_row.get("incidents") or []
    regs        = graph_row.get("regs") or []

    # 3. Build context string
    overdue_lines = "\n".join(
        f"  - [{r.get('severity','?').upper()}] {r.get('title','?')} "
        f"| due {r.get('due_date','?')} | {r.get('days_overdue','?')} days overdue "
        f"| task_id={r.get('task_id','?')}"
        for r in overdue
    )
    failure_lines = "\n".join(f"  - {_fmt_node(f)}" for f in failures) or "  None recorded."
    incident_lines = "\n".join(f"  - {_fmt_node(i)}" for i in incidents) or "  None recorded."
    reg_lines = "\n".join(f"  - {_fmt_node(r)}" for r in regs) or "  None recorded."
    equip_str = _fmt_node(equipment) if equipment else body.equipment_tag

    context = (
        f"EQUIPMENT: {equip_str}\n\n"
        f"OVERDUE COMPLIANCE TASKS:\n{overdue_lines}\n\n"
        f"FAILURE EVENTS:\n{failure_lines}\n\n"
        f"INCIDENTS:\n{incident_lines}\n\n"
        f"GOVERNING REGULATIONS:\n{reg_lines}"
    )

    system_prompt = (
        "You are a compliance officer and reliability engineer generating "
        "formal Corrective Action Reports (CAR) for industrial plant operations. "
        "Write in a professional, structured format suitable for regulatory review."
    )
    user_prompt = (
        f"Generate a formal Corrective Action Report (CAR) for equipment tag "
        f"{body.equipment_tag} using ONLY the data provided below.\n\n"
        f"Structure the report with these sections:\n"
        f"1. Non-Conformance Description — what tasks are overdue and by how long\n"
        f"2. Regulatory References — cite the specific regulations and standards\n"
        f"3. Required Corrective Actions — concrete steps with realistic deadlines\n"
        f"4. Responsible Parties — roles accountable for each action\n\n"
        f"Cite task IDs, equipment tags, work order numbers, and dates directly "
        f"from the data. Be concise and formal.\n\n"
        f"## DATA\n\n{context}"
    )

    # 4. Generate CAR document
    try:
        car_document = ask_claude(user_prompt, system=system_prompt)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("LLM CAR generation failed for tag=%s", body.equipment_tag)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM generation error: {exc}",
        ) from exc

    return CARResponse(
        equipment_tag=body.equipment_tag,
        car_document=car_document,
    )
