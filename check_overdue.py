from services.neo4j_client import run_cypher

print("=== Equipment with overdue ComplianceTasks ===")
rows = run_cypher("""
    MATCH (a:Equipment)-[:HAS_COMPLIANCE]->(t:ComplianceTask)
    WHERE t.overdue = true
    RETURN a.tag AS tag, a.name AS name, count(t) AS overdue_count
    ORDER BY overdue_count DESC
""")
if rows:
    for r in rows:
        print(f"  {r['tag']} | {r['name']} | overdue={r['overdue_count']}")
else:
    print("  None found with overdue=true")

print("\n=== All ComplianceTask overdue values for P-101A ===")
rows2 = run_cypher("""
    MATCH (a:Equipment {tag: 'P-101A'})-[:HAS_COMPLIANCE]->(t:ComplianceTask)
    RETURN t.task_id, t.overdue, t.status, t.due_date, t.days_overdue
""")
for r in rows2:
    print(" ", dict(r))
