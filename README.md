# CogniTwin — AI Business Digital Twin

[![CI](https://github.com/Jaiadhithya/Cogni_Twin/actions/workflows/backend.yml/badge.svg)](https://github.com/Jaiadhithya/Cogni_Twin/actions/workflows/backend.yml)
[![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.13x-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Qdrant](https://img.shields.io/badge/Qdrant-Vector_DB-DC2626?style=flat&logo=qdrant&logoColor=white)](https://qdrant.tech/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

CogniTwin builds a "digital twin" of a small business from its sales data. Upload a CSV and it shows what is happening (dashboard), what is coming (revenue forecast with prediction intervals), and what would happen if you changed something (what-if simulation on price, discount, marketing spend and other levers). You can also ask questions in plain English and search your own PDF documents.

---

## Screenshots

**Landing page**

![Landing page](assets/screenshots/landing_page.png)

**Dashboard** — revenue, orders, growth and trends for the selected dataset

![Dashboard](assets/screenshots/dashboard_overview.png)

**Forecast & What-If** — forecast with 80%/95% ranges; move a lever to see revenue, profit and price respond

![Forecast and what-if](assets/screenshots/forecast_what_if.png)

**Ask AI** — plain-English questions answered with a chart, insights and recommended actions

![Ask AI](assets/screenshots/ai_query_analyst.png)

> Screenshots are taken in **Demo mode**, which uses sample data built into the frontend.

---

## Features

- **Schemaless CSV ingestion** — upload any sales CSV. The date column, target (revenue/sales) and numeric levers are detected automatically, the data is cleaned, and it is stored in its own PostgreSQL table. Uploads can be undone.
- **Forecasting** — up to 90 days ahead. The model is chosen by history length: BayesianRidge under 60 days, Prophet (yearly + weekly seasonality) from 60 days, and Prophet + LightGBM on its residuals from 365 days. Training runs as a background job.
- **Honest uncertainty** — split-conformal prediction intervals calibrated on a backtest, plus a backtest endpoint that reports MAPE.
- **Factor attribution (explainability)** — each forecast day is broken into trend + day-of-week + time-of-year + each business lever's effect in ₹, and the parts add up exactly to the forecast.
- **What-if simulation** — change price, discount, marketing spend, etc. and see the effect on revenue, profit, units and the profit-maximising price. Scenarios can be saved and compared side by side.
- **Ask AI** — natural-language questions are turned into SQL by an LLM (Groq), validated with `sqlglot`, and run on a **read-only** database role. Every LLM call has a timeout and a deterministic fallback.
- **Document search (RAG)** — upload PDFs; they are chunked, embedded locally with `fastembed`, stored in Qdrant and searchable by meaning.
- **Data Explorer** — column profiles, correlation matrix and scatter plots.
- **Demo mode** — toggle in Settings to run the whole UI on built-in sample data, no backend required.

---

## Architecture

```mermaid
flowchart TD
    subgraph Client ["Frontend — Next.js 16"]
        UI["Pages: Dashboard · Forecast · Scenarios · Ask AI · Explorer · Datasets · Documents · Upload"]
        Proxy["/api/* route handler<br/>(adds X-API-Key server-side)"]
    end

    subgraph API ["Backend — FastAPI"]
        Ingest["Ingestion service<br/>type inference · cleaning · per-dataset tables"]
        Forecast["Forecast service<br/>BayesianRidge / Prophet / Prophet+LightGBM<br/>conformal intervals · attribution · what-if"]
        Query["Query service<br/>NL → SQL (Groq) · sqlglot validation"]
        RAG["Document service<br/>PDF parsing · fastembed embeddings"]
    end

    subgraph Storage ["Storage"]
        PG[("PostgreSQL 15<br/>app role + read-only role")]
        Qdrant[("Qdrant<br/>document vectors")]
        Models[("ml_models/<br/>trained model files")]
    end

    UI --> Proxy --> API
    Ingest --> PG
    Forecast --> PG
    Forecast --> Models
    Query -->|read-only| PG
    RAG --> Qdrant
```

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Recharts, TanStack Query, Framer Motion, Radix UI |
| **Backend** | Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2 (async), Alembic |
| **ML** | Prophet, scikit-learn (BayesianRidge), LightGBM, pandas, NumPy |
| **LLM / RAG** | Groq API, sqlglot, fastembed, Qdrant |
| **Databases** | PostgreSQL 15, Qdrant |
| **Tooling** | Docker Compose, pytest, Jest, Playwright, ESLint, GitHub Actions |

---

## How to Run

There are three ways to run the project. **Option A (Docker) is the easiest.**

### Prerequisites

- [Git](https://git-scm.com/)
- **Option A:** [Docker Desktop](https://docs.docker.com/get-docker/) (includes Docker Compose)
- **Option B:** Python **3.13**, Node.js **20+**, and Docker (only for PostgreSQL and Qdrant) or your own PostgreSQL 15
- A free **Groq API key** from [console.groq.com](https://console.groq.com/keys) for Ask AI. Without it the app still runs; questions fall back to simpler non-LLM answers.

### Clone the repository

```bash
git clone https://github.com/Jaiadhithya/Cogni_Twin.git
```

```bash
cd Cogni_Twin
```

### Option A — Run everything with Docker Compose

1. Create a `.env` file in the project root with your Groq key (Docker Compose reads it automatically):

   ```env
   GROQ_API_KEY=your_groq_api_key_here
   ```

2. Build and start PostgreSQL, Qdrant, the backend and the frontend:

   ```bash
   docker compose up --build -d
   ```

3. Create the database tables (first run only, and after pulling new migrations):

   ```bash
   docker compose exec backend alembic upgrade head
   ```

4. Open the app:

   | What | URL |
   |---|---|
   | CogniTwin web app | http://localhost:3000 |
   | Backend API docs (Swagger) | http://localhost:8000/docs |
   | Qdrant dashboard | http://localhost:6333/dashboard |

To stop everything: `docker compose down` (add `-v` to also delete the database and uploaded data).

### Option B — Run backend and frontend locally (for development)

**1. Start PostgreSQL and Qdrant** (Docker is the simplest way; PostgreSQL is exposed on port **5433**):

```bash
docker compose up -d db qdrant
```

The database container automatically creates the `cognitwin` database, the `cognitwin_user` app user (password `postgres`) and the `cognitwin_readonly` role (password `readonly`) used by Ask AI.

**2. Backend** — in a terminal:

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
```

Edit `backend/.env` and set:

```env
DATABASE_URL=postgresql+asyncpg://cognitwin_user:postgres@localhost:5433/cognitwin
DATABASE_READONLY_URL=postgresql+asyncpg://cognitwin_readonly:readonly@localhost:5433/cognitwin
GROQ_API_KEY=your_groq_api_key_here
```

Then create the tables and start the API:

```bash
alembic upgrade head
uvicorn src.main:app --reload --port 8000
```

The API is now at http://localhost:8000 (docs at http://localhost:8000/docs).

**3. Frontend** — in a second terminal:

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000. The frontend talks to the backend at `http://localhost:8000/api/v1` by default (change `BACKEND_API_URL` in `frontend/.env.local` if needed).

### Option C — Frontend only (Demo mode, no backend)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000, go to **Settings** (gear icon) and turn on **Demo mode**. Every page then uses built-in sample data.

---

## Try It with the Demo Data

The [`demo_data/`](demo_data) folder has two synthetic, forecastable datasets:

| File | Business | Rows |
|---|---|---|
| [`nexa_electronics_sales_2024_2026.csv`](demo_data/nexa_electronics_sales_2024_2026.csv) | Consumer-electronics retailer (main demo dataset) | 17,520 |
| [`brewhaus_cafe_sales_2025_2026.csv`](demo_data/brewhaus_cafe_sales_2025_2026.csv) | Café chain with different column names (shows schemaless upload) | 7,312 |

1. Go to **Data → Upload** and upload `nexa_electronics_sales_2024_2026.csv`.
2. Select it in the dataset picker at the top and open **Dashboard**.
3. Open **Forecast**, train the model, then move the levers in the **What-if** panel. Enter a cost per unit (e.g. ₹12,500) to see profit and optimal price.
4. Open **Ask AI** and try "Which category had the highest net revenue?".
5. Optional: upload a PDF (e.g. a supplier contract) under **Data → Documents** and search it.

See [`demo_data/README.md`](demo_data/README.md) for what drives each dataset and more demo questions.

---

## Configuration

Backend settings are read from environment variables or `backend/.env` (see [`backend/.env.example`](backend/.env.example) and [`backend/src/config.py`](backend/src/config.py)).

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | Async PostgreSQL URL for the app user |
| `DATABASE_READONLY_URL` | yes | Async PostgreSQL URL for the read-only role used by Ask AI |
| `GROQ_API_KEY` | recommended | Groq key for Ask AI and natural-language explanations |
| `GROQ_MODEL_NAME` | no | Groq model (default `openai/gpt-oss-120b`) |
| `QDRANT_HOST` / `QDRANT_PORT` | no | Qdrant location (default `localhost:6333`) |
| `API_KEY` | no | If set, every request must send it in the `X-API-Key` header |
| `CORS_ORIGINS` | no | Allowed browser origins |

Frontend settings (`frontend/.env.local`): `BACKEND_API_URL` and, if the backend has `API_KEY` set, `BACKEND_API_KEY`. Both are used server-side only.

---

## API Overview

All endpoints are under `/api/v1`. If `API_KEY` is set, they need the `X-API-Key` header (except `/health` and the docs). Interactive docs are at `/docs`; full contracts are in [`docs/API_SPECIFICATION.md`](docs/API_SPECIFICATION.md).

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Checks the database, Qdrant and LLM key |
| `POST` | `/ingest/csv` | Upload a CSV into its own dataset table |
| `GET` | `/data/summary` | Dashboard metrics for a dataset |
| `GET` | `/data/uploads` | Upload history |
| `DELETE` | `/data/uploads/{upload_id}` | Undo an upload (drops its table, metadata and models) |
| `GET` | `/data/{dataset_id}/profile` | Column statistics |
| `GET` | `/data/{dataset_id}/correlations` | Correlation matrix |
| `GET` | `/data/{dataset_id}/scatter` | Sampled scatter points for two columns |
| `GET` | `/data/{entity_type}` | Paginated rows |
| `POST` | `/forecast/train` | Start a training job (`202` + `job_id`) |
| `GET` | `/forecast/jobs/{job_id}` | Training job status |
| `GET` | `/forecast/status` | Whether a trained model exists, and its metadata |
| `GET` | `/forecast/predict` | Forecast with prediction intervals (up to 90 days) |
| `GET` | `/forecast/backtest` | Backtest accuracy (MAPE) |
| `POST` | `/forecast/simulate` | What-if simulation with lever changes |
| `GET` | `/forecast/simulations` | Saved scenarios |
| `GET` | `/forecast/simulations/compare` | Compare saved scenarios |
| `GET` | `/forecast/explain/{product_id}` | Factor attribution for a forecast |
| `GET` | `/forecast/explain-prescribe` | Forecast, drivers, anomaly check and recommended actions |
| `POST` | `/documents/upload` | Upload and index a PDF/text document |
| `POST` | `/documents/search` | Semantic search over documents |
| `POST` | `/query` | Plain-English question → SQL → answer |

---

## Running Tests

**Backend** (needs PostgreSQL running and `backend/.env` configured as in Option B; Qdrant is optional):

```bash
cd backend
pytest -q
```

**Frontend:**

```bash
cd frontend
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

`npm run test:e2e` builds the app and runs Playwright in Demo mode, so it needs no backend (run `npx playwright install chromium` once first).

GitHub Actions runs all of these on every push ([`.github/workflows/backend.yml`](.github/workflows/backend.yml)).

---

## Project Structure

```
Cogni_Twin/
├── backend/
│   ├── alembic/            # Database migrations
│   ├── scripts/init_db.sql # Creates the read-only role (run by Docker on first start)
│   ├── src/
│   │   ├── api/            # FastAPI routers and request/response schemas
│   │   ├── domain/         # Entities, value objects, interfaces, exceptions
│   │   ├── infrastructure/ # Database, ML models, LLM client, Qdrant, storage
│   │   ├── services/       # Ingestion, forecasting, simulation, query, RAG
│   │   ├── config.py       # Settings
│   │   └── main.py         # App entry point
│   └── tests/              # Unit and integration tests
├── frontend/
│   ├── src/app/            # Next.js pages and the /api proxy route
│   ├── src/components/     # UI components, charts, page views
│   ├── src/lib/            # API client, hooks, demo data, formatters
│   ├── tests/              # Jest tests
│   └── e2e/                # Playwright tests
├── demo_data/              # Demo CSVs and the script that generates them
├── docs/API_SPECIFICATION.md
├── assets/screenshots/     # README screenshots
└── docker-compose.yml      # PostgreSQL, Qdrant, backend, frontend
```

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE).
