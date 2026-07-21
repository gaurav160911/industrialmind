"""
IndustrialMind — Neo4j client service.

Thin wrapper around the official Neo4j Python driver for executing
arbitrary Cypher queries and managing the driver lifecycle.
"""

from __future__ import annotations

import logging
from typing import Any

from neo4j import GraphDatabase, Driver, Result
from neo4j.exceptions import SessionExpired

from config import get_settings

logger = logging.getLogger(__name__)

_driver: Driver | None = None


def _get_driver() -> Driver:
    """Return (and lazily create) the singleton Neo4j driver."""
    global _driver
    if _driver is None:
        s = get_settings()
        _driver = GraphDatabase.driver(
    s.NEO4J_URI,
    auth=(s.NEO4J_USER, s.NEO4J_PASSWORD),
    connection_timeout=30,
    keep_alive=True,
    max_connection_lifetime=60,
    max_connection_pool_size=10,
)
        # Verify connectivity eagerly so startup failures surface early
        _driver.verify_connectivity()
        logger.info("Connected to Neo4j at %s", s.NEO4J_URI)
    return _driver


def close_driver() -> None:
    """Shut down the Neo4j driver (call on app shutdown)."""
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None
        logger.info("Neo4j driver closed")


# ── Query helpers ────────────────────────────────────────────────────────

def run_cypher(
    query: str,
    parameters: dict[str, Any] | None = None,
    *,
    database: str | None = None,
) -> list[dict[str, Any]]:
    """
    Execute a Cypher query and return the result records as a list of dicts.

    Parameters
    ----------
    query : str
        A valid Cypher statement.
    parameters : dict, optional
        Query parameters (``$param`` style).
    database : str, optional
        Target database name. ``None`` uses the driver default.

    Returns
    -------
    list[dict]
        Each dict maps return-column names to their values.
    """
    from neo4j.exceptions import SessionExpired

driver = _get_driver()

try:
    with driver.session(database=database) as session:
        result: Result = session.run(query, parameters or {})
        records = [record.data() for record in result]
        summary = result.consume()

except SessionExpired:
    logger.warning("Neo4j session expired. Retrying once...")

    with driver.session(database=database) as session:
        result: Result = session.run(query, parameters or {})
        records = [record.data() for record in result]
        summary = result.consume()
    logger.debug(
        "Cypher executed in %d ms — %d record(s)",
        summary.result_available_after,
        len(records),
    )
    return records


def run_cypher_write(
    query: str,
    parameters: dict[str, Any] | None = None,
    *,
    database: str | None = None,
) -> dict[str, Any]:
    """
    Execute a *write* Cypher transaction and return counters.

    Returns
    -------
    dict
        Summary counters (nodes_created, relationships_created, etc.).
    """
    driver = _get_driver()

    with driver.session(database=database) as session:
        result: Result = session.run(query, parameters or {})
        summary = result.consume()

    counters = summary.counters.__dict__  # SummaryCounters → dict
    # Strip internal fields
    counters = {k: v for k, v in counters.items() if not k.startswith("_")}
    logger.debug("Write query counters: %s", counters)
    return counters


def health_check() -> dict[str, Any]:
    """Quick connectivity + version check."""
    rows = run_cypher("CALL dbms.components() YIELD name, versions, edition")
    if rows:
        return {"status": "healthy", **rows[0]}
    return {"status": "unknown"}
