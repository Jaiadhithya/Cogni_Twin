# Phase 1 — Implementation Sequence

> **Document Purpose**: Define the exact order in which components should be built, dependencies between steps, verification criteria at each step, and milestones. An AI coding agent should follow this sequence to avoid building components that depend on non-existent foundations.

---

## 1. Why Build Order Matters

Building components in the wrong order causes:

1. **Blocked work**: Building the forecast API before the database exists means the forecast service has no data source.
2. **Untestable code**: Building services before domain entities means no types to validate against.
3. **Integration failures**: Building the frontend before the API means hardcoding fake data that breaks when real APIs arrive.

This sequence ensures each step builds on a verified, working foundation.

---

## 2. Implementation Sequence

### Step 1: Project Scaffolding

**What**: Create the directory structure, configuration files, and dependency manifests.

**Create:**
- Root directory layout per `02-PROJECT-STRUCTURE.md`
- `backend/pyproject.toml` with all dependencies
- `frontend/package.json` (via `npx create-next-app`)
- `docker-compose.yml`
- `.gitignore`
- `.env.example` files
- Empty `__init__.py` files in all Python packages

**Verification:**
- `pip install -e ".[dev]"` succeeds
- `npm install` succeeds (in frontend/)
- `docker-compose config` shows valid configuration
- Directory structure matches spec exactly

**Dependencies**: None (this is the first step).

---

### Step 2: Domain Layer

**What**: Implement all domain entities, value objects, interfaces (protocols), and exceptions.

**Create:**
- All files in `backend/src/domain/entities/`
- All files in `backend/src/domain/value_objects/`
- All files in `backend/src/domain/interfaces/`
- `backend/src/domain/exceptions.py`

**Verification:**
- `pytest tests/unit/test_entities.py` passes
- All entities are pure Python dataclasses with no external imports
- All interfaces are `typing.Protocol` classes
- No import from `services/`, `infrastructure/`, or `api/`

**Dependencies**: Step 1 (project scaffolding).

**Why this step is second**: The domain layer has zero dependencies. Every other layer imports from it. Building it first ensures all other layers have their types and interfaces available.

---

### Step 3: Configuration and Logging

**What**: Implement the Settings class and structured logging setup.

**Create:**
- `backend/src/config.py`
- `backend/src/infrastructure/logging/setup.py`

**Verification:**
- `pytest tests/unit/test_config.py` passes
- Settings loads from environment variables and `.env` file
- Logging outputs JSON to stdout
- All config values have correct types and defaults

**Dependencies**: Step 1.

---

### Step 4: Database Layer

**What**: Implement SQLAlchemy models, engine, session management, Alembic setup, and repository.

**Create:**
- `backend/src/infrastructure/database/engine.py`
- `backend/src/infrastructure/database/models.py`
- `backend/src/infrastructure/database/session.py`
- `backend/src/infrastructure/database/repository.py`
- `backend/alembic/` (Alembic setup with `alembic init`)
- `backend/alembic/env.py` (configured for async)
- Initial migration (all tables from `03-DATABASE-SCHEMA.md`)
- `backend/scripts/init_db.sql`

**Verification:**
- `docker-compose up db` starts PostgreSQL
- `alembic upgrade head` creates all tables
- `pytest tests/integration/test_repository.py` passes
  - Can save and retrieve each entity type
  - Pagination works
  - Date filtering works
  - execute_readonly_sql works with a simple SELECT
  - get_table_schemas returns correct schema

**Dependencies**: Steps 2 (entities), 3 (config).

**Why before services**: Services depend on the repository. The repository must be implemented and tested first.

---

### Step 5: Data Ingestion Pipeline

**What**: Implement CSV parsing, data cleaning, schema mapping, and the ingestion service.

**Create:**
- `backend/src/infrastructure/ingestion/csv_parser.py`
- `backend/src/infrastructure/ingestion/data_cleaner.py`
- `backend/src/infrastructure/ingestion/schema_mapper.py`
- `backend/src/services/ingestion_service.py`

**Verification:**
- `pytest tests/unit/test_csv_parser.py` passes
- `pytest tests/unit/test_data_cleaner.py` passes
- `pytest tests/unit/test_schema_mapper.py` passes
- All test CSV fixtures parse correctly
- Fuzzy column matching works with alias dictionaries
- Date format detection works with multiple formats
- Missing values are handled per spec

**Dependencies**: Steps 2 (entities/interfaces), 4 (repository for persistence).

**Why before API**: The upload endpoint calls the ingestion service. Build and test the service first.

---

### Step 6: Seed Data

**What**: Create seed CSV files and the seed loading script.

**Create:**
- `backend/seed/sales.csv` (4,380 records)
- `backend/seed/products.csv` (25 records)
- `backend/seed/customers.csv` (50 records)
- `backend/seed/inventory.csv` (25 records)
- `backend/seed/suppliers.csv` (10 records)
- `backend/seed/load_seeds.py`

**Verification:**
- `python -m src.seed.load_seeds` runs without error
- All seed data is loaded into the database
- Running the script again does not duplicate data (idempotent)
- Seed data follows all the patterns specified in `03-DATABASE-SCHEMA.md` Section 6

**Dependencies**: Steps 4 (database), 5 (ingestion pipeline reuses parser/cleaner).

**Why now**: Seed data provides immediate demo capability and is used for testing subsequent steps (forecasting, queries).

---

### Step 7: Warehouse Service

**What**: Implement data retrieval, aggregation, and summary metrics.

**Create:**
- `backend/src/services/warehouse_service.py`

**Verification:**
- With seed data loaded:
  - Paginated retrieval works for all entity types
  - Summary metrics return correct totals
  - Date range filtering returns correct subsets
  - Sorting works correctly

**Dependencies**: Steps 4 (repository), 6 (seed data for testing).

---

### Step 8: FastAPI Application Shell and Upload API

**What**: Create the FastAPI app, middleware, global error handler, dependency injection, and the upload endpoint.

**Create:**
- `backend/src/main.py`
- `backend/src/dependencies.py`
- `backend/src/api/router.py`
- `backend/src/api/schemas/common.py`
- `backend/src/api/schemas/upload.py`
- `backend/src/api/upload_router.py`
- `backend/src/api/health_router.py`
- `backend/src/api/schemas/data.py`
- `backend/src/api/data_router.py`
- Request ID middleware
- Request logging middleware
- Global exception handler

**Verification:**
- `uvicorn src.main:app` starts without errors
- `GET /api/v1/health` returns 200
- `POST /api/v1/upload/sales` with a CSV file returns 201
- `GET /api/v1/data/sales` returns seed data
- `GET /api/v1/data/summary` returns metrics
- `GET /api/v1/data/uploads` returns upload history
- Error responses follow the standard format
- CORS headers are present
- Request IDs appear in response headers and logs
- `pytest tests/integration/test_upload_api.py` passes
- `pytest tests/integration/test_data_api.py` passes
- `pytest tests/integration/test_health_api.py` passes

**Dependencies**: Steps 2-7 (everything so far).

**Why this is the first API step**: The upload and data APIs are the entry points for all data. They must work before forecasting or Q&A.

---

### Step 9: ML Forecasting Engine

**What**: Implement Prophet forecasting, model storage, and forecast service.

**Create:**
- `backend/src/infrastructure/ml/prophet_forecaster.py`
- `backend/src/infrastructure/ml/model_storage.py`
- `backend/src/services/forecast_service.py`
- `backend/src/api/schemas/forecast.py`
- `backend/src/api/forecast_router.py`

**Verification:**
- With seed data loaded:
  - `POST /api/v1/forecast/train` succeeds and creates a model file
  - `GET /api/v1/forecast/status` returns model_available=true
  - `GET /api/v1/forecast/predict` returns forecast points
  - Forecast values are non-negative
  - Confidence intervals are present
  - `POST /api/v1/forecast/train` with empty DB returns 400
  - `GET /api/v1/forecast/predict` without training returns 409
- `pytest tests/integration/test_forecast_api.py` passes

**Dependencies**: Steps 4 (repository for data), 8 (API shell).

---

### Step 10: LLM Query Engine

**What**: Implement Gemini client, SQL validator, query service, and query endpoint.

**Create:**
- `backend/src/infrastructure/llm/gemini_client.py`
- SQL validation logic (in a utility module or within gemini_client)
- `backend/src/services/query_service.py`
- `backend/src/api/schemas/query.py`
- `backend/src/api/query_router.py`
- Rate limiting middleware

**Verification:**
- With seed data and valid GEMINI_API_KEY:
  - `POST /api/v1/query` with "What were the total sales?" returns answer + SQL
  - `POST /api/v1/query` with "What are the top 5 products?" returns formatted list
  - Generated SQL is a valid SELECT statement
  - Invalid questions return appropriate errors
  - Rate limiting works (11th request returns 429)
- `pytest tests/integration/test_query_api.py` passes (with mocked LLM)

**Dependencies**: Steps 4 (repository), 8 (API shell), 10 uses seed data for validation.

**Why last backend step**: The query engine depends on all tables being populated and the schema context being available. It's the most complex backend module and benefits from having everything else stable.

---

### Step 11: Backend Dockerfile and Docker Integration

**What**: Finalize the backend Dockerfile and verify the full Docker Compose stack.

**Verification:**
- `docker-compose up --build` starts all three containers
- `docker-compose logs backend` shows migrations ran, seeds loaded, server started
- `GET http://localhost:8000/api/v1/health` returns healthy
- All API endpoints work through Docker networking

**Dependencies**: Steps 1-10 (complete backend).

---

### Step 12: Frontend — Layout and Design System

**What**: Set up Next.js with design system, layout components, and routing.

**Create:**
- `frontend/src/app/layout.tsx` (root layout with font, theme)
- `frontend/src/app/globals.css` (all CSS variables, resets, design tokens from `08-FRONTEND-DASHBOARD.md`)
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/components/layout/PageContainer.tsx`
- `frontend/src/components/ui/Button.tsx`
- `frontend/src/components/ui/Card.tsx`
- `frontend/src/components/ui/Loading.tsx`
- `frontend/src/components/ui/ErrorAlert.tsx`
- `frontend/src/components/ui/Badge.tsx`
- `frontend/src/lib/api.ts` (API client)
- `frontend/src/lib/formatters.ts` (currency, date formatting)
- `frontend/src/lib/constants.ts`
- `frontend/src/types/api.ts`
- `frontend/src/types/data.ts`

**Verification:**
- `npm run dev` starts without errors
- Navigating to `http://localhost:3000` shows the layout (sidebar, header)
- Dark theme renders correctly
- Navigation links work (even if pages are placeholder)
- API client can reach `http://localhost:8000/api/v1/health`

**Dependencies**: Step 11 (backend running in Docker for API client testing).

---

### Step 13: Frontend — Dashboard Page

**What**: Build the main dashboard with KPI metrics, charts, and data status.

**Create:**
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/components/dashboard/MetricCard.tsx`
- `frontend/src/components/dashboard/SalesChart.tsx`
- `frontend/src/components/dashboard/TopProductsChart.tsx`
- `frontend/src/components/dashboard/DataTable.tsx`
- `frontend/src/hooks/useSummary.ts`
- `frontend/src/hooks/useSalesData.ts`

**Verification:**
- Dashboard loads with seed data metrics
- Metric cards show total revenue, order count, avg order value, customer count
- Sales trend line chart renders with correct date axis
- Top products bar chart shows top 5 products
- Date range selector works and refreshes data
- Empty state shows correctly when no data exists
- Loading states render (skeleton shimmer)

**Dependencies**: Step 12 (layout and design system).

---

### Step 14: Frontend — Upload Page

**What**: Build the data upload interface.

**Create:**
- `frontend/src/app/upload/page.tsx`
- `frontend/src/components/upload/FileDropzone.tsx`
- `frontend/src/components/upload/UploadProgress.tsx`
- `frontend/src/components/upload/UploadResult.tsx`
- `frontend/src/components/upload/EntityTypeSelector.tsx`
- `frontend/src/hooks/useUpload.ts`

**Verification:**
- Drag-and-drop file selection works
- Entity type selector shows all 5 options
- Uploading a valid CSV shows progress → success result
- Uploading an invalid file shows error message
- Upload history table shows previous uploads
- After upload, navigating to dashboard shows updated metrics

**Dependencies**: Steps 8 (upload API), 12 (layout).

---

### Step 15: Frontend — Forecast Page

**What**: Build the forecast visualization page.

**Create:**
- `frontend/src/app/forecast/page.tsx`
- `frontend/src/components/forecast/ForecastChart.tsx`
- `frontend/src/components/forecast/ForecastControls.tsx`
- `frontend/src/components/forecast/ForecastStatus.tsx`
- `frontend/src/hooks/useForecast.ts`

**Verification:**
- Shows model status (trained/not trained)
- "Train Model" button triggers training and shows loading
- Forecast chart renders with actual + predicted + confidence bands
- Horizon selector (30/60/90) works and refreshes predictions
- No model state shows appropriate message

**Dependencies**: Steps 9 (forecast API), 12 (layout).

---

### Step 16: Frontend — Ask AI Page

**What**: Build the natural language Q&A chat interface.

**Create:**
- `frontend/src/app/query/page.tsx`
- `frontend/src/components/query/ChatInterface.tsx`
- `frontend/src/components/query/ChatMessage.tsx`
- `frontend/src/components/query/SQLDisplay.tsx`
- `frontend/src/components/query/QueryInput.tsx`
- `frontend/src/hooks/useQuery.ts`

**Verification:**
- Welcome message with suggested questions displays
- Typing a question and pressing Enter/Send shows user message + AI thinking indicator
- AI response appears with formatted answer
- "View SQL" expander shows the generated SQL
- Error responses show as AI messages (not crashes)
- Auto-scroll to latest message works
- Suggested question chips are clickable

**Dependencies**: Steps 10 (query API), 12 (layout).

---

### Step 17: End-to-End Verification

**What**: Run the complete demo scenario from `00-PHASE1-OVERVIEW.md` Section 7.

**Verification:**
1. `docker-compose up --build` — everything starts
2. Open `http://localhost:3000` — dashboard loads with seed data
3. Navigate to Upload — upload a new sales CSV
4. Navigate to Dashboard — metrics update
5. Navigate to Forecast — train a model — see predictions
6. Navigate to Ask AI — ask "What were total sales last month?" — get answer
7. Ask "Which product sells the most?" — get answer with SQL
8. Upload a malformed file — see friendly error
9. Ask a nonsensical question — get "I cannot answer that" response

All 9 steps must work without errors.

**Dependencies**: All previous steps.

---

## 3. Milestones

| Milestone | Steps | Checkpoint |
|---|---|---|
| **M1: Backend Foundation** | 1-4 | Database running, schema created, repository tested |
| **M2: Data Pipeline** | 5-8 | CSV upload → clean → persist → retrieve via API |
| **M3: Intelligence Layer** | 9-10 | Forecasting and NL Q&A working via API |
| **M4: Frontend Complete** | 11-16 | Full UI with all pages functional |
| **M5: Phase 1 Complete** | 17 | End-to-end demo scenario passes |

---

## 4. Estimated Effort

| Steps | Description | Estimated Time |
|---|---|---|
| 1-4 | Foundation (scaffolding, domain, config, database) | 3-4 hours |
| 5-8 | Ingestion pipeline + API | 4-6 hours |
| 9-10 | ML + LLM engines | 3-4 hours |
| 11-16 | Frontend (all pages) | 6-8 hours |
| 17 | E2E verification and fixes | 1-2 hours |
| **Total** | | **17-24 hours** |

These are estimates for an experienced AI coding agent working sequentially. Actual time depends on debugging and iteration.
