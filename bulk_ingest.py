import io
import sys
import requests
from pathlib import Path

# Force UTF-8 output so Unicode arrows work on Windows cp1252 consoles
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BASE_URL = "http://localhost:8080"
SYNTHETIC_DIR = Path("synthetic_data")

FILES = [
    ("equipment/equipment_master.json", "equipment"),
    ("work_orders/work_orders.csv", "maintenance"),
    ("incidents/incident_reports.json", "incident"),
    ("compliance/compliance_schedule.csv", "compliance"),
    ("shift_logs/shift_handover_logs.csv", "operations"),
    ("procedures/operating_procedures.json", "SOP"),
]

for rel_path, doc_type in FILES:
    file_path = SYNTHETIC_DIR / rel_path
    if not file_path.exists():
        print(f"[SKIP] Not found: {file_path}")
        continue
    with open(file_path, "rb") as f:
        resp = requests.post(
            f"{BASE_URL}/ingest/upload",
            files={"file": (file_path.name, f)},
            data={"document_type": doc_type, "facility": "Bharat Petrochemicals Ltd"},
        )
    if resp.status_code == 201:
        r = resp.json()
        print(f"[OK] {file_path.name} -> {r.get('chunk_count')} chunks")
    else:
        print(f"[ERROR] {file_path.name} -> {resp.status_code}: {resp.text[:200]}")
