# OpusIQ — Know Your Plant. Before It Fails.

<div align="center">

![OpusIQ Banner](https://img.shields.io/badge/OpusIQ-Industrial%20Intelligence-cyan?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green?style=for-the-badge&logo=fastapi)
![Neo4j](https://img.shields.io/badge/Neo4j-5.x-blue?style=for-the-badge&logo=neo4j)
![ChromaDB](https://img.shields.io/badge/ChromaDB-1.5.9-orange?style=for-the-badge)
![Groq](https://img.shields.io/badge/Groq-LLaMA3-purple?style=for-the-badge)

**AI-powered Industrial Knowledge Intelligence Platform**
Built for ET AI Hackathon 2026 — Problem Statement #8

🌐 **Live Demo:** [https://industrialmind-nu.vercel.app](https://industrialmind-nu.vercel.app)

</div>

---

## The Problem

A 2024 McKinsey survey found that professionals in asset-intensive industries spend **35% of their working hours** searching for information that already exists somewhere in the organisation.

In India, the average large plant operates across **7–12 disconnected document systems** — maintenance records in one place, inspection reports in another, SOPs in a third, regulatory submissions scattered across email archives.

Then there is the **knowledge cliff**: 25% of India's experienced industrial engineers will retire within the next decade, taking decades of undocumented operational knowledge with them. Once gone, it cannot be recovered.

**OpusIQ solves both.**

---

## What OpusIQ Does

| Module | Description |
|--------|-------------|
| 🔍 **RAG Query** | Natural-language Q&A over all ingested industrial documents with source citations |
| 🔬 **RCA Analyze** | AI-generated Root Cause Analysis from Neo4j knowledge graph data |
| ⚠️ **Overdue Tasks** | Live compliance dashboard — all OISD-overdue inspections in one view |
| 📄 **Gen CAR** | Auto-generate formal Corrective Action Reports for non-compliant equipment |
| 🕸️ **Knowledge Graph** | Interactive D3.js visualization of equipment-failure-regulation relationships |

---

## Real Use Case

> *Pump P-101A showing abnormal noise. Senior engineer Rajesh (28 years exp) retired yesterday.*

**Without OpusIQ:** New engineer spends 3+ hours searching SAP, emails, paper files. Makes wrong decision. Crude oil leak. ₹2 crore shutdown.

**With OpusIQ:** Type *"P-101A abnormal noise, what should I check?"* → 8 seconds → complete history, 3 prior bearing failures detected, Rajesh's notes preserved, OISD-117 compliance status, recommended action.

*"OpusIQ — Know Your Plant. Before It Fails."*

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   DATA SOURCES                       │
│  PDFs │ Work Orders │ Inspection Reports │ SOPs │    │
│  Incident RCAs │ OISD Standards │ Shift Logs        │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              INGESTION PIPELINE                      │
│  pdfplumber → LangChain Splitter → all-MiniLM-L6-v2 │
└──────────┬───────────────────────────┬──────────────┘
           │                           │
┌──────────▼──────────┐   ┌────────────▼──────────────┐
│   ChromaDB          │   │      Neo4j                 │
│   Vector Store      │   │   Knowledge Graph          │
│   (Semantic Search) │   │ (Equipment→Failure→Reg)    │
└──────────┬──────────┘   └────────────┬───────────────┘
           │                           │
┌──────────▼───────────────────────────▼───────────────┐
│                  FastAPI Backend                      │
│  RAG Agent │ RCA Agent │ Compliance │ CAR │ Graph    │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              Groq API — LLaMA-3.3-70B               │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│           React + Tailwind + D3.js Frontend          │
│  Dashboard │ RAG Query │ RCA │ Overdue │ Graph       │
└─────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React, Tailwind CSS, D3.js |
| **Backend** | FastAPI (Python) |
| **RAG Pipeline** | LangChain, ChromaDB, all-MiniLM-L6-v2 |
| **Knowledge Graph** | Neo4j 5.x Community |
| **LLM** | Groq API → LLaMA-3.3-70B-Versatile |
| **Deployment** | Vercel (Frontend), Docker (Backend) |
| **Dev Environment** | Google Antigravity |

---

## Quick Start

### Prerequisites
- Python 3.11
- Node.js 18+
- Docker Desktop

### Backend Setup

```bash
# Clone the repo
git clone https://github.com/yourusername/opusiq
cd opusiq/backend

# Create virtual environment
python -m venv venv311
venv311\Scripts\Activate.ps1  # Windows
source venv311/bin/activate    # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Setup environment
cp .env.example .env
# Add your keys in .env:
# GROQ_API_KEY=gsk_...
# NEO4J_URI=bolt://localhost:7687
# CHROMA_HOST=localhost

# Start databases
docker run -d --name industrialmind-neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/industrialmind \
  neo4j:5-community

docker run -d --name industrialmind-chromadb \
  -p 8000:8000 chromadb/chroma:1.5.9

# Seed Neo4j knowledge graph
python neo4j_seed.py

# Ingest documents into ChromaDB
python bulk_ingest.py

# Start API
python -m uvicorn main:app --reload --port 8080
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ingest/upload` | Upload & ingest document (PDF/CSV/JSON) |
| `POST` | `/query` | RAG query with source citations |
| `POST` | `/graph/query` | Execute Cypher query on Neo4j |
| `POST` | `/compliance/overdue` | Get overdue compliance items |
| `GET` | `/health` | API health check |

### Example Query

```bash
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the maintenance history of P-101A?",
    "top_k": 5
  }'
```

**Response:**
```json
{
  "answer": "P-101A (Crude Feed Pump A) has had 3 bearing failures in 24 months...",
  "sources": [
    {"source": "incident_reports.json", "chunk_index": 2},
    {"source": "work_orders.csv", "chunk_index": 1}
  ],
  "model": "llama-3.3-70b-versatile"
}
```

---

## Knowledge Graph Schema

```cypher
// Equipment connected to failures
(Equipment)-[:HAD_FAILURE]->(FailureEvent)

// Failures investigated by personnel
(FailureEvent)-[:INVESTIGATED_BY]->(Person)

// Equipment governed by regulations
(Equipment)-[:GOVERNED_BY]->(Regulation)

// Incidents involving equipment
(Incident)-[:INVOLVES]->(Equipment)

// Equipment compliance tasks
(Equipment)-[:HAS_COMPLIANCE]->(ComplianceTask)
```

**Demo Query — P-101A full history:**
```cypher
MATCH (e:Equipment {tag: "P-101A"})-[r]-(n)
RETURN e, r, n
```

---

## Demo Queries

Try these in the RAG Query interface:

1. *"What is the maintenance history of P-101A and what patterns do you see?"*
2. *"Which PSVs are overdue for testing and what is the regulatory requirement?"*
3. *"What caused the bearing failure on P-101A in May 2024?"*
4. *"What does SOP-MAINT-047 say about seal flush line verification?"*
5. *"Which equipment has Rajesh Kumar Sharma been involved in maintaining?"*

---

## Dataset

Synthetic industrial dataset for **Bharat Petrochemicals Ltd., Vadodara Unit-2**

| File | Records | Content |
|------|---------|---------|
| `equipment_master.json` | 12 | Equipment registry with OEM details |
| `work_orders.csv` | 20 | Maintenance work orders with failure modes |
| `incident_reports.json` | 5 | Full RCA reports with root causes |
| `inspection_reports.json` | 10 | Statutory inspection records |
| `compliance_schedule.csv` | 12 | OISD compliance tracking |
| `shift_handover_logs.csv` | 30 | Operational shift logs |
| `operating_procedures.json` | 2 | SOPs with safety precautions |

---

## Built For

**ET AI Hackathon 2026 — Problem Statement #8**
*AI for Industrial Knowledge Intelligence: Unified Asset & Operations Brain*

---

## Live Demo

🌐 **[https://industrialmind-nu.vercel.app](https://industrialmind-nu.vercel.app)**

---

<div align="center">
<strong>OpusIQ — Know Your Plant. Before It Fails.</strong>
</div>
