# CogniTwin — Comprehensive Technical Audit Report

**Audit date:** 2026-09-17
**Auditor:** Principal Software Architect / Senior Full-Stack / QA / Security / Performance / UX review
**Repository:** `C:\ML Project` (git repo, branch `main`, 12 commits ahead of `origin/main`)
**Method:** Static code inspection, configuration review, dependency metadata inspection, git history/status inspection, and **safe read-only runtime verification** (backend unit tests, frontend `tsc --noEmit`, `eslint`, `jest`, compiled-CSS inspection, module import check). **No source, configuration, database, or git state was modified at any point.**

---

## Evidence Convention

| Marker | Meaning |
|---|---|
| **CONFIRMED** | Directly verified by reading code/config, or by running a command and observing output during this audit |
| **INFERRED** | Strongly indicated by the evidence but not directly executed/observed |
| **POSSIBLE** | Plausible risk that could not be fully verified; presented as such |

---

## 1. Executive Summary

**CogniTwin** is an "AI Business Digital Twin" platform: a FastAPI + PostgreSQL + Qdrant backend providing dynamic CSV ingestion, Prophet time-series forecasting, counterfactual what-if simulation, LLM-driven natural-language-to-SQL (NL2SQL) querying, and RAG document search — fronted by a Next.js 16 / React 19 "cybernetic HUD" dashboard.

**Overall the project is an impressive, visually ambitious solo/small-team prototype with genuinely thoughtful defensive engineering in its LLM paths, but it is not production-ready and should not be exposed to any untrusted network.** The architecture is a well-intentioned Clean/Hexagonal design that has been partially eroded by two parallel, non-integrated feature tracks (a "typed" Phase-1 ingestion path and a "dynamic" Phase-6 schemaless path) that coexist without sharing code.

Headline conclusions:

1. **One confirmed CRITICAL security defect:** user-supplied values are string-interpolated into SQL literals in `shap_explainer_service.py:48-50` and `:172-174`. **CONFIRMED**
2. **The "read-only replica" safety story is fictional.** `DATABASE_READONLY_URL` is a *required* config setting with **zero consumers**; LLM-generated SQL executes on the read-write engine, gated only by a bypassable keyword blocklist. **CONFIRMED**
3. **Zero authentication or authorization** on any of the 15 API endpoints, plus `allow_origins=["*"]` with `allow_credentials=True` (contradicting the project's own spec and its own unused `CORS_ORIGINS` setting). **CONFIRMED**
4. **The "TreeSHAP" explainability is not TreeSHAP.** The `shap` library is not imported, not installed, and not in `requirements.txt`. The engine relabels Prophet's native additive decomposition as "SHAP-style" contributions. README claims of TreeSHAP, Scikit-Learn, and LangChain are all inaccurate. **CONFIRMED**
5. **The frontend reports failures as successes.** On any backend error, the dashboard/forecast silently fall back to hardcoded demo data, the ingest page fabricates a profiling result (`row_count: 51280`, `clean_pct: 99.8`), and a failed PDF upload is reported as "Indexed … (12 chunks, 1536-dim)" — a claim that is also factually wrong (the embedder is 384-dim). **CONFIRMED**
6. **The entire frontend test suite is red** (5/5 tests fail against UI copy that no longer exists), and **79 ESLint errors** are unaddressed. Backend unit tests (44) do pass.
7. **Heavy dead-code load:** ~14 dead React components (including a whole `webgl/` tree and cursor system), 4 dead API client functions, 6 dead npm dependencies, one dead LLM client (`GeminiClient`), one dead DB setting, and ~4.4 MB of byte-identical duplicated tracked images in a legacy `CogniTwin/` slide deck.
8. **Uncommitted work-in-progress:** 22 modified files and 6 new untracked components sit in the working tree, 12 commits have never been pushed, and one tracked doc (`MULTI_AGENT_SYSTEM_PLAN.md`) has been deleted locally.

**Strengths worth preserving:** the deterministic-fallback design throughout the LLM chain (every LLM call has a timeout *and* a non-LLM fallback), the "anti-pollution shield" that re-validates LLM schema guesses against real DataFrame columns, the dataset-isolation model for forecasting, CSV-injection sanitization, and a genuinely polished visual design system with mostly-good accessibility primitives.

---

## 2. Project Overview

| Aspect | Finding | Basis |
|---|---|---|
| **Name** | CogniTwin ("AI Business Digital Twin platform") | `README.md:1` |
| **Purpose** | Replicate business dynamics as a computational model: ingest data, forecast, explain, simulate, and answer natural-language questions | `README.md:11` |
| **Problem solved** | Fragmented BI: separate tools for ingestion, forecasting, explainability, what-if simulation, and NL querying | `docs/phase1/00-PHASE1-OVERVIEW.md` |
| **Target users** | Business owners / executives ("senior business strategist", "executive bullet points" in prompts) | `prescriptive_service.py:200`, `shap_explainer_service.py:115-138` |
| **Main journeys** | Ingest CSV → Dashboard → Train forecast → Forecast/What-If → Ask analyst; Ingest PDF → semantic search | `frontend/src/app/(app)/*` |
| **Core features** | Dynamic CSV ingestion, Prophet forecasting, counterfactual simulation, "SHAP-style" explanation, NL2SQL, prescriptive actions, RAG document Q&A | routers + services |
| **Business logic** | INR (₹) denominated retail analytics; anomaly = projected 7-day mean ≤ −10% vs trailing 30-day mean | `prescriptive_service.py:27,126-161` |
| **Technical approach** | Clean Architecture modular monolith + LLM orchestration with deterministic degradation | `docs/phase1/01-ARCHITECTURE.md` |
| **Architectural pattern** | Hexagonal-ish: `domain/` (entities, value objects, interfaces) ← `infrastructure/` (adapters) ← `services/` (application) ← `api/` (delivery) | `backend/src/` tree |
| **Major dependencies** | FastAPI, SQLAlchemy 2 async, Prophet, Pandas, Groq SDK, Qdrant client, fastembed, PyMuPDF, Next.js 16, React 19, visx + recharts, framer-motion | `requirements.txt`, `package.json` |

**Status of README claims vs implementation truth:**

| README claim | Reality | Verdict |
|---|---|---|
| "TreeSHAP engine attributing sales deviations" | `shap` lib absent; `ShapEngine` reads Prophet component columns (`trend`, `yearly`, `weekly`, regressors) and relabels them | **INACCURATE** |
| "Scikit-Learn" in ML stack | 0 references to sklearn in `backend/src` | **INACCURATE** |
| "LangChain / Prompt Templates" | 0 references to langchain; prompts are inline f-strings | **INACCURATE** |
| "Groq / Gemini Async Client" | Only `GroqClient` is wired; `GeminiClient` is dead code, and no `GEMINI_API_KEY` is present in `.env` | **PARTIALLY ACCURATE** |
| "PostgreSQL 15", "Qdrant", "Prophet", "FastAPI", "Next.js" | All true | **ACCURATE** |
| Badge "Next.js-15.1" | `package.json` pins `next 16.2.11` | **INACCURATE** |
| "safe, parameterized SQL queries executed against a read-only database replica" | Read-only replica is never used; SQL is LLM-generated and run on the RW engine | **INACCURATE** |
| "90-day predictive confidence intervals" | `interval_width=0.80` (80% interval), `FORECAST_HORIZON_MAX_DAYS=90` | **PARTIALLY ACCURATE** |
| "1,840 rows" benchmark dataset | Verified: 1,840 data rows + header | **ACCURATE** |
| `cp frontend/.env.local.example frontend/.env.local` quickstart | That template is git-ignored and untracked — a new clone has no such file | **BROKEN QUICKSTART** |

---

## 3. Repository Structure

Built from the actual filesystem (not the README tree).

```
C:\ML Project/
├── .env                          # ignored; real Groq key present (root copy)
├── .gitignore                    # 101 lines, comprehensive
├── AUDIT_PROPOSAL_AND_ROADMAP.md # ignored by .gitignore; STALE audit (see §16)
├── BUSINESS_DATASET_DOCUMENTATION.md            # accurate dataset doc
├── MULTI_AGENT_SYSTEM_PLAN.md   # deleted in working tree, still in HEAD
├── README.md / presentation.md / presentation.html
├── docker-compose.yml            # 4 services
├── benchmark.py                  # ORPHANED perf script
├── generate_dataset.py           # ORPHANED generator (output used by tests)
├── dummy_sales.sql               # ORPHANED manual seed
├── retail_enterprise_business_data.csv  # 1,840 rows, USED by README+tests
├── complex_dataset.csv           # 5,000 rows, used by tests only
├── *.png (16 files)              # untracked, properly ignored
├── ml_models/ uploads/           # local runtime artifacts, ignored
├── assets/                       # 7 tracked JPGs + 3 tracked screenshots
├── CogniTwin/                    # LEGACY Reveal.js deck, ZERO inbound refs,
│                                 #   assets/ = byte-identical duplicates (~4.4 MB)
├── docs/
│   ├── phase1/ (16 md files)     # spec; PARTLY ASPIRATIONAL (see §16)
│   ├── phase2/ (2 files)         # PHASE2 spec says SQLite + llama-3.3 (WRONG),
│   │                             #   implementation_plan.md is actually a Phase-6 doc
│   ├── generate_dataset.py + sample_dataset_1000.csv   # ORPHANED
├── backend/
│   ├── .env (ignored)            # identical to root .env (duplicate key)
│   ├── alembic/ (2 migrations)   # env.py prints DATABASE_URL (secret leak)
│   ├── scripts/                  # init_db.sql, seed_db.py, init_db.py, generators, run_tests.py
│   ├── src/  (api/ domain/ infrastructure/ services/ config.py main.py)
│   ├── tests/ (unit 9 files, integration 6 files, 4 root-level files)
│   ├── ml_models/ uploads/ qdrant_data/ test_artifacts/ .venv/  # all ignored
│   └── test_supplier_contract.txt # ORPHANED tracked 217-byte fixture
└── frontend/
    ├── .env.local (ignored)      # NEXT_PUBLIC_API_URL — READ NOWHERE
    ├── .env.local.example        # UNTRACKED + IGNORED (gitignore bug)
    ├── src/app, src/components, src/lib, src/context
    └── tests/ (2 stale test files)
```

**Directory purpose / health summary:**

| Directory | Purpose | Actively used | Issue |
|---|---|---|---|
| `backend/src/api` | 8 routers, 15 handlers | Yes | Two overlapping ingestion routers |
| `backend/src/domain` | Entities, value objects, interfaces | Yes | `Repository` protocol signature stale; `relationship` import unused |
| `backend/src/infrastructure` | DB, ML, LLM, vector, ingestion, logging adapters | Yes | `GeminiClient` dead; `DATABASE_READONLY_URL` dead |
| `backend/src/services` | Application layer | Yes | Two ingestion services, two data cleaners (shim) |
| `backend/alembic` | Migrations | Yes | No GRANT step despite `init_db.sql` claiming one |
| `backend/tests` | 67 test functions | Partly | 23 tests need live infra; `test_data/` empty dir |
| `frontend/src/app` | 5 pages, 2 layouts | Yes | No `loading.tsx`/`error.tsx`/`not-found.tsx` |
| `frontend/src/components` | 43 components | ~29 live | ~14 dead (see §16) |
| `frontend/src/lib` | api client, formatters, mockData, utils | Yes | `any`-typed; 4 dead exports |
| `CogniTwin/` | Legacy static slide deck | **No** | Fully orphaned; duplicated binaries |
| `docs/` | Specifications | Reference | Significant drift (§16) |

---

## 4. Technology Stack

| Layer | Technology | Version | Location | Verified usage |
|---|---|---|---|---|
| Language (BE) | Python | 3.11+ (venv present) | `backend` | **CONFIRMED** runnable |
| Web framework | FastAPI | `>=0.104` | `requirements.txt:1` | **CONFIRMED** `main.py` imports OK |
| ASGI server | uvicorn[standard] | `>=0.24` | `requirements.txt:2` | **CONFIRMED** |
| ORM | SQLAlchemy[asyncio] | `>=2.0` | `requirements.txt:3` | **CONFIRMED** async engine + UoW |
| PG driver | asyncpg / psycopg2-binary | `>=0.29 / >=2.9` | `requirements.txt:4,15` | **CONFIRMED** (asyncpg for app; psycopg2 for pandas `to_sql`) |
| Migrations | Alembic | `>=1.13` | `requirements.txt:5` | **CONFIRMED** 2 revisions |
| Validation | Pydantic + pydantic-settings | `>=2.5 / >=2.1` | `requirements.txt:6-7` | **CONFIRMED** |
| Dataframes | Pandas / NumPy | `>=2.1` | `requirements.txt:8` | **CONFIRMED** (pervasive) |
| Forecasting | Facebook Prophet | `>=1.1.5` | `requirements.txt:9` | **CONFIRMED** (`prophet_forecaster.py`) |
| XAI | **`shap` — NOT LISTED, NOT INSTALLED, NOT IMPORTED** | — | — | **CONFIRMED ABSENT** |
| ML utils | Scikit-Learn | — | — | **CONFIRMED ABSENT** (0 refs) |
| LLM SDK | groq | `>=0.11` | `requirements.txt:17` | **CONFIRMED** only live client |
| LLM (alt) | google-generativeai | `>=0.3` | `requirements.txt:10` | **DEAD** (`GeminiClient` unused) |
| LLM orchestration | LangChain | — | — | **CONFIRMED ABSENT** (0 refs) |
| Vector DB client | qdrant-client | unpinned | `requirements.txt:20` | **CONFIRMED** |
| Embeddings | fastembed (BAAI/bge-small-en-v1.5, **384-dim**) | unpinned | `requirements.txt:21` | **CONFIRMED** |
| PDF parsing | pymupdf / pymupdf4llm | unpinned | `requirements.txt:18-19` | **CONFIRMED** |
| Fuzzy matching | rapidfuzz | `>=3.5` | `requirements.txt:13` | **CONFIRMED** (`schema_mapper`) |
| Frontend | Next.js | **16.2.11** (`package.json:36`) | README badge says 15.1 | **CONFIRMED** version drift |
| UI runtime | React / React-DOM | 19.2.4 | `package.json:38-39` | **CONFIRMED** |
| Styling | Tailwind CSS v4 + tw-animate-css | `^4` | `postcss.config.mjs` | **CONFIRMED** (`@theme` tokens) |
| Charts | **visx** AND **recharts** | visx `^4`, recharts `^3.10` | `package.json:18-27,40` | **CONFIRMED** two ecosystems shipped |
| Animation | framer-motion | `^12.42` | `package.json:33` | **CONFIRMED** imported by 24 files |
| 3D | three, @react-three/fiber, drei, postprocessing | latest | `package.json:14-17,43` | **DEAD** (only consumer `webgl/` never rendered) |
| DB | PostgreSQL 15 | `postgres:15-alpine` | `docker-compose.yml:5` | **CONFIRMED** |
| Vector DB | Qdrant | `qdrant/qdrant:latest` | `docker-compose.yml:24` | **CONFIRMED** (with in-memory fallback) |
| Containers | Docker Compose | `version: '3.8'` (obsolete key) | `docker-compose.yml:1` | **CONFIRMED** |
| BE tests | pytest + pytest-asyncio + httpx + pytest-cov | dev extras in `pyproject.toml` | | **CONFIRMED** (44 unit pass) |
| FE tests | jest 30 + ts-jest 29 + RTL 16 (jsdom) | | `package.json:58-61` | **CONFIRMED** (5/5 FAIL) |
| E2E | playwright `^1.62` — listed in **dependencies**, zero e2e tests | | `package.json:37` | **CONFIRMED DEAD** |

**Version-pinning risk:** `requirements.txt` uses `>=` floors for everything except the three unpinned packages (`pymupdf4llm`, `pymupdf`, `qdrant-client`, `fastembed`) — a fresh install is non-reproducible. `frontend` uses caret ranges. **CONFIRMED**

---

## 5. Architecture

### 5.1 High-level system architecture (as actually implemented)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (Next.js 16, all client components)                        │
│  /  /dashboard  /forecast  /ingest  /query                          │
│  DatasetContext (localStorage + URL param + storage event sync)     │
└───────────────┬─────────────────────────────────────────────────────┘
                │  same-origin fetch → '/api/...'  (Next rewrite)
┌───────────────▼─────────────────────────────────────────────────────┐
│  Next server  next.config.ts rewrites /api/:path*                   │
│  → ${BACKEND_API_URL || http://localhost:8000/api/v1}               │
└───────────────┬─────────────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────────────┐
│  FastAPI (main.py)  CORS:*  request-id logging middleware            │
│  15 handlers / 8 routers under /api/v1                              │
│  dependencies.py — manual DI composition (per-request)              │
├─────────────────────────────────────────────────────────────────────┤
│ services:  IngestionService │ DynamicIngestionService │ Warehouse    │
│            ForecastService │ QueryService │ ShapExplainerService     │
│            RAGService │ PrescriptiveService                        │
├─────────────────────────────────────────────────────────────────────┤
│ domain:  entities, value objects, interfaces (protocols)            │
├─────────────────────────────────────────────────────────────────────┤
│ infrastructure:  PostgresRepository + UoW (SQLAlchemy async)        │
│                  ProphetForecaster + JsonModelStorage (file JSON)   │
│                  ShapEngine (Prophet component decomposition)       │
│                  GroqClient │ GeminiClient (DEAD)                   │
│                  QdrantVectorStore + fastembed (384-d)              │
│                  CSV/Date/Schema ingestion adapters                 │
└──────┬───────────────────────────────┬──────────────────────────────┘
       │                               │
┌──────▼──────────────┐      ┌─────────▼──────────┐   ┌──────────────┐
│ PostgreSQL 15       │      │ Qdrant (or IN-MEM  │   │ Groq API     │
│ 10 modeled tables + │      │  fallback!)        │   │ gpt-oss-120b │
│ dynamic dataset_*   │      │ cognitwin_documents│   └──────────────┘
└─────────────────────┘      └────────────────────┘
```

### 5.2 Architectural observations

| # | Observation | Class | Evidence |
|---|---|---|---|
| A1 | **Two non-integrated feature tracks.** `IngestionService` (typed entities → `sales/products/...` via UoW, fuzzy schema mapping, no LLM) vs `DynamicIngestionService` (schemaless → `dataset_<hex>` via pandas `to_sql`, LLM semantics). Two routers (`/upload/{entity}`, `/ingest/csv`), zero shared code, two metadata models. Downstream code must special-case both (`forecast_service.py:30-44`, `repository.py:390-396`). | Coupling/Smell | **CONFIRMED** |
| A2 | **Dependency direction is correct** for a hexagonal layout: `api → services → domain ← infrastructure`. No domain imports infrastructure. | Strength | **CONFIRMED** |
| A3 | **`dependencies.py` mixes composition with bottom-of-file imports** (lines 56, 80, 103) — workable but fragile; circular-import risk if reorganized. | Smell | **CONFIRMED** |
| A4 | **Protocol drift:** `domain/interfaces/repository.py:34-38` declares `get_summary_metrics(self, date_range=None)` while the implementation and all callers pass `dataset_id`. Not runtime-enforced → silently stale. | Smell | **CONFIRMED** |
| A5 | **Encapsulation breaks:** `forecast_service.py:35,56,88` reaches into `uow.repository.session`; `shap_explainer_service.py:216` uses `uow._session`; `prescriptive_service.py:175-176` reads `forecaster._last_regressor_values`. | Coupling | **CONFIRMED** |
| A6 | **SPOF: the process-local in-memory model cache.** `ProphetForecaster._models` holds trained models per process. Scaling to >1 uvicorn worker breaks dataset isolation/freshness silently (a request may hit a worker whose cache lacks or holds a stale model). | Scalability | **CONFIRMED (code)** / **INFERRED (impact)** |
| A7 | **Split transaction in dynamic ingestion:** DDL via `engine.begin()` (committed on exit) and `DatasetMetadata` commit on a *different* session are not atomic → orphaned tables on metadata failure. | Correctness | **CONFIRMED** |
| A8 | **No background/scheduled jobs, no task queue.** Everything is request-synchronous, including Prophet training (seconds) and up to 3 chained LLM calls per `/query`. | Scalability | **CONFIRMED** |
| A9 | **Frontend has no server-component data fetching.** 38 of 43 `.tsx` are client components; the only server-side logic is the `/api` rewrite. No RSC/streaming benefit; maximal client JS. | Performance | **CONFIRMED** |
| A10 | **Two sources of truth for "summary"**: context `activeSummary` and forecast page's local `summary` state. | Smell | **CONFIRMED** |

### 5.3 Data flow — NL2SQL request (the critical path)

```
POST /api/v1/query {question, dataset_id}
 → query_router.execute_query
 → QueryService.execute_query
   → _classify_intent  (keyword heuristic; else LLM, 2.5s timeout, default SQL)
   → route: SQL | DOCUMENT | EXPLAIN | SIMULATION | FUSED
   → [SQL] uow.repository.get_table_schemas(dataset_id)      ← N+1 queries, f-string SQL
            → uow.rollback() (no-op on clean session)
            → llm.generate_sql(schema_context)  15s timeout   ← schema_context.split()[1] parse
            → _validate_sql()  blocklist                       ← bypassable
            → repository.execute_readonly_sql(sql) 10s timeout ← RW engine, no limit
            → llm.format_answer() 15s timeout
            → _synthesize_charts_from_sql_results / _generate_executive_insights
            → _get_prescriptive_actions (may itself call forecast+SHAP+LLM)
   → return {answer, insights, prescriptive_actions, charts, generated_sql, raw_data, confidence}
```

Worst-case latency for a single `/query` (FUSED/SIMULATION paths): 4–6 sequential LLM round-trips + full forecast retrain-free recomputation. **CONFIRMED (code path)**; **INFERRED** p95 would be 10–30 s.

### 5.4 AI/ML flow

```
CSV upload → DynamicIngestionService
  → sanitize columns ([A-Za-z0-9_]) → clean_dynamic_df (dates/numerics/injection)
  → LLM semantic mapping (JSON) → ANTI-POLLUTION SHIELD re-validates vs real columns
  → pandas.to_sql(dataset_<hex8>) → DatasetMetadata (separate txn)
POST /forecast/train
  → resolve dataset → inspect real columns → aggregate SQL (f-string identifiers)
  → Prophet(multiplicative, yearly+weekly, interval_width .8) + add_regressor(*)
  → fit in thread → JSON serialize to ml_models/ + registry
GET /forecast/predict → make_future_dataframe, regressors held at LAST observed value
POST /forecast/simulate → baseline vs mutated future, constant mutation across horizon
GET /forecast/explain-prescribe → forecast + ShapEngine + anomaly + 2 LLM calls
```

---

## 6. Frontend Audit

### 6.1 Route map

| Route | File | Lines | Render type | Notes |
|---|---|---|---|---|
| `/` | `src/app/page.tsx` | 133 | Client | Landing; rAF canvas; hardcoded telemetry strip |
| `/dashboard` | `src/app/(app)/dashboard/page.tsx` | 436 | Client | KPIs, revenue chart, quick lever, top sellers, categorical chart; `useSearchParams` in `<Suspense>` |
| `/forecast` | `src/app/(app)/forecast/page.tsx` | 580 | Client | Visx forecast, sliders, what-if, SHAP drawers |
| `/ingest` | `src/app/(app)/ingest/page.tsx` | 762 | Client | CSV + presets + PDF + vector search |
| `/query` | `src/app/(app)/query/page.tsx` | 488 | Client | NL2SQL console + dynamic charts |

Layouts: `src/app/layout.tsx` (fonts, metadata, `dark`), `src/app/(app)/layout.tsx` (`DatasetProvider` → `ToastProvider`, header, error boundary, bottom dock). **No `loading.tsx`, `error.tsx`, or `not-found.tsx` anywhere.** **CONFIRMED**

### 6.2 API client (`src/lib/api.ts`)

- Base URL **hardcoded** to `/api`; all traffic proxied by the Next rewrite. **CONFIRMED**
- Env-var mismatch **CONFIRMED:** `.env.local` defines `NEXT_PUBLIC_API_URL` which is read **nowhere**; `next.config.ts` reads `BACKEND_API_URL` which is set **nowhere**. Falls back to localhost:8000.
- All 13 backend endpoints the client calls exist. **No phantom endpoints.** **CONFIRMED**
- 4 client functions are **dead**: `getEntityData`, `uploadFile` (imported but never called), `getExplanation` (0 refs), `ingestCsv` (page hand-rolls `fetch` instead). **CONFIRMED**
- Typing is poor: 9 explicit `any` return types (`api.ts:54,56,57,62,68,73,77,99,105`); only the Phase-6 simulation types are properly defined.
- Error envelope parsing correctly matches the backend `{status, error:{type,message}}` shape.

### 6.3 Component quality

- **God components (lines):** `ingest/page.tsx` 762 · `forecast/page.tsx` 580 · `DynamicChartRenderer.tsx` 497 · `query/page.tsx` 488 · `CategoricalChart.tsx` 473 · `VisxForecastChart.tsx` 464 · `dashboard/page.tsx` 436 · `WhatIfSimulator.tsx` 394 · `RevenueChart.tsx` 365 · `DatasetContext.tsx` 352. **CONFIRMED**
- **Card primitive duplication (5):** `Panel` (live) vs dead `SpotlightCard`, `PremiumGlassCard`, `BentoCard`, `VolumetricCard`.
- **KPI card duplication (3):** dead `KPITile`, dead `GlassKPICard`, live `KpiCard` — the latter two share near-identical `AnimatedNumber`/`formatByType` logic.
- **Two overlapping lever panels on `/forecast`:** `SimulationSliders` (dynamic, from `summary.metadata.numerical_columns`) **and** `WhatIfSimulator` (fixed 4 levers) both render, both feed the same `handleMutationsChange`, with duplicated debounce/emit logic.
- **Rules-of-Hooks violation, CONFIRMED:** `DynamicChartRenderer.tsx:113-133` returns early for empty data *before* its `useState`/`useEffect`. If an instance ever transitions empty→populated, React throws "rendered fewer hooks than expected." ESLint's `react-hooks` rule would flag this.

### 6.4 Charting

- **Two chart ecosystems shipped:** visx (RevenueChart, CategoricalChart bar, VisxForecastChart) and recharts (CategoricalChart donut, WhatIfSimulator mini area, DynamicChartRenderer full toolkit). **CONFIRMED**
- `DynamicChartRenderer` switch supports `line/area/bar/stacked_bar/dual_axis/pie/scatter`; the type-switcher lets users override the declared type.
- Pie aggregation: top-7 slices + "Other Segments". **CONFIRMED**

### 6.5 Hardcoded values & inconsistency

- Repeated magic literal **`51280`** (row count) in ≥7 files; **`5482920`** (revenue) in 4 files; fake metrics `1.42% MAPE`, `R² 0.962`, `99.98% fidelity` in landing/dashboard/forecast/mockData. **CONFIRMED**
- **Three conflicting elasticity models** for the same levers: dashboard `quickLever * 0.88` (`dashboard:71`); forecast fallback price ×0.88 / marketing ×0.45 / discount ×0.35 (`forecast:193-200`); WhatIfSimulator price ×0.88 / marketing ×0.35 / discount ×0.55 / inventory ×0.22 (`WhatIfSimulator:157-160`). The same lever yields different numbers on different pages. **CONFIRMED**
- **Currency inconsistency:** `formatters.ts` defaults to **USD** (`Intl.NumberFormat(undefined, {currency:'USD'})`) while `DynamicChartRenderer`, `WhatIfSimulator`, `KpiCard` use **₹ / en-IN**. `$5.5M` and `₹2.5 Lakh` coexist in the live UI. **CONFIRMED**
- **CSS class `obsidian-panel` does not exist** — used at `ingest/page.tsx:44,750`; verified 0 occurrences in source *and* in the compiled dev CSS. Those surfaces render with no background. **CONFIRMED**
- **`border-hairline-signal` is not a generated Tailwind utility** — `--hairline-signal` sits in `@theme` but outside the `--color-*` namespace, so no utility is emitted; verified `.border-hairline-signal` = 0 occurrences in compiled CSS. Borders fall back to the base `*` border color (never the intended amber). **CONFIRMED**

---

## 7. UI/UX Audit

*(Source-level plus compiled-asset inspection; live browser session was not available in this environment.)*

### 7.1 Functional UX problems

| # | Finding | Evidence | Severity |
|---|---|---|---|
| UX-1 | **Failures are silently reported as success.** PDF upload `catch` sets `uploadStatus('success')` with a fabricated "Indexed … 12 chunks, **1536-dim** vector embeddings" — the real embedder is **384-dim**, so even the lie is technically wrong. | `ingest/page.tsx:561-563`; `qdrant_store.py:33-34` | **High** |
| UX-2 | **Fabricated ingestion results.** When the backend is unreachable (or a preset is clicked), the page invents `row_count: 51280`, `clean_pct: 99.8`, `missing_dates: 0`, fake `sample_rows`, and toasts "DATASET MATRIX SYNCHRONIZED". There is no demo indicator on this page. | `ingest/page.tsx:179-219` | **High** |
| UX-3 | **Fabricated search results.** Document-search errors return two invented contract excerpts with fake scores (0.942/0.885). | `ingest/page.tsx:578-591` | **High** |
| UX-4 | **Dashboard/forecast silently switch to demo data** on any API error; only `isDemoMode` on `/forecast` hints at it; `/dashboard` and `/query` give no signal. | `forecast/page.tsx:84-142`; `DatasetContext.tsx:190-218` | **Medium** |
| UX-5 | **Explain/prescribe ignores the active dataset** — `getExplainPrescribe(horizonDays)` omits `datasetId`, unlike every sibling call. | `forecast/page.tsx:126` vs `api.ts:159-163` | **Medium** |
| UX-6 | **No keyboard access** for the CSV drop zone, preset cards, or PDF drop zone (`<div onClick>` with no `role`/`tabIndex`/`onKeyDown`). | `ingest/page.tsx:262-284,297-308,610-621` | **Medium** |
| UX-7 | **No route-level loading/error/404 pages**; unknown URLs get Next's default 404. | absent `loading.tsx`/`error.tsx`/`not-found.tsx` | **Medium** |
| UX-8 | **Chat has no `role="log"`/aria-live** — screen-reader users get no announcement of new answers. | `query/page.tsx` | **Medium** |
| UX-9 | **Toast close button has no accessible name** (bare `X` icon). | `CyberneticToast.tsx:133-138` | **Low** |
| UX-10 | **`SegmentedTabs` uses `role="tab"` without tabpanels**, no roving tabindex, no arrow-key nav. | `SegmentedTabs.tsx:40,52` | **Low** |

### 7.2 UX strengths (evidence-backed)

- Real skeleton loaders (`CyberneticKPISkeleton`/`ChartSkeleton`), forecast spinner, query typing indicator, staged upload progress. **CONFIRMED**
- Empty states exist for `RevenueChart:339`, `CategoricalChart:411`, `TopProducts:112`, `DynamicChartRenderer:114`. **CONFIRMED**
- Charts expose `role="img"` + `aria-label` (`RevenueChart:133`, `VisxForecastChart:183-189`). **CONFIRMED**
- Range inputs carry `aria-label` + `aria-valuetext`; `aria-expanded` on collapsibles; `aria-current="page"` on dock; `aria-live="polite"` toast region; global `:focus-visible` outline. **CONFIRMED**
- Keyboard shortcuts 1–4 for nav with input guard (`BottomDock.tsx:23-38`). **CONFIRMED**
- Contrast: `--ink-muted #8A837A` on `#0A0A09` ≈ 5.3:1 (passes AA). **CONFIRMED by computation**

### 7.3 Visual design

A distinctive, high-craft dark "cybernetic observatory" aesthetic: custom Tailwind v4 token set (`--ink`, `--hairline`, `--signal` amber), three-font stack (Space Grotesk / Plus Jakarta / JetBrains Mono), grain overlay, glass panels, framer-motion draw-in chart animations, and a canvas particle "thread" hero. This is well above typical template quality. Two visual defects are confirmed: the missing `obsidian-panel` background (§6.5) and the never-amber `border-hairline-signal`.

---

## 8. Backend Audit

### 8.1 Request lifecycle

`main.py` → `request_logging_middleware` (assigns `request_id` to state, logs duration) → `CORSMiddleware` → router → `Depends` composition in `dependencies.py` → service → repository/UoW → response. Three global exception handlers normalize `{status, error:{type,message,details}}`. **CONFIRMED**

### 8.2 Strengths

- **Uniform error envelope** with typed error taxonomy (`CogniTwinError` → `ValidationError` / `RateLimitError` / `MlError` / `LlmError` / `IngestionError` …) and correct HTTP mapping (400/422/429/502/500). **CONFIRMED**
- **Deterministic degradation everywhere:** intent classification (2.5s), SQL generation (15s), SQL execution (10s), answer formatting (15s), SHAP translation (3s), RAG answer (3s), lever extraction (deterministic fallback). Every LLM failure has a non-LLM path. **CONFIRMED** — this is the single best-engineered aspect of the backend.
- **Anti-pollution shield** re-validates LLM-produced column roles against real DataFrame columns and backfills deterministically; locked by `tests/unit/test_hardened_pipeline.py`. **CONFIRMED**
- `asyncio.to_thread` wraps blocking Prophet/embedding/pandas work. **CONFIRMED**
- CSV-injection sanitizer strips leading `=`/`@`/`+`. **CONFIRMED**

### 8.3 Problems

| # | Finding | Evidence | Severity |
|---|---|---|---|
| BE-1 | **SQL injection in the SHAP path** — `product_id` and `forecast_date` (both user-controlled) are interpolated into single-quoted SQL literals with no escaping or parameterization. | `shap_explainer_service.py:48-50` (`WHERE CAST(id AS TEXT) = '{product_id}'`), `:172-174` (shap_cache lookup) | **CRITICAL** |
| BE-2 | **~12 raw-SQL identifier interpolations** (table/column names). Mitigated only indirectly by upstream `[A-Za-z0-9_]` sanitization; there is **no quoting/whitelist at the SQL construction sites**. | `repository.py:507-620,716-758`; `forecast_service.py:74-86`; `query_service.py:119-123` | **High** |
| BE-3 | **Read-only isolation non-existent.** `DATABASE_READONLY_URL` is required by config but consumed nowhere; `execute_readonly_sql` runs `text(sql)` on the RW session; the `limit` parameter is silently ignored. | `repository.py:769-774`; `engine.py:18-23`; `config.py:13` | **High** |
| BE-4 | **No authn/authz whatsoever.** No middleware, no dependency, no API key. Any network-reachable instance allows ingestion, model training, and arbitrary (blocklist-gated) SQL. | absence in `main.py`/`dependencies.py` | **High** |
| BE-5 | **No rate limiting** despite `QUERY_RATE_LIMIT`/`QUERY_TIMEOUT_SECONDS` config and a spec promising 10/min query, 5/min upload, 3/min train. Only a logging middleware is installed. | `main.py:91-115`; `config.py:39-40`; `docs/phase1/04-API-SPECIFICATION.md` | **Medium** |
| BE-6 | **Internal error messages leaked** to clients: `"message": str(e)` in every router's catch-all. | all routers, e.g. `query_router.py:34-37` | **Medium** |
| BE-7 | **Dynamic ingestion has no size/row limits** — whole file read into memory (`await file.read()`), no `MAX_UPLOAD_SIZE_MB`/`MAX_UPLOAD_ROWS` enforcement on this path. | `ingestion.py:198-199` vs `csv_parser.py:10-11` | **Medium** |
| BE-8 | **Split transaction → orphaned tables**; also `if_exists='replace'` on a table name with only 32 bits of entropy means a collision **silently DROPs another dataset's table**. | `ingestion.py:211-218` | **Medium** |
| BE-9 | **Health check is a mock** — `database: "unverified"`, `gemini_api: "unverified"`; it only checks that a directory exists. Docker treats this as authoritative for `depends_on`/restart decisions. | `health.py:15-24` | **Medium** |
| BE-10 | **N+1 in `get_table_schemas`** — ~1–2 round trips *per column per table*, f-string SQL, and this runs on **every** `/query`. A 50-column dataset → ~100+ queries. | `repository.py:657-767` | **Medium** |
| BE-11 | **Double commit** in typed ingestion (`uow.commit()` then `__aexit__` commits again); **non-reentrant UoW reuse** in the error path. | `ingestion_service.py:106-121`; `uow.py:24-43` | **Low** |
| BE-12 | **`except (json.JSONDecodeError, Exception)`** — redundant and a sign of copy-paste error handling. | `prescriptive_service.py:262` | **Low** |
| BE-13 | **Fragile prompt-internal parsing:** `schema_context.split()[1]` inside the NL2SQL prompt silently yields a wrong table name if the header format ever changes. | `groq_client.py:41,55` | **Medium** |

---

## 9. API Audit

**15 route handlers across 8 routers, all under `/api/v1`. No authentication on any endpoint.**

| # | Method | Route | Purpose | Validation | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/health` | Health | — | **MOCK** (db/LLM "unverified") |
| 2 | POST | `/upload/{entity_type}` | Typed CSV upload | ext + size + rows | Entity type is a path Enum; deletes temp file |
| 3 | GET | `/data/summary` | Dashboard metrics | dataset_id sanitized | Returns `Any` (untyped response model) |
| 4 | GET | `/data/uploads` | Upload history | page/page_size bounds | OK |
| 5 | GET | `/data/{entity_type}` | Paginated entity rows | bounds; `sort_by`/`sort_order` **unvalidated** | Returns **404** when empty (anti-pattern) |
| 6 | POST | `/forecast/train` | Train Prophet | granularity + dataset_id | Long-running, synchronous, no queue |
| 7 | GET | `/forecast/predict` | Forecast | `horizon_days` **unbounded** (no `le` constraint) | Enforced only in service |
| 8 | GET | `/forecast/status` | Model status | — | OK |
| 9 | POST | `/forecast/simulate` | What-if | mutations dict | See BE-2/BE-3 |
| 10 | GET | `/forecast/explain-prescribe` | Unified explain+prescribe | **no `dataset_id` param** | Cannot be dataset-scoped from the FE |
| 11 | GET | `/forecast/explain/{product_id}` | SHAP explanation | **INJECTABLE path param** | BE-1 |
| 12 | POST | `/documents/upload` | PDF → Qdrant | filename only; **no size limit**; no ext check | Saves with original filename |
| 13 | POST | `/documents/search` | Semantic search | `top_k` unbounded | |
| 14 | POST | `/query` | NL2SQL | question body | The critical path (§5.3) |
| 15 | POST | `/ingest/csv` | Dynamic schemaless ingest | ext only | BE-7 |

**API-design issues:** 6 of 15 routes are undocumented in the spec; `GET /data/{entity_type}` returning 404 for an empty table conflates "not found" with "empty"; `/forecast/explain-prescribe` and `/forecast/explain` both mount under `prefix="/forecast"` with overlapping tags; `ingestion_router` returns a bare dict (no envelope) while everything else uses `SuccessResponse` — the frontend had to compensate (`ingestCsv` returns `data` not `data.data`). **CONFIRMED**

---

## 10. Database Audit

**Engine:** PostgreSQL 15 via SQLAlchemy 2 async (`asyncpg`), `NullPool` under test, pool 5/overflow 10 otherwise. **CONFIRMED**

**Modeled schema (`infrastructure/database/models.py`, 10 tables):** `dataset_metadata`, `upload_records`, `suppliers`, `products`, `customers`, `sales`, `daily_business_telemetry`, `inventory`, `documents`, `shap_cache`.

| Property | Status | Evidence |
|---|---|---|
| Primary keys | UUID PKs on all modeled tables | `models.py:25-228` |
| Foreign keys | Present with CASCADE/SET NULL | `models.py:66-203` |
| CHECK constraints | `entity_type` enum, `status` enum, `rating 0–5`, `quantity ≥ 0` | `models.py:39,45,75,193` |
| Indexes | On FKs and common filters (`name`, `category`, `sale_date`, `created_at`) | `models.py` |
| **ORM relationships** | **None defined** — `relationship` imported but never used; all joins manual | `models.py:20` |
| **`daily_business_telemetry.date` is `String(50)`, not `Date`** — and is the PK | design smell | `models.py:168-178` |
| **Duplicated telemetry schema** — `sales.marketing_spend`/`supplier_lead_time_days`/`competitor_discount_pct` duplicate `daily_business_telemetry` | denormalization | `models.py:158-160` |
| **Dynamic `dataset_<hex8>` tables have NO primary key, NO index, NO constraints** — created by pandas `to_sql` | **CONFIRMED** | `ingestion.py:211-218` |
| **No `total_amount = quantity × unit_price` integrity check** | | `models.py:136-165` |
| **Missing indexes** on `sales.product_name`/`category` despite search + GROUP BY | | `repository.py:274,404,408` |

**Query-pattern issues:** N+1 in `get_table_schemas` (BE-10); unbounded `LIMIT`-less aggregation in `get_summary_metrics` timeline; `RowValidator.validate` uses `df.iterrows()`; `save_entities` uses `add_all`+`flush` in batches of 1000 without `executemany`/`fast_executemany`. **CONFIRMED**

**Migrations:** 2 linear revisions (`599d9b819ad8` initial, `59156b6e1509` align_sales_and_telemetry). `alembic/env.py` sets the URL from settings and **prints `LOADED DATABASE URL: <url with password>` to stdout** on every migration run — a secret-leak into logs. **CONFIRMED** (`alembic/env.py:33`). The promised post-migration `GRANT SELECT` to `cognitwin_readonly` does not exist anywhere. **CONFIRMED**

**Transactions:** UoW commits on clean exit / rolls back on exception — correct pattern; repository only `flush()`es. See BE-8 for the one place this is violated (dynamic path bypasses UoW entirely).

---

## 11. AI / ML Audit

### 11.1 Reality vs. marketing — **the headline finding**

| Claimed | Actual | Verdict |
|---|---|---|
| "Integrated **TreeSHAP** engine" | `shap` is **not in `requirements.txt`, not installed in the venv, and never imported**. `ShapEngine` reads Prophet's `predict()` output columns (`trend`, `yearly`, `weekly`, `extra_regressors_*`) and converts each component value into a "% of predicted value" contribution, then relabels with friendly descriptions. | **CONFIRMED INACCURATE** |
| "Scikit-Learn" | 0 references | **CONFIRMED INACCURATE** |
| "LangChain / Prompt Templates" | 0 references; prompts are inline f-strings | **CONFIRMED INACCURATE** |
| "90-day predictive confidence intervals" | `interval_width=0.80` → 80% intervals; horizon cap 90 days | **PARTIALLY ACCURATE** |

This matters: the "SHAP" numbers are **Prophet additive-component decompositions expressed as percentages of `yhat`**, not Shapley values. For multiplicative seasonality (which is configured) the components are *multiplicative factors*, so summing/percentaging them against `yhat` is mathematically approximate. The resulting "driver contributions" are directionally informative but should not be presented as rigorous causal attribution — and the prescriptive action generator quantifies financial impact from them (`prescriptive_service.py:188-194`).

### 11.2 Model configuration

`Prophet(growth="linear", yearly_seasonality=True, weekly_seasonality=True, seasonality_mode="multiplicative", interval_width=0.80, mcmc_samples=0)` with `add_regressor` for every non-target numeric column. Trained in a thread; serialized via `model_to_json` to `ml_models/<uuid>.json` plus a `model_registry.json`. **CONFIRMED**

### 11.3 AI/ML engineering findings

| # | Finding | Evidence | Severity |
|---|---|---|---|
| ML-1 | **No evaluation whatsoever.** No MAE/MAPE/RMSE computation, no backtesting, no train/validation split, no drift monitoring — despite `presentation.md` devoting slides to MAE/MAPE/RMSE. Model quality is unmeasured. | absence across `infrastructure/ml/`, `services/forecast_service.py` | **High** |
| ML-2 | **Regressors are held constant at the last observed value** across the entire forecast horizon (`future[col] = self._last_regressor_values.get(col)`). Any trend in price/marketing/lead time is flattened; the simulation's "counterfactual" is a step change sustained for N days. | `prophet_forecaster.py:191-194,272-274` | **Medium** |
| ML-3 | **`FORECAST_MIN_DATA_POINTS = 5`** — a 5-row CSV can produce a "trained model" with yearly+weekly multiplicative seasonality, which will badly overfit. | `config.py:36`; `prophet_forecaster.py:98-101` | **Medium** |
| ML-4 | **Process-local model cache breaks multi-worker deployments.** `ProphetForecaster._models` is instance state; `get_forecaster` is a per-request dependency, so each worker (and each request!) may load a different/stale model. `_ensure_model_loaded` re-reads from disk on cache miss, but there is no cross-worker invalidation. | `prophet_forecaster.py:37-85`; `dependencies.py:47-48` | **High** |
| ML-5 | **`model_registry.json` writes are not atomic or locked** — concurrent trains can corrupt the registry (read-modify-write with plain `open()`). | `model_storage.py:41-60` | **Medium** |
| ML-6 | **Retrieval quality is unmeasured** — no retrieval evaluation, no chunking tuning (fixed 500-word/50-overlap), `top_k` 3–4. Embedder is 384-dim `bge-small-en-v1.5`. | `rag_service.py:59-69` | **Medium** |
| ML-7 | **Prompt-injection surface:** user CSV column names and user questions are interpolated directly into LLM prompts (`groq_client.py:41,55,69`; `query_service.py:56`). A hostile CSV header or question can redirect the model. Output is then executed as SQL. | as cited | **Medium** |
| ML-8 | **Hallucination containment is decent where implemented:** `ERROR_CANNOT_ANSWER` sentinel, anti-pollution shield, "answer ONLY from excerpts" instruction, and deterministic fallbacks. But nothing verifies the LLM's *format_answer* claims against `results`. | `query_service.py:372-415`; `groq_client.py:112-114` | **Medium** |
| ML-9 | **Intent classification is keyword-biased first** — "why did revenue drop **file**?" routes to DOCUMENT. The LLM classifier is only consulted after 3 keyword lists, with a 2.5s timeout that always defaults to SQL. | `query_service.py:38-74` | **Low** |
| ML-10 | **Simulation decomposition is heuristic**, not SHAP: `delta_force` falls back to a proportionate split over mutation magnitudes when the regressor column isn't in the Prophet output. | `prophet_forecaster.py:336-344` | **Low** |
| ML-11 | **Fallback prescriptive actions are hardcoded fiction** (₹4.5 Lakh, ₹3.2 Lakh, ₹1.8 Lakh with confidence 0.92/0.86/0.80) presented as analysis when the LLM fails. | `prescriptive_service.py:266-309` | **Medium** |
| ML-12 | **Token usage is unmanaged** — no token counting, no context truncation; `max_tokens=1024` on every call; full schema context (potentially huge for wide tables) is sent verbatim on every `/query`. | `groq_client.py:78,138,162`; `repository.py:657` | **Medium** |

### 11.4 RAG pipeline trace

```
PDF upload → document_router → RAGService.upload_document
  → PyMuPDFExtractor.extract_text (in thread)
  → heuristic classify (invoice/report/contract/general)
  → _chunk_text: 500 words, 50 overlap (plain split)
  → documents table row (UoW, committed)
  → fastembed BAAI/bge-small-en-v1.5 (384-d) → Qdrant upsert (uuid5 deterministic IDs)
Search → query_points(cosine) → VectorSearchResult → ChunkResponse
Answer → top-4 chunks → LLM (3s timeout) with "ONLY from excerpts" instruction
         → fallback: concatenated snippets
```

QdrantVectorStore **silently falls back to an in-memory store** when the server is unreachable (`qdrant_store.py:28-30`) — meaning a misconfigured compose file yields a RAG system that works perfectly but **loses everything on restart**. This is a real operational trap. **CONFIRMED**

---

## 12. Security Audit

*(Non-destructive review only. No exploitation was performed.)*

| ID | Severity | Finding | Evidence | Remediation direction |
|---|---|---|---|---|
| SEC-1 | **CRITICAL** | **SQL injection.** `product_id` (path param) and `forecast_date` (query param) are interpolated into single-quoted SQL literals with zero escaping/parameterization. | `shap_explainer_service.py:48-50`, `:172-174` | Bind parameters (`:pid`); never f-string SQL values. |
| SEC-2 | **HIGH** | **Read-only isolation does not exist.** LLM-generated SQL runs on the read-write engine behind a bypassable blocklist (e.g. `SELECT … INTO` is allowed; trailing `;` allowed; `WITH` prefix allowed). `DATABASE_READONLY_URL` is a *required* setting with zero consumers; the `cognitwin_readonly` role is created without any `GRANT SELECT`; `init_db.sql:13` claims a GRANT that `alembic/env.py` never performs. | `repository.py:769-774`; `config.py:13`; `init_db.sql:1-13`; `engine.py:18-23`; `query_service.py:76-100` | Create a genuine read-only engine + role with GRANTs, or use a SQL allowlist/parser (e.g. `sqlglot` AST validation) instead of a keyword blocklist. |
| SEC-3 | **HIGH** | **No authentication or authorization on any endpoint.** Ingestion, training, simulation, SQL execution, and file upload are fully anonymous. | absence of any auth dependency/middleware | Add API-key/JWT middleware at minimum; separate admin vs viewer roles. |
| SEC-4 | **HIGH** | **CORS wildcard with credentials:** `allow_origins=["*"]`, `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`. The configured `settings.CORS_ORIGINS` list is computed and then **never used**. Combined with SEC-3, any web page can drive this API. | `main.py:24-30` vs `config.py:44-54` | Bind `allow_origins=settings.CORS_ORIGINS`; drop credentials or restrict origins. |
| SEC-5 | **MEDIUM** | **Unbounded file ingestion (DoS).** The `/ingest/csv` path reads the entire upload into memory with no size or row-count check; the 50 MB / 100k-row guards exist only on the *other* pipeline. `/documents/upload` has no size or extension check and writes to `UPLOAD_DIR/<original filename>` (path traversal via `../` in a multipart filename is plausible). | `ingestion.py:198-199`; `document_router.py:22-27` | Enforce limits on both paths; sanitize/save with a generated filename. |
| SEC-6 | **MEDIUM** | **Internal exception text leaked to clients** in every router's catch-all (`"message": str(e)`), exposing stack details, SQL fragments, and driver internals. | all routers | Map to generic messages server-side; log details with `request_id`. |
| SEC-7 | **MEDIUM** | **Secret printed to stdout on every migration:** `print("LOADED DATABASE URL:", settings.DATABASE_URL)`. | `alembic/env.py:33` | Remove or redact. |
| SEC-8 | **MEDIUM** | **No rate limiting** despite config and spec; `/query` can trigger 3+ LLM calls per request — trivially abusable cost/DoS vector. | `main.py`; `config.py:39-40` | Add `slowapi`/nginx limits per spec. |
| SEC-9 | **LOW** | **Table-name collision → silent data destruction.** `uuid4().hex[:8]` (32-bit) + `if_exists='replace'` can DROP another tenant's table; the UNIQUE constraint then turns the metadata insert into a 500. | `ingestion.py:211-218` | Use full UUID hex; check existence first. |
| SEC-10 | **LOW** | **Duplicated live-format credential.** A real-format `gsk_…` key is present in **two byte-identical untracked files** (`/.env` and `backend/.env`); `config.py:56` reads `("../.env", ".env")`, so the root copy silently backs up the backend one. Not in git history, but the duplication widens the accidental-exposure surface. | filesystem + `config.py:56` | Keep one `.env`; rotate the key if it was ever committed anywhere. |
| SEC-11 | **LOW** | **CSRF:** with `allow_credentials=True` and no CSRF protection, state-changing POSTs (`/upload`, `/ingest`, `/forecast/train`) are cross-site forgeable from any allowed origin — i.e., everywhere, given SEC-4. | `main.py:24-30` | Restrict origins; add CSRF tokens for cookie auth. |
| SEC-12 | **INFORMATIONAL** | The in-memory Qdrant fallback means embeddings may silently live in RAM (lost on restart). | `qdrant_store.py:28-30` | Fail loudly if the configured store is unreachable. |
| SEC-13 | **INFORMATIONAL** | Positive: CSV-injection sanitizer exists; `.env` files are correctly git-ignored and **no secrets are tracked in git** (verified: only `backend/.env.example` matches `.env` in `git ls-files`); error boundary prevents full-page crashes. | `data_cleaner.py:267-272`; `.gitignore`; `CyberneticErrorBoundary.tsx` | — |

---

## 13. Performance Audit

### Current optimizations (evidence-backed)

- `asyncio.to_thread` for Prophet fit/predict, PDF extraction, embedding, and vector I/O — keeps the event loop responsive. **CONFIRMED**
- `asyncio.wait_for` timeouts on every external call. **CONFIRMED**
- SHAP explanation caching in `shap_cache` table. **CONFIRMED**
- Vector store singleton (`_vector_store_instance`). **CONFIRMED**
- Frontend: chart data slicing (`cleaned_data[:10/15/50]`), `useMemo` for pie aggregation, `ParentSize` debounce, `output: 'standalone'` for Docker. **CONFIRMED**
- `uncertainty_samples = 0` during simulation for faster predict. **CONFIRMED**

### Bottlenecks

| Area | Finding | Evidence | Class |
|---|---|---|---|
| **DB** | `get_table_schemas` performs ~1–2 queries **per column per table** and runs on **every** `/query`; wide datasets make this the dominant latency term. | `repository.py:657-767` | **High** |
| **DB** | Dynamic `dataset_*` tables have no PK/index — every summary/forecast aggregation is a full scan on a growing table. | `ingestion.py:211-218` | **High** |
| **DB** | Timeline aggregation has no LIMIT; years of daily rows returned. | `repository.py:542-550` | **Medium** |
| **DB** | `df.iterrows()` row validation; `add_all`+`flush` without `executemany`. | `row_validator.py:29`; `ingestion_service.py:91-94` | **Medium** |
| **LLM** | Chained sequential LLM calls (up to 6 on FUSED paths); schema context re-fetched per request; no response caching for repeated questions. | `query_service.py:348-419,562-606` | **High** |
| **LLM/ML** | `/query` EXPLAIN/SIMULATION paths can trigger full forecast + SHAP + 2 LLM calls *per question*. | `query_service.py:460-560,698-814` | **High** |
| **CPU** | Date parsing: up to 30 values × 28 formats ≈ 840 `strptime` per date column; mitigated by voting short-circuit. | `data_cleaner.py:193-205` | **Medium** |
| **Frontend** | 38/43 components are client components; no RSC data fetching; no `React.memo` on charts; whole-page framer-motion containers re-render children per state tick. | `frontend/src/**` | **Medium** |
| **Frontend** | Always-on loops: 1s `setInterval` clock in header (no visibility check), persistent rAF on `/` and `/forecast`, toast on every online toggle incl. mount. | `ObservatoryHeader.tsx:34`; `VolumetricTwinNode.tsx:105`; `EnlargedThreadCanvas`; `CyberneticToast.tsx:57-73` | **Medium** |
| **Frontend** | Refetch cascade risk: `fetchState` depends on object references (`activeDataset`, `activeSummary`) whose identity changes on provider re-renders. | `forecast/page.tsx:146` | **Medium** |
| **Frontend** | Dead heavy deps inflate installs (three.js + drei + postprocessing + gsap); two chart libraries ship. | `package.json` | **Low** |
| **ML** | Prophet training is synchronous per request; no model warm-pool or background queue; `mcmc_samples=0` (fast). | `forecast_service.py:102` | **Medium** |

---

## 14. Dependency Audit

### Backend (`requirements.txt`, 21 lines, all `>=` floors)

All listed packages are **used** except: `google-generativeai` (dead `GeminiClient`), `psycopg2-binary` (used implicitly by pandas `to_sql` sync path — keep), and `chardet` (only referenced via the typed parser path). **CONFIRMED**

Notable absences: no `shap` (despite README), no `scikit-learn` (despite README), no `langchain` (despite README), no `redis`/`celery`, no `slowapi`, no `sqlglot`.

`backend/pyproject.toml` dev extras **omit `pymupdf`, `qdrant-client`, and `fastembed`**, which `tests/integration/test_chaos_ingestion.py` imports — `pip install -e .[dev]` alone cannot collect that test. **CONFIRMED**

### Frontend (`package.json`)

| Dependency | Status | Evidence |
|---|---|---|
| `shadcn` | **Wrong section + unused** — a CLI scaffolder listed in `dependencies` | `package.json:41` |
| `playwright` | **In `dependencies`, zero e2e tests** | `package.json:37` |
| `gsap` | **0 imports** | import grep |
| `d3-scale`, `d3-interpolate-path`, `@visx/pattern`, `@react-three/drei` | **0 imports** | import grep |
| `three`, `@react-three/fiber`, `@react-three/postprocessing` | only reachable via **dead** `webgl/*` (and `transpilePackages` config is therefore pointless) | `next.config.ts:5-10` |
| `@base-ui/react`, `class-variance-authority` | only via dead `button.tsx`/`card.tsx` | import grep |
| `framer-motion` | heavily used (24 files) — largest runtime cost | import grep |
| **Both** `visx` (7 pkgs) **and** `recharts` | both live | import grep |
| `lucide-react` `^1.26.0` | suspiciously old major for React 19 — worth verifying, but no runtime issue observed | `package.json:35` |

Version-consistency issues: `next 16.2.11` vs README badge "15.1"; `jest@30` with `ts-jest@29` (mismatched majors, works here); `react 19.2.4` with `@types/react ^19` (fine).

---

## 15. Code Quality Audit

**Readability:** generally good — small, focused modules; consistent docstrings; clear naming. The service layer is the strongest part.

**Concrete issues:**

| # | Issue | Evidence |
|---|---|---|
| CQ-1 | **God components** — 10 files >350 lines, led by `ingest/page.tsx` (762) | §6.3 |
| CQ-2 | **Two parallel ingestion stacks** with duplicated cleaners, validators, mappers, upload limits, exception classes (`FileValidationError` defined twice in two hierarchies), and 3 separate "latest dataset" lookups | `services/ingestion.py` vs `services/ingestion_service.py`; `domain/exceptions.py:19` vs `infrastructure/ingestion/exceptions.py:5` |
| CQ-3 | **Redundant re-export shim:** `services/data_cleaner.py` is a 17-line pass-through | `services/data_cleaner.py` |
| CQ-4 | **Typing debt:** 9 `any` API returns; `ShapExplainerService.__init__` has `forecaster: Forecaster = None` (should be `Optional[...]`); backend uses `Dict`/`List` typing imports in some files and builtins in others | `api.ts`; `shap_explainer_service.py:27`; `query_service.py:6` |
| CQ-5 | **79 ESLint errors + 70 warnings** unaddressed (mostly `no-explicit-any`, `set-state-in-effect`, unused vars) | `eslint` run |
| CQ-6 | **Protocol drift** between interfaces and implementations (not runtime-enforced) | `domain/interfaces/repository.py:34-38` |
| CQ-7 | **Private-attribute access** across layer boundaries | §5.2 A5 |
| CQ-8 | **Magic literals repeated across 3+ files** (`51280`, `5482920`, `432 + stress*3.5`) | §6.5 |
| CQ-9 | **Three conflicting elasticity models** | §6.5 |

**Strengths:** consistent error envelope; value-object/entity separation; every LLM call wrapped in timeout+fallback; `domain/exceptions` hierarchy is coherent; frontend design tokens are centralized in `globals.css` `@theme` + `chartTheme.ts`.

---

## 16. Dead Code / Unused Features

### Backend — CONFIRMED dead

- `infrastructure/llm/gemini_client.py` — `GeminiClient` referenced only by its own definition; never wired in `dependencies.py`.
- `config.py:13` `DATABASE_READONLY_URL` — required setting, zero consumers.
- `repository.py:769` `execute_readonly_sql(..., limit=1000)` — `limit` never used.
- `infrastructure/ingestion/engine.py::IngestionEngine` — stub whose docstring says the pipeline is "not fully implemented yet".
- `infrastructure/ingestion/validators.py::validate_file` — only caller is the dead `IngestionEngine`.
- `domain/value_objects/ingestion_result.py::IngestionResult` — only used by dead `IngestionEngine`.
- `models.py:20` `relationship` import — never used; `DailyBusinessTelemetryModel` — defined and migrated but never selected/inserted.
- `services/data_cleaner.py` — re-export shim.
- `api/routers/ingest.py` — 5-line backward-compat re-export, redundant with `ingestion_router.py`.
- `infrastructure/ingestion/schema_mapper.py:5` unused `import pandas as pd`; `services/ingestion.py:6` unused `Dict`/`List`.

### Frontend — CONFIRMED dead (never imported anywhere)

`components/webgl/` (whole tree: `WebGLBackground`, `SignalStreams`); the cursor system (`CustomCursor`, `CursorContext`, `MagneticElement`); 4 card primitives (`SpotlightCard`, `PremiumGlassCard`, `BentoCard`, `VolumetricCard`); 2 KPI cards (`KPITile`, `GlassKPICard`); `ShapExplanationPanel`; shadcn `button.tsx` + `card.tsx`. Dead exports: `getEntityData`, `uploadFile`, `getExplanation`, `ingestCsv`, `refreshDatasets`/`refreshSummary`, `generateProphetForecast` (imported, never called), `ZeroDataFallback`, `queryHistory` state, `DEMO_SUMMARY_FALLBACK`.

### Repo-level orphans — CONFIRMED

`CogniTwin/` legacy Reveal.js deck (zero inbound references, **~4.4 MB of byte-identical duplicated images**); `benchmark.py`; `generate_dataset.py` (output used by tests, generator orphaned); `dummy_sales.sql`; `docs/generate_dataset.py` + `docs/sample_dataset_1000.csv` (no consumer); `backend/test_supplier_contract.txt` (duplicate of an untracked uploads copy); 16 untracked root PNGs (properly ignored).

### Stale markers

- `TODO/FIXME` density is low — the codebase is notably free of inline TODOs.
- `docs/phase1/FUTURE_TASKS.md` correctly lists RAG/agents/Celery as deferred — but RAG **is** implemented, so that doc is stale too.
- `AUDIT_PROPOSAL_AND_ROADMAP.md` (git-ignored) is a **prior audit whose headline "critical bugs" are already fixed** in the current code (SaleModel restored, prescriptive service wired, no synthetic column pollution). Treat as historical.

---

## 17. Testing Audit

### Commands run and results (read-only)

| Command | Result |
|---|---|
| `pytest backend/tests/unit -q` | **44 passed**, 1 warning (`datetime.utcnow` DeprecationWarning in test), 0.91 s |
| `tsc --noEmit -p frontend/tsconfig.json` | **PASS** (no output) |
| `eslint frontend/src` | **149 problems: 79 errors, 70 warnings** |
| `jest` (frontend) | **2 suites failed, 5/5 tests failed** (45 s) |
| `python -c "from src.main import app"` | **IMPORT_OK** (`CogniTwin AI Phase 1`) |
| `python -c "import shap"` | **ModuleNotFoundError** (confirms ML-1) |

### Backend suite (67 tests, 19 files)

- **44 unit tests across 9 files — genuinely standalone, all passing.** Strong coverage of the deterministic fallbacks (`test_hardened_pipeline.py` 8 tests, `test_query_service.py` 9 tests).
- **23 integration tests — every one requires live PostgreSQL**; several additionally require Qdrant, a pre-trained model, real LLM keys, or root CSVs. There is **no SQLite test override** despite `aiosqlite` being a dependency, and `conftest.py` provides **none** of the fixtures the testing-strategy doc promises (`test_db_session`, `test_client`, `mock_llm_client`).
- **Config gate:** `Settings` has two required fields with no defaults, so **not a single test can even be collected without a populated `.env`**. CI without secrets would collect zero tests.
- `backend/scripts/run_tests.py` is **not a pytest suite** — it hits a *live* server over HTTP and writes `test_report.json`; it also targets the older `/upload/sales` route.
- `backend/tests/test_data/` is an **empty directory**; the 10 named CSV fixtures the docs describe do not exist.

### Frontend suite

- 2 files, 5 tests, **all failing** — they assert against UI copy from a previous iteration: "Retrain Model" (actual: "Retrain"/"Re-fit model"), "Fitting Tensor..." (actual: "Fitting"), "Intelligence Command Console" (actual: "Ask the analyst"), "EXEC" (actual: "Run"), "Executive Strategic Insights" (actual: "Executive insights"), "Prioritized Prescriptive Action Plan" (actual: "Prescriptive action plan"), "ACTIVE TWIN:" (does not exist). **CONFIRMED by running them.**
- Coverage gaps: `dashboard`, `ingest`, `DatasetContext`, `api.ts`, `formatters`, and every chart/slider/card component. No e2e despite `playwright` installed.

**Testing maturity: low-to-moderate.** The unit layer is genuinely good (44 fast, isolated, meaningful tests covering the hardest logic). The integration layer is environment-coupled by design, the frontend suite is red, and there is no CI configuration anywhere in the repo.

---

## 18. Build / Runtime Audit

### Backend

- **Module import: OK** (`from src.main import app` succeeds; only a benign plotly warning).
- **Unit tests: OK.**
- `main.py` runs uvicorn with `reload=True` when executed directly — a dev-only entrypoint; the Dockerfile should use a production invocation.
- `docker-compose.yml`: **obsolete `version: '3.8'` key**; `backend` `depends_on` includes only `db` (**not** `qdrant`, which is why the in-memory fallback exists); `./backend/src` is bind-mounted (dev-only, invalidates image layering); DB password defaults to `postgres`; healthcheck calls the mock `/health`.
- **Alembic prints the DB URL on migration** (SEC-7).

### Frontend

- **`tsc --noEmit`: PASS.** **`.next/BUILD_ID` present** — the app has built successfully before. Compiled CSS inspected successfully.
- **`eslint`: FAILING (79 errors)** — lint is not gated.
- **`jest`: FAILING (5/5).**
- Env wiring is broken in both directions (§6.2): the set var is unread, the read var is unset.
- `output: 'standalone'` + `Dockerfile` is the correct production shape.

### Docker quickstart status

`docker compose up --build` would start all four services, but (a) the frontend build needs `BACKEND_API_URL` (unset → falls back to `http://backend:8000/api/v1`, which is correct by luck), (b) `cp frontend/.env.local.example frontend/.env.local` **fails — that file does not exist in a fresh clone** (it is git-ignored and untracked), and (c) migrations must be run manually (no entrypoint does so). **The documented Quickstart is partially broken.** **CONFIRMED**

---

## 19. Git / Project Hygiene Audit

*(No git state was altered.)*

| Check | Status |
|---|---|
| Branch | `main`, **12 commits ahead of `origin/main`** — work is unpushed |
| Working tree | **22 modified files, 1 deleted (`MULTI_AGENT_SYSTEM_PLAN.md`), 6 untracked** (new `ui/KpiCard.tsx`, `ui/Panel.tsx`, `ui/SectionHeader.tsx`, `ui/SegmentedTabs.tsx`, `ui/TraceMark.tsx`, `lib/chartTheme.ts`) |
| Diff scale | ~2,336 insertions / ~2,443 deletions across frontend + `query_service.py` + `test_chaos_ingestion.py` — a large in-flight UI/UX refactor |
| Line endings | CRLF/LF warnings on most modified frontend files (no `.gitattributes`) |
| Tracked secrets | **None** — `git ls-files | grep .env` returns only `backend/.env.example` (placeholders) |
| `.gitignore` quality | **Good** — `.env*`, `.venv`, `__pycache__`, `.pytest_cache`, `node_modules`, `.next`, `qdrant_data`, `uploads`, `ml_models`, `test_artifacts`, `/*.png` all covered |
| **Gitignore bug** | `frontend/.env.local.example` is **untracked AND ignored** — the root negation `!frontend/.env.local.example` is defeated by `frontend/.gitignore:34` `.env*` (deeper file wins). The template the README tells users to copy cannot exist in a clone. |
| Large tracked files | None >1 MB; largest is `assets/architecture.jpg` (866 KB). 16 files >500 KB, mostly images. |
| Duplicated binaries | **~4.4 MB** — the 6 JPGs in `CogniTwin/assets/` are **byte-identical** to `assets/` |
| Accidental artifacts | 53 Prophet JSONs + registry in `backend/ml_models/` (ignored); embedded Qdrant sqlite (ignored); `test_artifacts/` with an orphan CSV+PDF (ignored) |
| CI/CD | **None exists** — no `.github/`, no Gitlab config, no pre-commit hooks |

---

## 20. Functionality Status Matrix

| Feature | Status | Evidence |
|---|---|---|
| Typed CSV upload (`/upload/{entity_type}`) | **FULLY WORKING** | `upload_router.py` + `IngestionService`; tested by `test_ingestion_service.py` |
| Dynamic schemaless CSV ingest (`/ingest/csv`) | **PARTIALLY WORKING** | Works end-to-end, but no size limits (BE-7), split transaction (A7), and the LLM semantic step fails over to deterministic mapping |
| Dashboard summary & pagination (`/data/*`) | **FULLY WORKING** | `data_router.py` + `WarehouseService`; 404-on-empty is an API smell |
| Prophet training (`/forecast/train`) | **FULLY WORKING** | `forecast_service.py:19-114`; dataset-scoped; tested by `test_dataset_aware_simulation.py` |
| Forecast prediction (`/forecast/predict`) | **FULLY WORKING** | Regressors flat-extrapolated (ML-2) |
| What-if simulation (`/forecast/simulate`) | **FULLY WORKING** | Multi-lever mutation; tested by `test_simulate.py` |
| "SHAP" explainability (`/forecast/explain/{id}`) | **PARTIALLY WORKING** | Returns Prophet component decomposition, not Shapley values (ML-1); **injectable path param (SEC-1)** |
| Explain + Prescribe (`/forecast/explain-prescribe`) | **PARTIALLY WORKING** | Router accepts **no `dataset_id`**, so it cannot be dataset-scoped from the frontend |
| NL2SQL query (`/query`) | **PARTIALLY WORKING** | Works with strong fallbacks, but runs on RW engine (SEC-2) with a bypassable blocklist; chart synthesis is good |
| Intent classification | **PARTIALLY WORKING** | Keyword-first bias (ML-9); 2.5s LLM timeout |
| RAG document upload + search | **PARTIALLY WORKING** | Functions; silently degrades to **in-memory** Qdrant (data loss on restart) |
| PDF parsing | **FULLY WORKING** | PyMuPDF extractor; used by `test_chaos_ingestion.py` |
| Prescriptive actions | **PARTIALLY WORKING** | LLM-generated with **hardcoded fake fallbacks** presented as analysis (ML-11) |
| Anomaly detection | **FULLY WORKING** | Simple, well-defined rule (`prescriptive_service.py:126-161`) |
| Rate limiting | **NOT IMPLEMENTED** | Config present; no middleware (BE-5) |
| Authentication / authorization | **NOT IMPLEMENTED** | SEC-3 |
| Read-only SQL replica | **NOT IMPLEMENTED** | SEC-2 (config + SQL role exist; never connected) |
| Health checks | **PARTIALLY WORKING** | Mock statuses for DB and LLM (BE-9) |
| Undo upload (documented in spec) | **NOT IMPLEMENTED** | `docs/phase1/03-DATABASE-SCHEMA.md` describes it; no endpoint/service/repository function |
| Frontend landing/dashboard/forecast/query/ingest | **PARTIALLY WORKING** | Render and typecheck fine; silently fall back to fabricated demo data on backend error |
| Frontend test suite | **BROKEN** | 5/5 fail against stale UI copy |
| Lint | **BROKEN** | 79 errors |
| Legacy `CogniTwin/` static deck | **DEPRECATED** | Zero inbound references |
| `GeminiClient` | **DEAD** | Never wired |
| Three.js / WebGL visuals | **DEAD** | `webgl/*` never rendered |
| Playwright e2e | **NOT IMPLEMENTED** | Dependency installed, no tests |

---

## 21. Issue Register

| ID | Area | Severity | Finding | Evidence | Impact | Recommendation |
|---|---|---|---|---|---|---|
| SEC-1 | Security | **CRITICAL** | SQL injection via `product_id`/`forecast_date` | `shap_explainer_service.py:48-50,172-174` | Arbitrary SQL, data exfiltration/destruction | Bind parameters immediately |
| SEC-2 | Security/DB | **HIGH** | Read-only isolation fictional; LLM SQL on RW engine | `repository.py:769-774`; `init_db.sql`; `engine.py` | Data loss / tampering via LLM output | Real RO role+engine or AST validation |
| SEC-3 | Security | **HIGH** | No authn/authz on 15 endpoints | `main.py`, `dependencies.py` | Full anonymous control | Add auth middleware |
| SEC-4 | Security | **HIGH** | CORS `*` + credentials; `CORS_ORIGINS` unused | `main.py:24-30` | Cross-site API abuse | Bind to `settings.CORS_ORIGINS` |
| BE-1 | Security | (see SEC-1) | — | — | — | — |
| BE-7 | Backend | **MEDIUM** | No upload limits on `/ingest/csv` | `ingestion.py:198` | OOM/DoS | Enforce `MAX_UPLOAD_*` |
| BE-8/SEC-9 | Backend | **MEDIUM** | 32-bit table-name entropy + `replace`; orphaned tables | `ingestion.py:211-230` | Silent cross-dataset destruction | Full UUID; existence check |
| BE-9 | Deployment | **MEDIUM** | Health check is a mock | `health.py` | False-green orchestration | Real DB/LLM pings |
| BE-10 | Performance | **MEDIUM** | N+1 in `get_table_schemas` per query | `repository.py:657-767` | Latency scales with width | Cache schema per dataset |
| ML-1 | AI/ML | **HIGH** | "TreeSHAP" is not SHAP; no `shap` lib | `requirements.txt`; `shap_engine.py` | Misleading attribution/claims | Rename or implement real SHAP |
| ML-4 | AI/ML | **HIGH** | Process-local model cache breaks multi-worker | `prophet_forecaster.py:37-85` | Wrong/stale forecasts at scale | Shared store + invalidation |
| ML-5 | AI/ML | **MEDIUM** | Non-atomic registry writes | `model_storage.py:41-60` | Registry corruption | Atomic temp-file write + lock |
| ML-7 | AI/ML | **MEDIUM** | Prompt-injection surface (CSV headers, questions) | `groq_client.py:41,55,69` | Redirected SQL generation | Sanitize + validate output |
| ML-11 | AI/ML | **MEDIUM** | Hardcoded fake prescriptive fallbacks | `prescriptive_service.py:266-309` | Fabricated financial advice | Mark as "unavailable" instead |
| UX-1/2/3 | UX | **HIGH** | Failures reported as success; fabricated data | `ingest/page.tsx:179-219,556-591` | Loss of trust; decisions on fake numbers | Surface errors honestly |
| UX-5 | UX/Frontend | **MEDIUM** | Explain/prescribe ignores active dataset | `forecast/page.tsx:126` | Cross-dataset confusion | Pass `datasetId` |
| FE-1 | Frontend | **HIGH** | Rules-of-Hooks violation in `DynamicChartRenderer` | `DynamicChartRenderer.tsx:113-133` | Runtime crash on data transition | Move hooks before any return |
| FE-2 | Frontend | **HIGH** | Entire FE test suite red | `tests/*.tsx` (5/5 fail) | No regression safety net | Fix or rewrite tests |
| FE-3 | Frontend | **MEDIUM** | 79 ESLint errors unaddressed | `eslint` run | Type/quality drift | Gate lint in CI |
| FE-4 | Frontend | **MEDIUM** | Undefined CSS classes `obsidian-panel`, `border-hairline-signal` | `ingest/page.tsx:44,750`; compiled CSS = 0 | Missing backgrounds/amber borders | Define tokens or switch classes |
| FE-5 | Frontend | **MEDIUM** | 3 conflicting elasticity models | `dashboard:71`; `forecast:193-200`; `WhatIfSimulator:157-160` | Inconsistent numbers across pages | Single shared model |
| FE-6 | Frontend | **LOW** | USD/INR currency mixing | `formatters.ts` vs `DynamicChartRenderer`/`KpiCard` | Unprofessional output | One currency config |
| DOC-1 | Docs | **MEDIUM** | 6 of 15 routes undocumented | `04-API-SPECIFICATION.md` vs `router.py` | Onboarding confusion | Regenerate from OpenAPI |
| DOC-2 | Docs | **MEDIUM** | README tech claims inaccurate (SHAP, sklearn, LangChain, Next 15.1) | `README.md:8,92,96` | Credibility/mishire risk | Correct README |
| DOC-3 | Docs | **MEDIUM** | Testing-strategy doc is aspirational | `11-TESTING-STRATEGY.md` | False test-quality impression | Align doc with reality |
| TEST-1 | Testing | **HIGH** | Tests cannot be collected without `.env`; no CI | `config.py:12-13`; no `.github/` | Zero regression protection in CI | Defaults for test profile; add CI |
| TEST-2 | Testing | **MEDIUM** | `pyproject.toml` dev extras missing pymupdf/qdrant/fastembed | `pyproject.toml` | Broken dev installs | Sync with `requirements.txt` |
| HYD-1 | Hygiene | **MEDIUM** | 12 unpushed commits + 22-file uncommitted refactor | `git status/log` | Single-point-of-loss of work | Push + commit or stash |
| HYD-2 | Hygiene | **LOW** | `frontend/.env.local.example` untrackable | `frontend/.gitignore:34` defeats negation | Broken README quickstart | Force-add or fix pattern |
| HYD-3 | Hygiene | **LOW** | ~4.4 MB duplicated tracked images; orphaned legacy deck | `CogniTwin/assets/` (SHA-256 identical) | Repo bloat | Delete duplicates |
| DEP-1 | Dependencies | **MEDIUM** | `shadcn`/`playwright` in `dependencies` and unused; `gsap`/`d3-scale`/`d3-interpolate-path`/`@visx/pattern`/`drei` unused | `package.json` + import grep | Install size, confusion | Remove or move |
| DEP-2 | Dependencies | **LOW** | Backend `>=` floors; 4 packages unpinned | `requirements.txt` | Non-reproducible builds | Pin/lockfile |

---

## 22. Risk Register

### Immediate Risks (could cause failure or serious operational issues now)

1. **SEC-1 — exploitable SQL injection on a public-facing endpoint.** `shap_explainer_service.py:48-50,172-174`. Consequence: arbitrary SQL with write privileges (given SEC-2/SEC-3, completely unauthenticated). Affected: `/forecast/explain/{product_id}`, `/query` (EXPLAIN path).
2. **Unauthenticated, CORS-open API.** Any deployed instance is fully controllable by anyone who can reach it, including file upload and model training. Affected: all 15 endpoints.
3. **Frontend test suite is red and lint is failing** — any change right now is unverifiable.
4. **12 unpushed commits + a 22-file uncommitted refactor** — the only copy of substantial work lives on one workstation.

### Near-Term Risks (likely painful soon)

5. **Silent demo-mode regressions:** as the backend moves, fabricated data (`51280`, fake contracts, fake PDF-index success) will increasingly diverge from reality, and users will not be able to tell.
6. **Qdrant in-memory fallback** — a compose/network hiccup silently switches RAG to RAM; all embeddings vanish on restart.
7. **Orphaned-table accumulation** — split transaction + `if_exists='replace'` will leak and occasionally destroy dynamic tables.
8. **Model registry corruption** — non-atomic writes under concurrent training.
9. **`get_table_schemas` cost** — as datasets widen, `/query` latency will degrade super-linearly.

### Long-Term Risks (scalability / maintainability / operational)

10. **Multi-worker deployment breaks forecasting** — process-local `_models` cache means different workers serve different model states; horizontal scaling silently breaks dataset isolation.
11. **Two parallel ingestion stacks** — every future feature must be implemented twice; drift between them is already visible (limits, exceptions, metadata models).
12. **No evaluation or monitoring** — there is no way to know whether forecasts are any good; ML quality is unverifiable and will drift undetected.
13. **No authn/rate-limiting/queue architecture** — the synchronous 3–6-LLM-call `/query` chain is a cost and availability liability under any real load.
14. **Unindexed, unconstrained dynamic tables** — storage grows monotonically with every upload; query cost grows with it.
15. **Documentation rot** — specs already contradict the implementation (SQLite vs Postgres, 9 vs 15 endpoints, fictional test fixtures, inaccurate README tech claims), which will mislead any new contributor.

---

## 23. Strengths

Backed by concrete evidence only:

1. **Degradation-first LLM engineering.** Every LLM call has both an `asyncio.wait_for` timeout *and* a deterministic non-LLM fallback (intent → SQL; SQL → schema-aware generator; answer → markdown table; SHAP text → templated drivers; RAG → concatenated snippets; levers → regex parser). The system keeps functioning with a dead/absent API key. `query_service.py:60-74,360-415`; `shap_explainer_service.py:141-149`; `rag_service.py:43-55`.
2. **Anti-pollution shield** — LLM-proposed column roles are re-validated against real DataFrame columns and dtypes, pruning hallucinated names and backfilling deterministically, with 8 unit tests locking the behavior. `services/ingestion.py:131-194`; `tests/unit/test_hardened_pipeline.py`.
3. **Dataset isolation model** for forecasting/simulation/status is consistently threaded through config → service → forecaster → storage registry (`by_dataset` index).
4. **Coherent error architecture** — a typed domain exception hierarchy mapped to a uniform JSON envelope with request-ID tracing in structured logs. `domain/exceptions.py`; `main.py:32-89`; `infrastructure/logging/setup.py`.
5. **Correct dependency direction** for a hexagonal layout; no domain→infrastructure imports.
6. **44 fast, isolated, meaningful unit tests** covering the hardest logic (numeric/date cleaning, schema mapping, chart synthesis, lever parsing) — they pass in 0.91 s.
7. **TypeScript compiles clean** (`tsc --noEmit` passes) and the app builds.
8. **Accessibility primitives are above average** — ARIA roles/labels on charts, live regions, focus-visible outlines, keyboard shortcuts, AA-contrast text.
9. **Distinctive, high-craft visual design** with a centralized token system (`@theme` + `chartTheme.ts`) — not templated.
10. **CSV-injection sanitization** and chunked upload streaming on the typed path; temp files cleaned in `finally`.
11. **No secrets in git history**, and `.gitignore` coverage is genuinely thorough.

---

## 24. Prioritized Improvement Plan

*(Recommendations only — nothing was modified.)*

### P0 — Critical (fix immediately)

| # | Action | Files | Why | Benefit | Complexity |
|---|---|---|---|---|---|
| P0-1 | **Parameterize the SHAP-path SQL.** Replace the two f-string literals with bound parameters. | `shap_explainer_service.py:48-50,172-174` | SEC-1, actively exploitable | Closes a CRITICAL hole | Trivial |
| P0-2 | **Bind CORS to `settings.CORS_ORIGINS`** and drop `allow_credentials` (or restrict origins). | `main.py:24-30` | SEC-4 | Removes cross-site API abuse | Trivial |
| P0-3 | **Add minimal auth** (API-key middleware at minimum) to all routes except `/health`. | `main.py`, new middleware | SEC-3 | Prevents anonymous control | Low |
| P0-4 | **Implement real read-only enforcement**: create the RO engine bound to `DATABASE_READONLY_URL`, `GRANT SELECT` in a migration, and route `execute_readonly_sql` through it; optionally validate SQL with an AST parser instead of the blocklist. | `engine.py`, `session.py`, `repository.py:769`, new migration, `init_db.sql` | SEC-2 | Makes the "read-only" claim true | Medium |
| P0-5 | **Enforce upload limits on `/ingest/csv`** (size + rows), and generate safe filenames for `/documents/upload`. | `ingestion_router.py`, `document_router.py:22-27`, `ingestion.py:198` | BE-7/SEC-5 | Removes OOM/traversal exposure | Low |
| P0-6 | **Push the 12 unpushed commits** and commit/stash the in-flight refactor. | git | HYD-1 | Eliminates single-point work loss | Trivial |

### P1 — High (fix soon)

| # | Action | Files | Why | Benefit | Complexity |
|---|---|---|---|---|---|
| P1-1 | **Stop reporting failures as success.** Show real error states on ingest/search; add a visible "demo data" badge wherever fallbacks are used. | `ingest/page.tsx:179-219,556-591`; `forecast/page.tsx`; `DatasetContext.tsx` | UX-1/2/3/4 | User trust; decisions on real data | Low |
| P1-2 | **Fix or rewrite the frontend tests** against current UI copy; gate them in CI alongside `eslint` and `tsc`. | `frontend/tests/*`; add `.github/workflows` | FE-2/FE-3, TEST-1 | Regression safety net | Medium |
| P1-3 | **Fix the Rules-of-Hooks violation** in `DynamicChartRenderer` (move hooks above the early return). | `DynamicChartRenderer.tsx:113-133` | FE-1 | Removes a latent crash | Trivial |
| P1-4 | **Fix the explain-prescribe dataset scoping** (router param + FE `datasetId`). | `explain_prescribe_router.py`, `forecast/page.tsx:126` | UX-5 | Correct per-dataset analysis | Low |
| P1-5 | **Make the health check real** (DB ping, LLM/key presence, Qdrant reachability) and make Qdrant failure *loud* instead of in-memory fallback. | `health.py`; `qdrant_store.py:28-30` | BE-9, in-memory trap | Honest orchestration | Medium |
| P1-6 | **Add rate limiting** per the existing spec/config (`QUERY_RATE_LIMIT`). | `main.py`; `config.py:39-40` | SEC-8 | Cost/DoS control | Low |
| P1-7 | **Stop leaking internal errors** to clients; log with `request_id` instead. | all routers | SEC-6 | Info disclosure | Low |
| P1-8 | **Remove the `print(DATABASE_URL)`** from the Alembic env. | `alembic/env.py:33` | SEC-7 | Secret stays out of logs | Trivial |
| P1-9 | **Add model-registry locking/atomic writes** and use full UUIDs for dynamic table names. | `model_storage.py:41-60`; `ingestion.py:211` | ML-5, SEC-9 | Prevents corruption/destruction | Low |
| P1-10 | **Correct the README** (SHAP/sklearn/LangChain/Next version) and document the 6 missing routes, or generate docs from OpenAPI. | `README.md`; `docs/phase1/04-API-SPECIFICATION.md` | DOC-1/DOC-2 | Honest representation | Low |

### P2 — Medium (after critical/high)

| # | Action | Files | Benefit | Complexity |
|---|---|---|---|---|
| P2-1 | **Consolidate to one ingestion stack** (deprecate `/upload/{entity_type}` or `/ingest/csv`) and delete the duplicated cleaner/validator/limit/exception code. | `services/ingestion*.py`, `infrastructure/ingestion/*` | Halves maintenance surface | High |
| P2-2 | **Delete dead code:** `GeminiClient`, `IngestionEngine`, `validators.py`, `services/data_cleaner.py` shim, `api/routers/ingest.py`, unused `relationship` import, `DATABASE_READONLY_URL` once P0-4 lands. | backend | Clarity | Low |
| P2-3 | **Delete dead frontend:** `webgl/`, cursor system, 4 card primitives, 2 KPI cards, `ShapExplanationPanel`, `button.tsx`/`card.tsx`, and the 6 unused npm deps. | `frontend/src/components/**`, `package.json` | Smaller installs, less confusion | Low |
| P2-4 | **Pick one charting library** (visx or recharts). | `frontend` | Bundle/maintenance | High |
| P2-5 | **Single elasticity model + single currency** (INR) shared module. | `dashboard:71`, `forecast:193-200`, `WhatIfSimulator:157-160`, `formatters.ts` | Consistent numbers | Medium |
| P2-6 | **Cache `get_table_schemas` per dataset** (invalidate on ingest) and add indexes/PKs to dynamic tables. | `repository.py:657`, `ingestion.py` | Removes N+1; query perf at scale | Medium |
| P2-7 | **Add forecast evaluation** (backtest MAE/MAPE) and expose it; gate `FORECAST_MIN_DATA_POINTS` up to ~30. | `forecast_service.py`, `prophet_forecaster.py`, `config.py:36` | Measurable ML quality | Medium |
| P2-8 | **Externalize trained models** (shared store / Redis cache) so multi-worker deploys are safe. | `prophet_forecaster.py`, `model_storage.py` | Horizontal scaling | Medium |
| P2-9 | **Replace hardcoded prescriptive fallbacks** with honest "unavailable" state. | `prescriptive_service.py:266-309` | No fabricated advice | Low |
| P2-10 | **Fix the `.gitignore` defeat** so `frontend/.env.local.example` is committable; make the README quickstart actually work. | `frontend/.gitignore`, `frontend/.env.local.example` | Onboarding works | Trivial |
| P2-11 | **Add route-level `loading.tsx`/`error.tsx`/`not-found.tsx`** and keyboard access for drop zones. | `frontend/src/app/**`, `ingest/page.tsx` | UX-6/UX-7, a11y | Low |

### P3 — Low (polish / long-term)

- **P3-1** Remove the legacy `CogniTwin/` deck and its ~4.4 MB of duplicated images.
- **P3-2** Pin/lock backend dependencies (`pip freeze` → lockfile or `uv lock`).
- **P3-3** Sync `pyproject.toml` dev extras with `requirements.txt`.
- **P3-4** Replace `any` API return types with the typed interfaces already defined in `api.ts:108-163`.
- **P3-5** Add `.gitattributes` for line endings.
- **P3-6** Move long-running training to a background queue (spec's own `FUTURE_TASKS.md` anticipates Celery/Redis).
- **P3-7** Investigate prompt-injection hardening (delimiter separation, output validation) for CSV-derived schema context.
- **P3-8** Consider renaming "SHAP" to "factor attribution" unless real SHAP is implemented.

---

## 25. Final Architect's Assessment

**CogniTwin is a strong solo/small-team prototype that punches well above its weight in visual design and defensive LLM engineering, but it currently sits at the "impressive demo" end of the maturity spectrum rather than "production platform."**

**Architectural maturity — moderate.** The Clean/Hexagonal skeleton is real and correctly oriented (domain at the center, adapters outside, correct dependency direction, a coherent exception taxonomy, UoW-managed transactions). That skeleton has been eroded in two places: a second, schemaless ingestion track that bypasses the UoW, duplicates half the pipeline, and writes to unconstrained dynamic tables; and a set of encapsulation breaks where services reach into private repository/forecaster attributes. The interface layer has drifted from its protocols without anyone noticing, because the protocols are not runtime-enforced.

**Maintainability — moderate, trending down.** Naming and readability are good, but the codebase carries an unusual amount of dead weight for its size: ~14 dead components, 4 dead API functions, 6 dead npm dependencies, a dead LLM client, a dead database setting, a whole orphaned legacy presentation site with 4.4 MB of duplicated binaries, and a frontend test suite that tests a UI that no longer exists. The 79 unaddressed ESLint errors and absent CI mean quality is currently enforced only by the individual developer's discipline.

**Security posture — weak, with one critical hole.** The single confirmed injection point, the entirely fictional read-only isolation, the absence of any authentication, and the wildcard CORS-with-credentials together mean that **any network-reachable instance is fully and anonymously controllable, up to and including arbitrary SQL with write privileges.** This is the most urgent thing about the project. Secrets hygiene, by contrast, is good — nothing is tracked in git.

**Testing maturity — low-to-moderate.** The 44 passing unit tests are genuinely valuable and target the right things (the fallback logic that is the system's hardest and most important behavior). But two-thirds of the surface — every API endpoint, the whole frontend, every integration path — is effectively unverified, the integration tests are structurally coupled to live infrastructure, collection itself requires a populated `.env`, and there is no CI anywhere.

**UX quality — high craft, concerning honesty.** The visual system is distinctive, tokenized, accessible-by-default in its primitives, and far above template quality. The critical UX defect is not aesthetic: the application systematically hides failure. Backend errors become green toasts, fabricated row counts, invented contract excerpts, and a silent swap into demo mode. For an executive-facing *decision* tool, that is the most dangerous class of UX bug there is — confident wrong answers.

**Performance posture — adequate for a prototype, unready for scale.** Good instincts are visible (thread offloading, timeouts, caching of SHAP explanations, `standalone` output). But the N+1 schema introspection on every query, the unindexed dynamic tables, the chained sequential LLM calls with no caching, the synchronous Prophet training, and the process-local model cache will all bite at the same time under real load.

**AI/ML engineering maturity — low, with a marketing-vs-implementation gap.** The orchestration around the models (fallbacks, timeouts, dataset binding, anti-hallucination re-validation of schema guesses) is more mature than the modeling itself. There is no `shap` library despite the TreeSHAP branding, no evaluation of any kind, no backtesting, no drift detection, and regressors are flat-extrapolated. The "SHAP drivers" are Prophet additive components relabeled, and downstream code converts them into quantified financial advice in ₹ — a confidence the method does not support.

**Scalability — limited by design choices, not by insurmountable constraints.** The single-process model cache, the monolithic synchronous request chain, the two ingestion stacks, and the unindexed dynamic tables are the binding constraints, and all are addressable incrementally.

**The bottom line:** this project is worth investing in. Its bones (architecture, error handling, degradation design, visual system) are good and its critical defects are concrete, localized, and mostly cheap to fix — several P0 items are one-line changes. The right sequence is: close the security holes honestly, make the UI stop lying about failures, restore a verifiable test baseline, then consolidate the duplicated ingestion stacks and invest in real ML evaluation. Skipping the first three to build more features would compound the one thing the project can least afford: a decision-making tool whose outputs cannot be trusted.

---

## 26. Appendix

### 26.1 Important files

**Backend**
- `backend/src/main.py` — app, CORS (SEC-4), error handlers, logging middleware
- `backend/src/config.py` — settings incl. unused `DATABASE_READONLY_URL` / `CORS_ORIGINS`
- `backend/src/dependencies.py` — manual DI composition (15 factory functions)
- `backend/src/api/router.py` + 8 routers — 15 handlers
- `backend/src/services/query_service.py` — NL2SQL orchestration, chart synthesis (834 lines)
- `backend/src/services/forecast_service.py` — dataset-scoped train/predict/simulate
- `backend/src/services/prescriptive_service.py` — anomaly + LLM prescriptions
- `backend/src/services/ingestion.py` vs `ingestion_service.py` — the two stacks
- `backend/src/services/shap_explainer_service.py` — **SEC-1** lines 48-50, 172-174
- `backend/src/infrastructure/database/repository.py` — RO-SQL, schemas, N+1
- `backend/src/infrastructure/ml/prophet_forecaster.py` — model + simulation
- `backend/src/infrastructure/ml/shap_engine.py` — Prophet decomposition (not SHAP)
- `backend/src/infrastructure/ml/model_storage.py` — JSON registry
- `backend/src/infrastructure/llm/groq_client.py` — live LLM client
- `backend/src/infrastructure/llm/gemini_client.py` — **DEAD**
- `backend/src/infrastructure/vector/qdrant_store.py` — 384-d fastembed + in-memory fallback
- `backend/alembic/env.py` — prints DB URL (SEC-7); no GRANT

**Frontend**
- `frontend/src/lib/api.ts` — API client, 9 `any` types, 4 dead exports
- `frontend/src/context/DatasetContext.tsx` — multi-source dataset sync
- `frontend/src/components/query/DynamicChartRenderer.tsx` — **FE-1** hooks violation
- `frontend/src/app/(app)/ingest/page.tsx` — 762 lines, **UX-1/2/3**
- `frontend/src/app/(app)/forecast/page.tsx` — 580 lines, **UX-5**
- `frontend/src/app/globals.css` — token system; missing `obsidian-panel`

### 26.2 Commands executed (all read-only)

```
git status / git log --oneline / git branch -a / git diff --stat / git ls-files / git check-ignore
Get-Content / Select-String / Get-ChildItem (structure, CSVs, env keys, compiled CSS)
& backend\.venv\Scripts\pytest.exe tests\unit -q                      -> 44 passed
& frontend\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json        -> PASS
& frontend\node_modules\.bin\eslint.cmd src                           -> 79 errors, 70 warnings
& frontend\node_modules\.bin\jest.cmd                                 -> 2 suites, 5/5 FAILED
& backend\.venv\Scripts\python.exe -c "from src.main import app"      -> IMPORT_OK
& backend\.venv\Scripts\python.exe -c "import shap"                   -> ModuleNotFoundError
```

### 26.3 Test results summary

| Suite | Result |
|---|---|
| Backend unit (`tests/unit`, 44 tests) | **PASS** (0.91 s; 1 deprecation warning) |
| Backend integration (23 tests) | Not run — requires live PostgreSQL/Qdrant/LLM (would need infra; deliberately not started) |
| Frontend jest (5 tests, 2 suites) | **FAIL** (stale UI copy assertions) |
| Frontend typecheck | **PASS** |
| Frontend lint | **FAIL** (79 errors) |
| Frontend build | Previously built successfully (`.next/BUILD_ID` present) |

### 26.4 External references

No web research was required. Every finding in this report is derived from the repository's own source, configuration, git state, dependency metadata, compiled output, or the local command results recorded in §26.2.

### 26.5 Final verification checklist

- [x] No source files were modified
- [x] No configuration was modified
- [x] No secrets were exposed (env values never printed; key names only)
- [x] Entire relevant repository was investigated (backend, frontend, docs, assets, data, git state)
- [x] Frontend investigated (routes, components, state, API client, CSS, tests, lint, typecheck)
- [x] Backend investigated (routers, services, domain, infrastructure, config)
- [x] API investigated (all 15 handlers mapped and assessed)
- [x] Database investigated (schema, migrations, query patterns, transaction semantics)
- [x] AI/ML investigated (Prophet, "SHAP", embeddings, RAG, prompts, LLM client)
- [x] Security investigated (injection, authn, CORS, secrets, limits, error leakage)
- [x] Performance investigated (N+1, indexes, LLM chains, client bundles, loops)
- [x] Tests investigated and safely executed where possible
- [x] Runtime/build investigated (import check, typecheck, lint, jest, compiled CSS)
- [x] Working vs broken features distinguished (§20)
- [x] Confirmed vs inferred findings distinguished throughout
- [x] Important findings contain evidence (file:line or command output)
- [x] Recommendations are actionable and prioritized (§24)
- [x] Audit report created successfully — **`PROJECT_AUDIT_REPORT.md`**
