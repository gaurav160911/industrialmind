"""
neo4j_seed.py — IndustrialMind knowledge-graph seed script.

Loads synthetic_data/* files and populates Neo4j with:
  Nodes   : Equipment, FailureEvent, Person, Regulation,
            Procedure, Incident, ComplianceTask
  Rels    : HAD_FAILURE, RAISED_BY, ASSIGNED_TO, GOVERNED_BY,
            INVOLVES, INVESTIGATED_BY, HAS_COMPLIANCE

Run with:  python neo4j_seed.py
"""

from __future__ import annotations

import csv
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from neo4j import GraphDatabase, Driver

# ── Connection — reads from .env automatically ────────────────────────────
load_dotenv(Path(__file__).parent / ".env")
NEO4J_URI  = os.getenv("NEO4J_URI",      "neo4j+ssc://85a4fa41.databases.neo4j.io")
NEO4J_USER = os.getenv("NEO4J_USER",     "85a4fa41")
NEO4J_PASS = os.getenv("NEO4J_PASSWORD", "YUzHnehdU9c9k1jszsKpmn_WBdCVDgy6qWpA1NtikMc")
NEO4J_AUTH = (NEO4J_USER, NEO4J_PASS)

# ── Data paths ────────────────────────────────────────────────────────────
DATA_ROOT = Path(__file__).parent / "synthetic_data"
EQUIPMENT_FILE    = DATA_ROOT / "equipment"  / "equipment_master.json"
WORK_ORDERS_FILE  = DATA_ROOT / "work_orders" / "work_orders.csv"
INCIDENTS_FILE    = DATA_ROOT / "incidents"   / "incident_reports.json"
PROCEDURES_FILE   = DATA_ROOT / "procedures"  / "operating_procedures.json"
COMPLIANCE_FILE   = DATA_ROOT / "compliance"  / "compliance_schedule.csv"

# ── Counter helpers ───────────────────────────────────────────────────────

class Counter:
    """Accumulates Neo4j summary counters across multiple queries."""

    def __init__(self):
        self.nodes_created = 0
        self.relationships_created = 0
        self.properties_set = 0

    def add(self, summary) -> None:
        c = summary.counters
        self.nodes_created         += c.nodes_created
        self.relationships_created += c.relationships_created
        self.properties_set        += c.properties_set

    def __str__(self) -> str:
        return (
            f"  Nodes created        : {self.nodes_created}\n"
            f"  Relationships created: {self.relationships_created}\n"
            f"  Properties set       : {self.properties_set}"
        )


def run(driver: Driver, query: str, params: dict | None = None, counter: Counter | None = None):
    """Execute a Cypher statement and optionally accumulate counters."""
    with driver.session() as session:
        result = session.run(query, params or {})
        summary = result.consume()
        if counter:
            counter.add(summary)
        return summary


# ── Data loaders ─────────────────────────────────────────────────────────

def load_json(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_csv(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


# ── Seeding functions ─────────────────────────────────────────────────────

def seed_equipment(driver: Driver, counter: Counter) -> None:
    print("\n[1/7] Seeding Equipment nodes …")
    records = load_json(EQUIPMENT_FILE)
    query = """
    UNWIND $rows AS r
    MERGE (e:Equipment {tag: r.tag})
    SET e.name          = r.name,
        e.type          = r.type,
        e.area          = r.area,
        e.oem           = r.oem,
        e.install_year  = toInteger(r.install_year),
        e.criticality   = r.criticality,
        e.condition_grade = r.condition_grade
    """
    run(driver, query, {"rows": records}, counter)
    print(f"    → {len(records)} equipment records processed")


def seed_persons_from_work_orders(driver: Driver, counter: Counter, rows: list[dict]) -> None:
    """
    Extract unique person IDs from work orders.
    We don't have a dedicated persons file, so we build minimal Person nodes
    from the IDs that appear in raised_by_id / assigned_to_id.
    Full names/roles can be enriched later; we assign placeholders here.
    """
    print("\n[2/7] Seeding Person nodes (from work orders) …")

    # Build a small lookup so we can give names to the seed IDs
    PERSON_LOOKUP = {
        "EMP-001": {"name": "Rajesh Sharma",    "role": "HSE Manager",          "dept": "HSE"},
        "EMP-002": {"name": "Priya Nair",        "role": "Operations Supervisor","dept": "Operations"},
        "EMP-003": {"name": "Anil Kumar",        "role": "Senior Technician",    "dept": "Maintenance"},
        "EMP-004": {"name": "Deepa Menon",       "role": "Instrument Engineer",  "dept": "Instrumentation"},
        "EMP-005": {"name": "Suresh Pillai",     "role": "Process Engineer",     "dept": "Process"},
        "EMP-006": {"name": "Kavitha Reddy",     "role": "Shift Supervisor",     "dept": "Operations"},
        "EMP-007": {"name": "Mohammed Farooq",   "role": "Pump Technician",      "dept": "Maintenance"},
        "EMP-008": {"name": "Ritu Singh",        "role": "Technician",           "dept": "Maintenance"},
        "EMP-009": {"name": "Venkat Rao",        "role": "Heat Exchanger Specialist","dept": "Maintenance"},
        "EMP-010": {"name": "Sunita Bose",       "role": "Instrument Technician","dept": "Instrumentation"},
        "EMP-011": {"name": "Abhijit Das",       "role": "Inspection Engineer",  "dept": "Inspection"},
        "EMP-012": {"name": "Girish Patil",      "role": "Rotating Equipment Engineer","dept": "Maintenance"},
    }

    ids_seen: set[str] = set()
    for row in rows:
        ids_seen.add(row["raised_by_id"])
        ids_seen.add(row["assigned_to_id"])

    person_records = [
        {"id": pid, **PERSON_LOOKUP.get(pid, {"name": pid, "role": "Unknown", "dept": "Unknown"})}
        for pid in ids_seen
    ]

    query = """
    UNWIND $rows AS r
    MERGE (p:Person {id: r.id})
    SET p.name = r.name,
        p.role = r.role,
        p.dept = r.dept
    """
    run(driver, query, {"rows": person_records}, counter)
    print(f"    → {len(person_records)} persons processed")


def seed_regulations(driver: Driver, counter: Counter, rows: list[dict]) -> None:
    print("\n[3/7] Seeding Regulation nodes …")
    refs = {r["oisd_reference"] for r in rows if r.get("oisd_reference")}
    reg_records = [{"standard": ref, "reference": ref} for ref in refs]

    query = """
    UNWIND $rows AS r
    MERGE (reg:Regulation {standard: r.standard})
    SET reg.reference = r.reference
    """
    run(driver, query, {"rows": reg_records}, counter)
    print(f"    → {len(reg_records)} regulations processed")


def seed_failure_events_and_rels(driver: Driver, counter: Counter, rows: list[dict]) -> None:
    print("\n[4/7] Seeding FailureEvent nodes + relationships …")

    # Nodes
    query_nodes = """
    UNWIND $rows AS r
    MERGE (f:FailureEvent {wo_number: r.wo_number})
    SET f.failure_mode = r.failure_mode,
        f.date         = r.raised_date,
        f.cost_inr     = toFloat(r.cost_inr),
        f.status       = r.status,
        f.priority     = r.priority
    """
    run(driver, query_nodes, {"rows": rows}, counter)

    # (Equipment)-[:HAD_FAILURE]->(FailureEvent)
    query_had = """
    UNWIND $rows AS r
    MATCH (e:Equipment {tag: r.equipment_tag})
    MATCH (f:FailureEvent {wo_number: r.wo_number})
    MERGE (e)-[:HAD_FAILURE]->(f)
    """
    run(driver, query_had, {"rows": rows}, counter)

    # (FailureEvent)-[:RAISED_BY]->(Person)
    query_raised = """
    UNWIND $rows AS r
    MATCH (f:FailureEvent {wo_number: r.wo_number})
    MATCH (p:Person {id: r.raised_by_id})
    MERGE (f)-[:RAISED_BY]->(p)
    """
    run(driver, query_raised, {"rows": rows}, counter)

    # (FailureEvent)-[:ASSIGNED_TO]->(Person)
    query_assigned = """
    UNWIND $rows AS r
    MATCH (f:FailureEvent {wo_number: r.wo_number})
    MATCH (p:Person {id: r.assigned_to_id})
    MERGE (f)-[:ASSIGNED_TO]->(p)
    """
    run(driver, query_assigned, {"rows": rows}, counter)

    # (Equipment)-[:GOVERNED_BY]->(Regulation)
    query_gov = """
    UNWIND $rows AS r
    MATCH (e:Equipment {tag: r.equipment_tag})
    MATCH (reg:Regulation {standard: r.oisd_reference})
    MERGE (e)-[:GOVERNED_BY]->(reg)
    """
    run(driver, query_gov, {"rows": rows}, counter)

    print(f"    → {len(rows)} work orders processed")


def seed_procedures(driver: Driver, counter: Counter) -> None:
    print("\n[5/7] Seeding Procedure nodes …")
    records = load_json(PROCEDURES_FILE)

    query = """
    UNWIND $rows AS r
    MERGE (proc:Procedure {doc_no: r.doc_no})
    SET proc.title    = r.title,
        proc.revision = r.revision
    """
    run(driver, query, {"rows": records}, counter)
    print(f"    → {len(records)} procedures processed")


def seed_incidents(driver: Driver, counter: Counter) -> None:
    print("\n[6/7] Seeding Incident nodes + relationships …")
    records = load_json(INCIDENTS_FILE)

    # Ensure person nodes exist for investigators (may not be in work orders)
    investigator_ids: set[str] = set()
    for rec in records:
        investigator_ids.update(rec.get("investigated_by", []))

    if investigator_ids:
        inv_records = [{"id": pid, "name": pid, "role": "Investigator", "dept": "HSE"}
                       for pid in investigator_ids]
        run(driver, """
            UNWIND $rows AS r
            MERGE (p:Person {id: r.id})
            ON CREATE SET p.name = r.name, p.role = r.role, p.dept = r.dept
        """, {"rows": inv_records}, counter)

    # Incident nodes
    query_nodes = """
    UNWIND $rows AS r
    MERGE (i:Incident {report_no: r.report_no})
    SET i.type     = r.incident_type,
        i.severity = r.severity,
        i.date     = r.date,
        i.location = r.location
    """
    run(driver, query_nodes, {"rows": records}, counter)

    # (Incident)-[:INVOLVES]->(Equipment)  — one row per equipment tag
    inv_equip_rows = [
        {"report_no": rec["report_no"], "equipment_tag": tag}
        for rec in records
        for tag in rec.get("equipment_involved", [])
    ]
    if inv_equip_rows:
        run(driver, """
            UNWIND $rows AS r
            MATCH (i:Incident {report_no: r.report_no})
            MATCH (e:Equipment {tag: r.equipment_tag})
            MERGE (i)-[:INVOLVES]->(e)
        """, {"rows": inv_equip_rows}, counter)

    # (Incident)-[:INVESTIGATED_BY]->(Person)
    inv_person_rows = [
        {"report_no": rec["report_no"], "person_id": pid}
        for rec in records
        for pid in rec.get("investigated_by", [])
    ]
    if inv_person_rows:
        run(driver, """
            UNWIND $rows AS r
            MATCH (i:Incident {report_no: r.report_no})
            MATCH (p:Person {id: r.person_id})
            MERGE (i)-[:INVESTIGATED_BY]->(p)
        """, {"rows": inv_person_rows}, counter)

    print(f"    → {len(records)} incidents processed")


def seed_compliance(driver: Driver, counter: Counter) -> None:
    print("\n[7/7] Seeding ComplianceTask nodes + HAS_COMPLIANCE relationships …")
    rows = load_csv(COMPLIANCE_FILE)

    # Build a unique key per row (tag + inspection_type)
    for row in rows:
        row["task_id"] = f"{row['equipment_tag']}::{row['inspection_type']}"
        row["overdue"] = row["overdue"].lower() == "true"
        row["days_overdue"] = int(row["days_overdue"]) if row["days_overdue"] else 0

    query_nodes = """
    UNWIND $rows AS r
    MERGE (ct:ComplianceTask {task_id: r.task_id})
    SET ct.inspection_type = r.inspection_type,
        ct.standard        = r.applicable_standard,
        ct.last_date       = r.last_inspection_date,
        ct.due_date        = r.next_inspection_due,
        ct.overdue         = r.overdue,
        ct.days_overdue    = toInteger(r.days_overdue),
        ct.status          = r.remarks
    """
    run(driver, query_nodes, {"rows": rows}, counter)

    query_rels = """
    UNWIND $rows AS r
    MATCH (e:Equipment {tag: r.equipment_tag})
    MATCH (ct:ComplianceTask {task_id: r.task_id})
    MERGE (e)-[:HAS_COMPLIANCE]->(ct)
    """
    run(driver, query_rels, {"rows": rows}, counter)

    print(f"    → {len(rows)} compliance tasks processed")


# ── Constraints / indexes ─────────────────────────────────────────────────

CONSTRAINTS = [
    "CREATE CONSTRAINT equipment_tag IF NOT EXISTS FOR (e:Equipment)       REQUIRE e.tag       IS UNIQUE",
    "CREATE CONSTRAINT wo_number     IF NOT EXISTS FOR (f:FailureEvent)    REQUIRE f.wo_number IS UNIQUE",
    "CREATE CONSTRAINT person_id     IF NOT EXISTS FOR (p:Person)          REQUIRE p.id        IS UNIQUE",
    "CREATE CONSTRAINT regulation_std IF NOT EXISTS FOR (r:Regulation)     REQUIRE r.standard  IS UNIQUE",
    "CREATE CONSTRAINT procedure_doc IF NOT EXISTS FOR (p:Procedure)       REQUIRE p.doc_no    IS UNIQUE",
    "CREATE CONSTRAINT incident_no   IF NOT EXISTS FOR (i:Incident)        REQUIRE i.report_no IS UNIQUE",
    "CREATE CONSTRAINT compliance_id IF NOT EXISTS FOR (ct:ComplianceTask) REQUIRE ct.task_id  IS UNIQUE",
]


def create_constraints(driver: Driver) -> None:
    print("\n[0/7] Creating uniqueness constraints …")
    with driver.session() as session:
        for cypher in CONSTRAINTS:
            session.run(cypher)
    print("    → Done")


# ── Entry point ───────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("  IndustrialMind — Neo4j Seed Script")
    print("=" * 60)
    print(f"  Connecting to {NEO4J_URI} …")

    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=NEO4J_AUTH)
        driver.verify_connectivity()
        print("  [OK] Connected\n")
    except Exception as exc:
        print(f"\n  [ERROR] Cannot connect to Neo4j: {exc}")
        print("    Make sure Neo4j is running and auth matches.")
        sys.exit(1)

    counter = Counter()

    try:
        create_constraints(driver)

        # Load work_orders once — shared by multiple seeders
        wo_rows = load_csv(WORK_ORDERS_FILE)

        seed_equipment(driver, counter)
        seed_persons_from_work_orders(driver, counter, wo_rows)
        seed_regulations(driver, counter, wo_rows)
        seed_failure_events_and_rels(driver, counter, wo_rows)
        seed_procedures(driver, counter)
        seed_incidents(driver, counter)
        seed_compliance(driver, counter)

    finally:
        driver.close()

    print("\n" + "=" * 60)
    print("  Seed complete! Summary:")
    print(counter)
    print("=" * 60)


if __name__ == "__main__":
    main()
