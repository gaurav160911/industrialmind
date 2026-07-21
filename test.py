from neo4j import GraphDatabase

uri = "neo4j+s://85a4fa41.databases.neo4j.io"
user = "85a4fa41"
password = "YOUR_PASSWORD"

try:
    driver = GraphDatabase.driver(uri, auth=(user, password))
    driver.verify_connectivity()
    print("✅ Connected")
except Exception as e:
    import traceback
    traceback.print_exc()