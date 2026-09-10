# Phase 1 — System Architecture and Technology Decisions

> **Document Purpose**: Define the system architecture, justify every technology choice, establish architectural boundaries, and explain how components interact. This document is the structural blueprint that governs all implementation decisions.

---

## 1. Architectural Philosophy

### Why Clean Architecture

CogniTwin uses **Clean Architecture** (also called Hexagonal/Ports-and-Adapters) because:

1. **Future-proofing**: Phase 2+ will add RAG, vector databases, new ML models, and agentic AI. Clean architecture makes it possible to add these without rewriting existing code.
2. **Testability**: Business logic is isolated from infrastructure (database, APIs, file system), making unit testing straightforward.
3. **LLM-swappable**: The LLM integration (Gemini) is behind an interface. Switching to GPT, Claude, or a local model requires changing only the adapter, not the business logic.
4. **Database-swappable**: PostgreSQL access is behind a repository interface. Adding a vector database (Qdrant) in Phase 2 adds a new repository — it doesn't modify existing ones.

### Why Monolith, Not Microservices

Phase 1 is a **modular monolith** deployed as a single backend process.

**Reasons:**
- A single developer (or AI agent) can build, test, and deploy it without orchestration overhead.
- Inter-module communication is a function call, not an HTTP request — simpler, faster, no serialization overhead.
- The modules (ingestion, ML, LLM, warehouse) share the same database — no distributed transaction problems.
- Microservices add Kubernetes, service mesh, and distributed tracing complexity that provides zero value at Phase 1 scale.

**Future path**: When the agentic architecture arrives (Phase 4), the agents may warrant separate services. The clean architecture boundaries make this extraction possible without rewriting business logic.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                       │
│                        Port 3000                                │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────────┐  │
│  │  Upload   │  │Dashboard │  │ Forecast  │  │   Q&A Chat    │  │
│  │  Page     │  │  Page    │  │   Page    │  │    Panel      │  │
│  └──────────┘  └──────────┘  └───────────┘  └───────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP (REST JSON)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI)                          │
│                      Port 8000                                  │
│                                                                 │
│  ┌─── API Layer (Routers) ───────────────────────────────────┐  │
│  │  /api/v1/upload    /api/v1/data    /api/v1/forecast       │  │
│  │  /api/v1/query     /api/v1/health                         │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │                                      │
│  ┌─── Service Layer ─────┴───────────────────────────────────┐  │
│  │  IngestionService  WarehouseService  ForecastService       │  │
│  │  QueryService      HealthService                          │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │                                      │
│  ┌─── Domain Layer ──────┴───────────────────────────────────┐  │
│  │  Entities    Value Objects    Interfaces (Ports)           │  │
│  │  Business Rules    Validation Logic                       │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │                                      │
│  ┌─── Infrastructure Layer ──────────────────────────────────┐  │a
│  │  PostgresRepository   ProphetForecaster   GeminiClient    │  │
│  │  CSVParser            FileStorage         ModelStorage    │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
              ┌────────────┼────────────────┐
              ▼            ▼                ▼
        ┌──────────┐ ┌──────────┐    ┌──────────────┐
        │PostgreSQL│ │  Model   │    │  Gemini API  │
        │Port 5432 │ │  Store   │    │  (External)  │
        │          │ │(Disk /ml)│    │              │
        └──────────┘ └──────────┘    └──────────────┘
```

---

## 3. Architecture Layers — Detailed Responsibilities

### Layer 1: API Layer (Routers)

**Location**: `backend/src/api/`

**Responsibilities:**
- Accept HTTP requests
- Validate request payloads using Pydantic schemas
- Call the appropriate service method
- Format and return HTTP responses
- Handle HTTP-specific concerns (status codes, headers, CORS)

**Rules:**
- Routers must NEVER contain business logic
- Routers must NEVER directly access the database
- Routers must NEVER import infrastructure modules (no SQLAlchemy, no Prophet, no Gemini)
- Each router file corresponds to one API resource (upload, data, forecast, query)

### Layer 2: Service Layer

**Location**: `backend/src/services/`

**Responsibilities:**
- Orchestrate business operations (e.g., "ingest a CSV" = parse + validate + clean + map + persist)
- Enforce business rules
- Coordinate between domain objects and infrastructure adapters
- Transaction management

**Rules:**
- Services receive dependencies through constructor injection
- Services must NEVER import infrastructure directly — they depend on interfaces (protocols)
- Services are the only layer that composes multiple infrastructure calls into a workflow

### Layer 3: Domain Layer

**Location**: `backend/src/domain/`

**Responsibilities:**
- Define business entities (Sale, Product, Customer, etc.)
- Define value objects (DateRange, Money, Percentage)
- Define interfaces (protocols) for infrastructure (Repository, Forecaster, LLMClient)
- Contain business validation rules

**Rules:**
- The domain layer has ZERO external dependencies
- No imports from FastAPI, SQLAlchemy, Prophet, or any framework
- This is pure Python: dataclasses, protocols, enums, type hints
- This layer is the most stable — it changes only when business rules change

### Layer 4: Infrastructure Layer

**Location**: `backend/src/infrastructure/`

**Responsibilities:**
- Implement the interfaces (protocols) defined in the domain layer
- Contain all framework-specific code (SQLAlchemy, Prophet, Gemini SDK)
- Manage external connections (database, APIs, file system)

**Rules:**
- Infrastructure modules import from the domain layer, NEVER from the service layer
- Each infrastructure module implements exactly one domain interface
- Infrastructure is the most replaceable layer — swapping Gemini for GPT changes only one file

---

## 4. Technology Stack — Decisions and Justifications

### Backend: FastAPI (Python 3.11+)

**Why FastAPI:**
- Native async support — important for I/O-bound operations (database queries, Gemini API calls)
- Built-in Pydantic validation — request/response schemas are automatically validated and documented
- Auto-generated OpenAPI/Swagger docs — frontend developers can explore the API without separate documentation
- Excellent Python ML ecosystem access — Prophet, pandas, scikit-learn are all Python-native

**Why NOT Django:**
- Django's ORM is heavier than SQLAlchemy for analytics queries
- Django REST Framework adds boilerplate that FastAPI avoids
- Django's sync-first design requires Django Channels for async — added complexity

**Why NOT Flask:**
- No built-in validation (requires Marshmallow or manual validation)
- No async support without workarounds
- No auto-generated API documentation

**Why NOT Node.js/Express:**
- Python is the ML ecosystem's native language. Using Node.js would require Python microservices for ML anyway, adding inter-process communication overhead that provides no benefit in Phase 1.

### Database: PostgreSQL 15+

**Why PostgreSQL:**
- ACID compliance ensures data integrity for financial/sales data — critical for a BI platform
- Rich JSON/JSONB support for storing flexible metadata (upload configs, column mappings)
- Window functions and CTEs are essential for analytics queries (running averages, year-over-year comparisons)
- The `pg_trgm` extension enables fuzzy text matching (useful for column name matching)
- Mature ecosystem with production-proven reliability

**Why NOT MySQL:**
- Weaker window function support
- No native JSON indexing (until recent versions)
- Less suitable for analytics workloads

**Why NOT MongoDB:**
- Business intelligence data is inherently relational (sales → products → customers → suppliers)
- Aggregation queries are more natural in SQL
- ACID transactions matter for financial data consistency
- The LLM will generate SQL, not MongoDB aggregation pipelines

**Why NOT SQLite:**
- No concurrent access support (Phase 2+ may add background jobs)
- Limited to single-machine deployment
- No server-mode for Docker networking

### ORM: SQLAlchemy 2.0+ (Async)

**Why SQLAlchemy:**
- Most mature Python ORM
- Async support through `asyncpg` driver
- Declarative model definitions that serve as documentation
- Migration support through Alembic
- Raw SQL escape hatch for complex analytics queries

**Why NOT Tortoise ORM:**
- Less mature, smaller community
- SQLAlchemy 2.0 closed the async gap

**Why NOT raw SQL:**
- No migration management
- SQL injection risks with string formatting
- No model validation
- Harder to maintain column-to-Python-type mappings

### ML: Facebook Prophet

**Why Prophet for Phase 1 forecasting:**
- Designed specifically for business time-series with seasonality (daily, weekly, yearly)
- Works well with missing data — common in small business sales records
- Minimal hyperparameter tuning — suitable for automated training without data scientist intervention
- Handles holidays/events — important for retail businesses
- Produces confidence intervals natively — essential for communicating uncertainty
- Well-documented, battle-tested at Facebook/Meta

**Why NOT ARIMA/SARIMA:**
- Requires stationarity testing and differencing — too manual for automated pipeline
- Sensitive to missing data
- Complex parameter selection (p, d, q, P, D, Q, m)

**Why NOT XGBoost/LightGBM for forecasting:**
- They're classification/regression models, not time-series models
- Require manual feature engineering (lag features, rolling windows) — Phase 1 should minimize manual steps
- Don't produce probabilistic forecasts natively

**Why NOT DeepAR/N-BEATS:**
- Require GPU and large datasets
- Overkill for small business daily sales (typically <10K data points)
- Longer training times

### LLM: Google Gemini Pro

**Why Gemini Pro:**
- Strong SQL generation capability
- Cost-effective (significantly cheaper than GPT-4 per token)
- Good instruction following for structured output
- Google Cloud ecosystem alignment

**Why NOT GPT-4:**
- Higher cost per query
- API availability can be inconsistent
- For Phase 1 SQL generation, Gemini Pro is sufficient

**Why NOT local LLM (Llama, Mistral):**
- Requires GPU hardware that small business users may not have
- Model download size (7B+ parameters) is impractical for quick setup
- SQL generation quality from smaller local models is significantly worse

**Design for swappability**: The LLM is behind an abstract interface (`LLMClient` protocol). Switching to any other LLM requires implementing one class with one method. No business logic changes.

### Frontend: Next.js 14+ (TypeScript, App Router)

**Why Next.js:**
- React ecosystem — largest component library ecosystem (charts, tables, upload components)
- TypeScript support — type safety for API response handling
- App Router with Server Components — efficient data loading
- File-system routing — simple page organization
- Built-in API routes — can proxy requests if needed

**Why NOT Streamlit:**
- Limited UI customization
- Not suitable for production dashboards
- Single-threaded, sluggish with multiple users
- No component library ecosystem
- Looks like a prototype, not a product

**Why NOT Vue/Nuxt:**
- Smaller ecosystem for data visualization components
- React has better charting library support (Recharts, Nivo, Visx)

### Charts: Recharts

**Why Recharts:**
- React-native (composable components, not imperative API)
- Responsive out of the box
- Clean, modern default styling
- Good TypeScript support
- Active maintenance

**Why NOT Plotly (for frontend):**
- Plotly React wrapper is a thin layer over the imperative JS library — less "React-native"
- Bundle size is larger
- Plotly is excellent for Python-side visualization but less idiomatic in React

**Why NOT D3 directly:**
- Too low-level for dashboard charts
- Requires significant boilerplate for common chart types
- React + D3 integration has well-known lifecycle conflicts

---

## 5. Communication Patterns

### Frontend ↔ Backend

- **Protocol**: HTTP/1.1 REST with JSON bodies
- **Base URL**: `http://localhost:8000/api/v1`
- **File uploads**: `multipart/form-data`
- **Data queries**: `application/json`
- **Authentication**: None in Phase 1 (single tenant)
- **CORS**: Allow origin `http://localhost:3000`

### Backend ↔ Database

- **Protocol**: PostgreSQL wire protocol via `asyncpg`
- **Connection pooling**: SQLAlchemy async engine with pool size 5, max overflow 10
- **Query timeout**: 30 seconds
- **Transactions**: Per-request (auto-commit after successful handler)

### Backend ↔ Gemini API

- **Protocol**: HTTPS REST via Google Generative AI Python SDK
- **Authentication**: API key via environment variable
- **Timeout**: 30 seconds per request
- **Retry**: 3 retries with exponential backoff (1s, 2s, 4s) on 429/5xx
- **Rate limiting**: Client-side rate limiter at 10 requests/minute (adjustable)

### Backend ↔ Model Storage

- **Protocol**: Local filesystem I/O
- **Location**: `./ml_models/` directory (Docker volume-mounted)
- **Format**: Prophet serializes to JSON (using `prophet.serialize`)
- **Naming**: `forecast_{entity}_{timestamp}.json`

---

## 6. Dependency Injection Strategy

### Why Dependency Injection

- Services depend on abstract interfaces, not concrete implementations
- Tests can inject mocks/fakes without monkeypatching
- Switching infrastructure (e.g., PostgreSQL → DuckDB for testing) is a configuration change, not a code change

### Implementation Approach

Use **FastAPI's `Depends()`** mechanism combined with a **dependency container**.

```
# Conceptual flow (NOT code — this is architecture documentation)

1. Application startup creates concrete implementations:
   - PostgresRepository implements Repository protocol
   - ProphetForecaster implements Forecaster protocol
   - GeminiClient implements LLMClient protocol

2. A dependency container holds these instances.

3. FastAPI routes use Depends() to inject the service layer.

4. Services receive infrastructure through constructor parameters.

5. Tests override the container to inject test doubles.
```

### Dependency Flow (allowed directions)

```
API Layer  →  Service Layer  →  Domain Layer  ←  Infrastructure Layer
   │               │                ▲                     │
   │               │                │                     │
   │               └────────────────┘                     │
   │                                                      │
   └──────────────── NEVER ──────────────────────────────→┘
```

**Rules:**
- API imports Services ✅
- Services import Domain ✅
- Infrastructure imports Domain ✅
- API imports Infrastructure ❌ (NEVER)
- Services import Infrastructure ❌ (NEVER — use interfaces)
- Domain imports anything external ❌ (NEVER — zero dependencies)

---

## 7. Configuration Strategy

### Environment-Based Configuration

All configuration is read from environment variables, with defaults for development.

### Configuration Hierarchy

```
1. Environment variables (highest priority)
2. .env file (development defaults)
3. Hardcoded defaults in config module (last resort)
```

### Configuration Object

A single `Settings` class (Pydantic BaseSettings) holds all configuration:

```
DATABASE_URL          = postgresql+asyncpg://user:pass@localhost:5432/cognitwin
GEMINI_API_KEY        = (required, no default)
GEMINI_MODEL_NAME     = gemini-2.0-flash
ML_MODELS_DIR         = ./ml_models
UPLOAD_DIR            = ./uploads
MAX_UPLOAD_SIZE_MB    = 50
MAX_UPLOAD_ROWS       = 100000
FORECAST_HORIZON_DAYS = 90
LOG_LEVEL             = INFO
CORS_ORIGINS          = ["http://localhost:3000"]
API_PREFIX            = /api/v1
```

### Why NOT YAML/TOML config files

- Environment variables are the industry standard for containerized applications (12-Factor App)
- Docker Compose passes env vars natively
- No file parsing library needed
- Pydantic BaseSettings validates and types them automatically

---

## 8. Security Design (Phase 1)

Phase 1 has no authentication, but security is still critical:

### SQL Injection Prevention

- **LLM-generated SQL is the primary risk**. The Gemini model may generate malicious SQL if prompted adversarially.
- **Mitigation 1**: Execute LLM-generated SQL using a **read-only database role** (`cognitwin_readonly`) that has only `SELECT` permissions.
- **Mitigation 2**: Parse the generated SQL and reject any statement that is not a `SELECT` (block `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`).
- **Mitigation 3**: Set a query timeout of 10 seconds on LLM-generated queries to prevent resource exhaustion.

### File Upload Safety

- Validate file extension (`.csv` only)
- Validate MIME type (`text/csv` or `text/plain`)
- Enforce file size limit (50MB)
- Do not persist uploaded files permanently — parse, ingest, then delete
- Sanitize filenames before any disk operations

### API Safety

- No sensitive data in URL parameters
- Rate limiting on the query endpoint (10 req/min) to prevent Gemini API abuse
- Request size limits on all endpoints
- CORS restricted to frontend origin only

---

## 9. Scalability Design

Phase 1 is single-user and single-machine. However, the architecture must not **prevent** future scaling:

| Concern | Phase 1 Approach | Future Path |
|---|---|---|
| Database | Single PostgreSQL instance | Read replicas, connection pooling (PgBouncer) |
| ML Training | Synchronous, in-process | Background task queue (Celery + Redis) |
| File Uploads | Direct to local disk | Object storage (S3/GCS) |
| LLM Calls | Synchronous per request | Queue + async workers |
| Frontend | Client-side rendering | CDN, edge caching |
| Caching | None | Redis for query result caching |

### What Phase 1 must NOT do to preserve scalability:

1. **Do NOT store state in global variables** — use database or file system
2. **Do NOT hardcode file paths** — use configuration
3. **Do NOT use synchronous database drivers** — use async from day one
4. **Do NOT couple business logic to HTTP request lifecycle** — services should be callable from background tasks later

---

## 10. Monitoring and Observability (Phase 1)

### Health Checks

- `GET /api/v1/health` — returns `200` if all systems operational
- Checks: database connectivity, model directory accessible, Gemini API reachable
- Returns component-level status

### Structured Logging

- JSON-formatted logs to stdout
- Every log entry includes: timestamp, level, module, message, request_id (if applicable)
- Log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL
- Default level: INFO in production, DEBUG in development

### Request Logging

- Every API request logged with: method, path, status_code, duration_ms, request_id
- File uploads additionally log: filename, file_size, row_count, warnings

### No external monitoring tools in Phase 1

- No Prometheus, Grafana, or Sentry
- Structured JSON logs to stdout are sufficient for Docker log inspection
- Future phases can add log aggregation by shipping stdout to any collector
