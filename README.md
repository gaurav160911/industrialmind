# 🏭 IndustrialMind

> **RAG-powered industrial operations knowledge assistant** — built for the hackathon.

IndustrialMind combines a **vector store**, **knowledge graph**, and **LLM** to help industrial teams query maintenance documents, run root cause analyses, track compliance tasks, and visualize equipment relationships — all through a sleek React dashboard.

---

## 🧠 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend (Vite)                 │
│  Dashboard · RAG Query · RCA · Compliance · Graph · Ingest│
└────────────────────┬────────────────────────────────────┘
                     │ HTTP (Vite proxy → :8001)
┌────────────────────▼────────────────────────────────────┐
│              FastAPI Backend  (:8001)                    │
│   /ingest · /query · /graph · /compliance · /rca        │
└──────┬──────────────────┬──────────────────┬────────────┘
       │                  │                  │
┌──────▼──────┐  ┌────────▼───────┐  ┌──────▼──────┐
│  ChromaDB   │  │     Neo4j      │  │   Groq LLM  │
│ Vector Store│  │ Knowledge Graph│  │ LLaMA-3.3-70B│
│   (:8000)   │  │   (:7687)      │  │   (cloud)   │
└─────────────┘  └────────────────┘  └─────────────┘
```

## ✨ Features

| Module | Description |
|---|---|
| **RAG Query** | Natural-language Q&A over ingested industrial documents with source citations |
| **RCA Analyze** | AI root cause analysis with risk scoring for any equipment tag |
| **Overdue Tasks** | Live view of all compliance tasks past their due date |
| **Gen CAR** | Generate formal Corrective Action Reports for non-compliant equipment |
| **Knowledge Graph** | Interactive D3 force graph of equipment relationships and failures |
| **Ingest** | Upload and embed industrial documents into the ChromaDB vector store |

## 🛠 Tech Stack

- **Backend**: FastAPI · Python 3.11 · Uvicorn
- **LLM**: Groq API (LLaMA-3.3-70b-versatile)
- **Vector Store**: ChromaDB
- **Knowledge Graph**: Neo4j 5 Community
- **Frontend**: React 19 · Vite 8 · D3.js · React Router
- **Containerization**: Docker · Docker Compose

---

## 🚀 Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Python 3.11+](https://www.python.org/)
- [Node.js 18+](https://nodejs.org/)
- A free [Groq API key](https://console.groq.com) (no credit card needed)

### 1. Clone the repo

```bash
git clone https://github.com/<your-username>/industrialmind.git
cd industrialmind
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
```

### 3. Start databases (Docker)

```bash
docker compose up neo4j chromadb -d
```

Wait ~15 seconds for Neo4j to become healthy.

### 4. Start the backend

```bash
# Create and activate virtual environment
python -m venv venv311
.\venv311\Scripts\activate      # Windows
# source venv311/bin/activate   # macOS/Linux

pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8001
```

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** 🎉

### 6. Seed the knowledge graph (optional)

```bash
python neo4j_seed.py
```

### 7. Ingest sample documents (optional)

```bash
python bulk_ingest.py
```

---

## 📁 Project Structure

```
industrialmind/
├── main.py                 # FastAPI app entry point
├── config.py               # Settings (pydantic-settings)
├── requirements.txt
├── docker-compose.yml      # Neo4j + ChromaDB services
├── Dockerfile              # Backend container
├── .env.example            # Environment template
│
├── routes/                 # API route handlers
│   ├── ingest.py           # Document upload & embedding
│   ├── query.py            # RAG query endpoint
│   ├── graph.py            # Neo4j subgraph endpoint
│   ├── compliance.py       # CAR generation & overdue tasks
│   └── rca.py              # Root cause analysis
│
├── services/               # Business logic / clients
│   ├── neo4j_client.py
│   ├── embedder.py
│   └── claude_client.py    # LLM client (Groq)
│
├── synthetic_data/         # Sample industrial data
│   ├── equipment/
│   ├── incidents/
│   ├── work_orders/
│   └── procedures/
│
├── frontend/               # React + Vite SPA
│   ├── src/
│   │   ├── App.jsx
│   │   ├── ThemeContext.jsx
│   │   ├── api.js
│   │   └── pages/
│   │       ├── Dashboard.jsx
│   │       ├── RAGQuery.jsx
│   │       ├── RCAAnalysis.jsx
│   │       ├── OverdueTasks.jsx
│   │       ├── ComplianceCAR.jsx
│   │       ├── KnowledgeGraph.jsx
│   │       └── Ingest.jsx
│   ├── package.json
│   └── vite.config.js
│
├── neo4j_seed.py           # Seed Neo4j with sample data
└── bulk_ingest.py          # Bulk-embed documents into ChromaDB
```

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ | Your Groq API key |
| `NEO4J_URI` | ❌ | Neo4j Bolt URI (default: `bolt://localhost:7687`) |
| `NEO4J_USER` | ❌ | Neo4j username (default: `neo4j`) |
| `NEO4J_PASSWORD` | ❌ | Neo4j password (default: `industrialmind`) |
| `CHROMA_HOST` | ❌ | ChromaDB host (default: `localhost`) |
| `CHROMA_PORT` | ❌ | ChromaDB port (default: `8000`) |

---

## 📄 License

MIT
