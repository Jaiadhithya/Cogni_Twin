# CogniTwin — AI Business Digital Twin Platform

CogniTwin is an intelligent Business Digital Twin platform designed for retail and enterprise decision intelligence. It unifies predictive machine learning, counterfactual simulation, causal explainability, and natural language analytics into a cohesive, high-performance architecture.

---

## Key Capabilities

- **Zero-Pollution Data Ingestion**: Automated CSV ingestion pipeline featuring structural schema detection, robust type coercion, missing-data handling, and entity mapping to normalized PostgreSQL warehouse tables.
- **Predictive Time-Series Forecasting**: Machine learning engine powered by Facebook Prophet with multiplicative seasonality, custom business regressors, and confidence bounds.
- **Causal & Feature Explainability**: Integrated TreeSHAP explainability engine to decompose sales drivers (pricing, marketing spend, discounts, and lead times).
- **Executive Observatory Dashboard**: Real-time KPI strips, revenue trajectory visualizer, and dynamic charts powered by Next.js and Visx.
- **Natural Language Business Analyst**: Text-to-SQL query generation and unstructured document intelligence using vector retrieval with Qdrant.
- **Simulation & What-If Sandbox**: Interactive counterfactual scenario testing for supply chain levers and pricing elasticity.

---

## Architecture Overview

`
+-------------------------------------------------------------+
|                      Next.js Frontend                       |
|        (Dashboard, Ingestion, Forecasting, NL Query)        |
+------------------------------+------------------------------+
                               |
                               v REST API
+-------------------------------------------------------------+
|                      FastAPI Backend                        |
|  +-------------------+  +----------------+  +-------------+ |
|  | Ingestion Service |  | Forecast & ML  |  | Query & RAG | |
|  +---------+---------+  +--------+-------+  +------+------+ |
+------------|---------------------|-----------------|--------+
             |                     |                 |
             v                     v                 v
     PostgreSQL Warehouse    Prophet / SHAP    Qdrant Vectors
`

---

## Project Structure

`
Cogni_Twin/
|-- backend/               # FastAPI backend service
|   |-- src/               # Clean architecture source (api, domain, infrastructure, services)
|   |-- alembic/           # PostgreSQL database migrations
|   |-- scripts/           # DB initialization, data seeding, and test runners
|   |-- tests/             # Unit and integration test suites
|-- frontend/              # Next.js 15+ modern web dashboard
|   |-- src/app/           # App router pages (dashboard, forecast, ingest, query)
|   |-- src/components/    # UI and charting components (Visx, Tailwind CSS)
|-- docs/                  # Architectural specs and phase documentation
|-- CogniTwin/             # Project presentation showcase
|-- docker-compose.yml     # Complete containerized multi-service orchestration
`

---

## Quickstart Guide

### Prerequisites

- Docker & Docker Compose
- Python 3.11+
- Node.js 18+ and npm

### 1. Environment Setup

Copy example environment files:

`ash
# In backend
cp backend/.env.example backend/.env

# In frontend
cp frontend/.env.local.example frontend/.env.local
`

Fill in your LLM API keys (e.g., GROQ_API_KEY or GEMINI_API_KEY) and database credentials in .env.

### 2. Running via Docker Compose

Launch the entire stack (PostgreSQL, Qdrant, FastAPI backend, Next.js frontend):

`ash
docker compose up --build
`

- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **FastAPI Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Qdrant Vector DB**: [http://localhost:6333/dashboard](http://localhost:6333/dashboard)

---

## Testing & Validation

Run the backend test suite:

`ash
cd backend
pytest tests/ -v
`

Run the frontend test suite:

`ash
cd frontend
npm test
`

---

## License

This project is licensed under the MIT License.
