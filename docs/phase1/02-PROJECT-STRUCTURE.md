# Phase 1 — Project Structure and File Responsibilities

> **Document Purpose**: Define the exact directory structure, every file that should exist, what each file is responsible for, and the rules governing module boundaries and imports. An AI coding agent should be able to create the entire project skeleton from this document alone.

---

## 1. Root Directory Layout

```
cognitwin/
├── backend/                    # FastAPI Python backend
│   ├── src/                    # Source code (importable as `src`)
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI application factory
│   │   ├── config.py           # Pydantic settings and configuration
│   │   ├── dependencies.py     # Dependency injection container
│   │   ├── api/                # HTTP layer (routers)
│   │   ├── services/           # Business logic orchestration
│   │   ├── domain/             # Pure business entities and interfaces
│   │   └── infrastructure/     # External integrations
│   ├── tests/                  # All tests
│   │   ├── __init__.py
│   │   ├── conftest.py         # Shared fixtures
│   │   ├── unit/               # Unit tests
│   │   ├── integration/        # Integration tests
│   │   └── test_data/          # CSV fixtures for testing
│   ├── alembic/                # Database migrations
│   │   ├── env.py
│   │   ├── alembic.ini
│   │   └── versions/           # Migration scripts
│   ├── seed/                   # Seed data for demo
│   │   ├── sales.csv
│   │   ├── products.csv
│   │   ├── customers.csv
│   │   ├── inventory.csv
│   │   └── suppliers.csv
│   ├── ml_models/              # Persisted trained models (gitignored)
│   ├── uploads/                # Temporary upload storage (gitignored)
│   ├── pyproject.toml          # Python project config and dependencies
│   ├── Dockerfile              # Backend container definition
│   └── .env.example            # Environment variable template
├── frontend/                   # Next.js TypeScript frontend
│   ├── src/
│   │   ├── app/                # Next.js App Router pages
│   │   ├── components/         # Reusable UI components
│   │   ├── lib/                # Utility functions and API client
│   │   ├── hooks/              # Custom React hooks
│   │   └── types/              # TypeScript type definitions
│   ├── public/                 # Static assets
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── Dockerfile              # Frontend container definition
│   └── .env.local.example      # Frontend env template
├── docker-compose.yml          # Full stack orchestration
├── .gitignore
├── README.md                   # Project overview and quick start
└── docs/                       # This documentation
    └── phase1/
```

---

## 2. Backend — Detailed File Tree

### 2.1 Source Root (`backend/src/`)

```
backend/src/
├── __init__.py                     # Empty. Makes src a package.
├── main.py                         # Application entry point
├── config.py                       # Settings management
└── dependencies.py                 # DI container
```

#### `main.py`
**Responsibility**: Create and configure the FastAPI application instance.
- Creates the FastAPI app with title, version, description
- Registers all routers from `api/`
- Configures CORS middleware
- Registers startup/shutdown event handlers (database connection pool, model directory creation)
- Registers global exception handlers
- Does NOT contain any business logic or route handlers

#### `config.py`
**Responsibility**: Single source of truth for all application configuration.
- Defines a `Settings` class extending Pydantic `BaseSettings`
- Reads from environment variables and `.env` file
- Provides typed, validated configuration values
- Exports a singleton `get_settings()` function used via `Depends()`
- Contains ALL configurable values — nothing is hardcoded elsewhere

#### `dependencies.py`
**Responsibility**: Wire concrete implementations to abstract interfaces.
- Creates infrastructure instances (database session, repositories, forecaster, LLM client)
- Exposes FastAPI dependency functions (`get_ingestion_service()`, `get_forecast_service()`, etc.)
- This is the ONLY file that knows about concrete infrastructure classes
- Services and routers never import infrastructure directly — they receive dependencies through this module

---

### 2.2 API Layer (`backend/src/api/`)

```
backend/src/api/
├── __init__.py                     # Empty
├── router.py                       # Root router that includes all sub-routers
├── schemas/                        # Pydantic request/response models
│   ├── __init__.py
│   ├── upload.py                   # Upload request/response schemas
│   ├── data.py                     # Data query request/response schemas
│   ├── forecast.py                 # Forecast request/response schemas
│   ├── query.py                    # NL query request/response schemas
│   └── common.py                   # Shared schemas (pagination, errors)
├── upload_router.py                # POST /upload endpoints
├── data_router.py                  # GET /data endpoints
├── forecast_router.py              # POST /forecast, GET /forecast endpoints
├── query_router.py                 # POST /query endpoint
└── health_router.py                # GET /health endpoint
```

#### `router.py`
**Responsibility**: Aggregate all sub-routers into one root router.
- Includes all routers with proper prefixes and tags
- No route handlers — purely organizational

#### `schemas/upload.py`
**Responsibility**: Define Pydantic models for upload API.
- `UploadResponse`: Success response with row count, warnings, upload ID
- `ColumnMappingRequest`: User-provided column mapping overrides
- `UploadStatusResponse`: Status of a processed upload

#### `schemas/data.py`
**Responsibility**: Define Pydantic models for data browsing API.
- `PaginatedRequest`: page, page_size, sort_by, sort_order
- `SalesDataResponse`: Paginated sales records
- `ProductDataResponse`: Paginated products
- `CustomerDataResponse`: Paginated customers
- `InventoryDataResponse`: Paginated inventory
- `SupplierDataResponse`: Paginated suppliers
- `SummaryMetricsResponse`: Total revenue, order count, avg order value, etc.

#### `schemas/forecast.py`
**Responsibility**: Define Pydantic models for forecast API.
- `ForecastRequest`: horizon_days (30/60/90), granularity (daily/weekly/monthly)
- `ForecastResponse`: List of {date, predicted_value, lower_bound, upper_bound}
- `ForecastStatusResponse`: Training status (training/ready/failed)

#### `schemas/query.py`
**Responsibility**: Define Pydantic models for NL query API.
- `QueryRequest`: question (string)
- `QueryResponse`: answer (string), generated_sql (string), data (optional table)

#### `schemas/common.py`
**Responsibility**: Shared Pydantic models used across routers.
- `ErrorResponse`: status_code, error_type, message, details
- `PaginationMeta`: total_count, page, page_size, total_pages
- `SuccessResponse`: Generic wrapper with status and data

#### `upload_router.py`
**Responsibility**: Handle file upload HTTP requests.
- `POST /api/v1/upload/{entity_type}` — Accept CSV file, entity_type is one of: sales, products, customers, inventory, suppliers
- Validates file type and size
- Calls IngestionService
- Returns UploadResponse

#### `data_router.py`
**Responsibility**: Handle data browsing HTTP requests.
- `GET /api/v1/data/{entity_type}` — Return paginated entity data
- `GET /api/v1/data/summary` — Return summary metrics (total revenue, top product, etc.)
- Query parameters: page, page_size, sort_by, sort_order, date_from, date_to

#### `forecast_router.py`
**Responsibility**: Handle forecast HTTP requests.
- `POST /api/v1/forecast/train` — Trigger model training
- `GET /api/v1/forecast/predict` — Get predictions (query params: horizon, granularity)
- `GET /api/v1/forecast/status` — Check if a trained model exists

#### `query_router.py`
**Responsibility**: Handle natural language query HTTP requests.
- `POST /api/v1/query` — Accept a natural language question, return answer + SQL

#### `health_router.py`
**Responsibility**: Health check endpoint.
- `GET /api/v1/health` — Return status of database, model store, Gemini API

---

### 2.3 Service Layer (`backend/src/services/`)

```
backend/src/services/
├── __init__.py
├── ingestion_service.py            # CSV ingestion orchestration
├── warehouse_service.py            # Data retrieval and aggregation
├── forecast_service.py             # ML model training and prediction
└── query_service.py                # NL question → SQL → answer
```

#### `ingestion_service.py`
**Responsibility**: Orchestrate the entire CSV ingestion pipeline.
- Accepts a file stream and entity type
- Calls CSVParser to parse and validate
- Calls DataCleaner to clean
- Calls SchemaMapper to map columns
- Calls Repository to persist
- Returns ingestion result with statistics and warnings
- Dependencies: CSVParser, DataCleaner, SchemaMapper, Repository (all via interfaces)

#### `warehouse_service.py`
**Responsibility**: Retrieve and aggregate data from the warehouse.
- Paginated entity retrieval
- Summary metrics computation (total revenue, order count, top products)
- Date range filtering
- Sorting
- Dependencies: Repository (via interface)

#### `forecast_service.py`
**Responsibility**: Manage ML model lifecycle.
- Check if sufficient data exists for training
- Trigger model training
- Retrieve predictions
- Check model status
- Dependencies: Repository (for training data), Forecaster (for ML), ModelStorage (for persistence)

#### `query_service.py`
**Responsibility**: Convert natural language to answers.
- Accept a question string
- Retrieve database schema metadata
- Call LLMClient to generate SQL
- Validate generated SQL (read-only, timeout)
- Execute SQL against the warehouse
- Call LLMClient to format results into natural language
- Return answer + SQL
- Dependencies: LLMClient (via interface), Repository (for SQL execution and schema)

---

### 2.4 Domain Layer (`backend/src/domain/`)

```
backend/src/domain/
├── __init__.py
├── entities/                       # Business entities
│   ├── __init__.py
│   ├── sale.py                     # Sale entity
│   ├── product.py                  # Product entity
│   ├── customer.py                 # Customer entity
│   ├── inventory.py                # Inventory entity
│   ├── supplier.py                 # Supplier entity
│   └── upload_record.py           # Upload tracking entity
├── value_objects/                  # Immutable value types
│   ├── __init__.py
│   ├── date_range.py              # DateRange (start, end)
│   ├── pagination.py              # PaginationParams, PaginatedResult
│   ├── forecast_result.py         # ForecastPoint (date, value, lower, upper)
│   ├── ingestion_result.py        # IngestionResult (rows, warnings, errors)
│   └── entity_type.py             # EntityType enum
├── interfaces/                    # Abstract interfaces (protocols)
│   ├── __init__.py
│   ├── repository.py             # Repository protocol
│   ├── csv_parser.py             # CSVParser protocol
│   ├── data_cleaner.py           # DataCleaner protocol
│   ├── schema_mapper.py          # SchemaMapper protocol
│   ├── forecaster.py             # Forecaster protocol
│   ├── llm_client.py             # LLMClient protocol
│   └── model_storage.py          # ModelStorage protocol
└── exceptions.py                  # Domain-specific exceptions
```

#### `entities/sale.py`
**Responsibility**: Define the Sale business entity.
- Fields: id, date, product_id, customer_id, quantity, unit_price, total_amount, upload_id
- Uses Python dataclass (not Pydantic, not SQLAlchemy — pure Python)
- Contains NO database logic, NO serialization logic

#### `entities/product.py`
**Responsibility**: Define the Product business entity.
- Fields: id, name, category, unit_price, description, sku, upload_id

#### `entities/customer.py`
**Responsibility**: Define the Customer business entity.
- Fields: id, name, email, phone, city, segment, upload_id

#### `entities/inventory.py`
**Responsibility**: Define the Inventory business entity.
- Fields: id, product_id, quantity_on_hand, reorder_level, last_updated, warehouse_location, upload_id

#### `entities/supplier.py`
**Responsibility**: Define the Supplier business entity.
- Fields: id, name, contact_email, phone, city, lead_time_days, rating, upload_id

#### `entities/upload_record.py`
**Responsibility**: Track each upload operation.
- Fields: id, filename, entity_type, row_count, warning_count, error_count, status, created_at

#### `interfaces/repository.py`
**Responsibility**: Define the abstract contract for data persistence.
- Methods:
  - `save_sales(records: list[Sale]) -> int` (returns count saved)
  - `save_products(records: list[Product]) -> int`
  - `save_customers(records: list[Customer]) -> int`
  - `save_inventory(records: list[Inventory]) -> int`
  - `save_suppliers(records: list[Supplier]) -> int`
  - `get_sales(pagination, filters) -> PaginatedResult[Sale]`
  - `get_products(pagination, filters) -> PaginatedResult[Product]`
  - `get_customers(pagination, filters) -> PaginatedResult[Customer]`
  - `get_inventory(pagination, filters) -> PaginatedResult[Inventory]`
  - `get_suppliers(pagination, filters) -> PaginatedResult[Supplier]`
  - `get_sales_timeseries(date_range) -> list[Sale]`
  - `execute_readonly_sql(sql: str, timeout: int) -> list[dict]`
  - `get_table_schemas() -> dict[str, list[ColumnInfo]]`
  - `save_upload_record(record: UploadRecord) -> UploadRecord`
- Uses Python `Protocol` (typing module), NOT ABC

#### `interfaces/forecaster.py`
**Responsibility**: Define the abstract contract for time-series forecasting.
- Methods:
  - `train(timeseries: list[tuple[date, float]]) -> TrainingResult`
  - `predict(horizon_days: int) -> list[ForecastPoint]`
  - `is_trained() -> bool`

#### `interfaces/llm_client.py`
**Responsibility**: Define the abstract contract for LLM interaction.
- Methods:
  - `generate_sql(question: str, schema_context: str) -> str`
  - `format_answer(question: str, sql: str, raw_results: list[dict]) -> str`

#### `exceptions.py`
**Responsibility**: Define all domain-specific exceptions.
- `ValidationError`: Invalid data during ingestion
- `InsufficientDataError`: Not enough data for ML training
- `SchemaMapError`: Cannot map CSV columns to expected schema
- `ForecastNotReadyError`: Model not yet trained
- `QueryGenerationError`: LLM failed to generate valid SQL
- `QueryExecutionError`: Generated SQL failed to execute
- `FileTooLargeError`: Upload exceeds size limit
- `UnsupportedFileTypeError`: Non-CSV file uploaded

---

### 2.5 Infrastructure Layer (`backend/src/infrastructure/`)

```
backend/src/infrastructure/
├── __init__.py
├── database/
│   ├── __init__.py
│   ├── engine.py                  # SQLAlchemy async engine setup
│   ├── models.py                  # SQLAlchemy ORM models (table definitions)
│   ├── repository.py             # PostgresRepository implementing Repository protocol
│   └── session.py                # Session factory and dependency
├── ingestion/
│   ├── __init__.py
│   ├── csv_parser.py             # PandasCSVParser implementing CSVParser protocol
│   ├── data_cleaner.py           # PandasDataCleaner implementing DataCleaner protocol
│   └── schema_mapper.py          # FuzzySchemaMapper implementing SchemaMapper protocol
├── ml/
│   ├── __init__.py
│   ├── prophet_forecaster.py     # ProphetForecaster implementing Forecaster protocol
│   └── model_storage.py          # DiskModelStorage implementing ModelStorage protocol
├── llm/
│   ├── __init__.py
│   └── gemini_client.py          # GeminiLLMClient implementing LLMClient protocol
└── logging/
    ├── __init__.py
    └── setup.py                   # Structured logging configuration
```

#### `database/engine.py`
**Responsibility**: Create and manage the async SQLAlchemy engine.
- Create engine from DATABASE_URL
- Configure connection pool (pool_size=5, max_overflow=10)
- Provide engine to session factory
- Handle startup connection test and shutdown cleanup

#### `database/models.py`
**Responsibility**: Define SQLAlchemy ORM table models.
- `SaleModel` — maps to `sales` table
- `ProductModel` — maps to `products` table
- `CustomerModel` — maps to `customers` table
- `InventoryModel` — maps to `inventory` table
- `SupplierModel` — maps to `suppliers` table
- `UploadRecordModel` — maps to `upload_records` table
- Each model includes: column definitions, indexes, constraints, table name
- Models define the DB schema; domain entities define the business interface. They are separate.

#### `database/repository.py`
**Responsibility**: Implement the Repository protocol using SQLAlchemy.
- Translates between domain entities and ORM models
- Implements all Repository methods
- Handles pagination SQL (LIMIT, OFFSET, ORDER BY)
- Handles date range filtering
- Implements `execute_readonly_sql()` with timeout and statement validation
- Implements `get_table_schemas()` by querying `information_schema`

#### `database/session.py`
**Responsibility**: Provide async database sessions.
- Create async session factory
- Provide `get_session()` dependency function
- Sessions are request-scoped (created per request, closed after)

#### `ingestion/csv_parser.py`
**Responsibility**: Parse CSV files using pandas.
- Read CSV with encoding detection (chardet)
- Detect delimiter (comma, semicolon, tab)
- Validate header row exists
- Validate row count within limits
- Return parsed DataFrame with metadata (row count, columns, detected types)
- Handle parse errors gracefully with descriptive messages

#### `ingestion/data_cleaner.py`
**Responsibility**: Clean parsed data.
- Strip whitespace from string columns
- Normalize date formats (attempt multiple formats: YYYY-MM-DD, DD/MM/YYYY, MM-DD-YYYY, etc.)
- Handle missing values:
  - Numeric: fill with 0 or column median (configurable)
  - String: fill with "Unknown"
  - Date: flag as warning, do not fill
- Remove duplicate rows
- Remove completely empty rows
- Return cleaned DataFrame with list of applied transformations (warnings)

#### `ingestion/schema_mapper.py`
**Responsibility**: Map CSV column names to expected database schema.
- Define expected columns per entity type (e.g., sales expects: date, product, quantity, price)
- Use fuzzy matching to map user column names to expected names
  - "Sale Date" → "date" (fuzzy match)
  - "Qty" → "quantity" (alias match)
  - "Amount" → "total_amount" (alias match)
- Define alias dictionaries for common variations
- Return column mapping with confidence scores
- Raise `SchemaMapError` if required columns cannot be mapped

#### `ml/prophet_forecaster.py`
**Responsibility**: Implement Forecaster using Facebook Prophet.
- Accept time-series data as list of (date, value) tuples
- Configure Prophet with:
  - yearly_seasonality=True
  - weekly_seasonality=True
  - daily_seasonality=False (too noisy for small business data)
  - interval_width=0.80 (80% confidence interval)
- Train model
- Generate predictions for specified horizon
- Serialize model to JSON for persistence
- Load model from JSON

#### `ml/model_storage.py`
**Responsibility**: Persist and retrieve trained ML models.
- Save serialized model to disk with timestamped filename
- Load latest model for an entity
- List available models
- Delete old models (keep latest N)
- Directory: configured via `ML_MODELS_DIR`

#### `llm/gemini_client.py`
**Responsibility**: Implement LLMClient using Google Gemini Pro.
- Initialize Gemini client with API key
- Implement `generate_sql()`:
  - Construct prompt with database schema context
  - Send to Gemini
  - Extract SQL from response (handle markdown code blocks)
  - Validate extracted SQL is a SELECT statement
- Implement `format_answer()`:
  - Construct prompt with question + SQL + raw results
  - Send to Gemini
  - Return formatted natural language answer
- Handle API errors with retry logic
- Handle rate limiting with backoff

#### `logging/setup.py`
**Responsibility**: Configure structured JSON logging.
- Set up Python `logging` with JSON formatter
- Configure log levels from Settings
- Add request ID filter for tracing
- Output to stdout (Docker-friendly)

---

## 3. Frontend — Detailed File Tree

```
frontend/src/
├── app/                            # Next.js App Router
│   ├── layout.tsx                  # Root layout (fonts, theme provider, global styles)
│   ├── page.tsx                    # Landing/dashboard page (redirect to /dashboard)
│   ├── globals.css                 # Global CSS variables, resets, design tokens
│   ├── dashboard/
│   │   └── page.tsx                # Main dashboard with metrics and charts
│   ├── upload/
│   │   └── page.tsx                # Data upload interface
│   ├── forecast/
│   │   └── page.tsx                # Forecast visualization page
│   └── query/
│       └── page.tsx                # Natural language Q&A page
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx             # Navigation sidebar
│   │   ├── Header.tsx              # Top header bar
│   │   └── PageContainer.tsx       # Content area wrapper with padding/max-width
│   ├── upload/
│   │   ├── FileDropzone.tsx        # Drag-and-drop file upload area
│   │   ├── UploadProgress.tsx      # Upload progress indicator
│   │   ├── UploadResult.tsx        # Post-upload summary (rows, warnings)
│   │   └── EntityTypeSelector.tsx  # Dropdown to select data type being uploaded
│   ├── dashboard/
│   │   ├── MetricCard.tsx          # Single KPI metric display (revenue, orders, etc.)
│   │   ├── SalesChart.tsx          # Sales trend line chart
│   │   ├── TopProductsChart.tsx    # Top products bar chart
│   │   └── DataTable.tsx           # Generic paginated data table
│   ├── forecast/
│   │   ├── ForecastChart.tsx       # Forecast visualization (actual + predicted + CI)
│   │   ├── ForecastControls.tsx    # Horizon selector, train button
│   │   └── ForecastStatus.tsx      # Model training status indicator
│   ├── query/
│   │   ├── ChatInterface.tsx       # Chat-style Q&A interface
│   │   ├── ChatMessage.tsx         # Single message bubble (user or AI)
│   │   ├── SQLDisplay.tsx          # Collapsible SQL query display
│   │   └── QueryInput.tsx          # Text input with send button
│   └── ui/                         # Generic reusable UI primitives
│       ├── Button.tsx              # Styled button component
│       ├── Card.tsx                # Card container with shadow/border
│       ├── Loading.tsx             # Loading spinner/skeleton
│       ├── ErrorAlert.tsx          # Error message display
│       └── Badge.tsx               # Status badge (success, warning, error)
├── lib/
│   ├── api.ts                      # API client (fetch wrapper with base URL, error handling)
│   ├── formatters.ts               # Number, date, currency formatting utilities
│   └── constants.ts                # App-wide constants (API URL, entity types, etc.)
├── hooks/
│   ├── useUpload.ts                # Upload state management hook
│   ├── useSalesData.ts             # Sales data fetching hook
│   ├── useForecast.ts              # Forecast data and training hook
│   ├── useQuery.ts                 # NL query submission hook
│   └── useSummary.ts               # Dashboard summary metrics hook
└── types/
    ├── api.ts                      # API response type definitions
    ├── data.ts                     # Business data type definitions
    └── chart.ts                    # Chart data type definitions
```

---

## 4. Module Boundary Rules

### Rule 1: No Cross-Layer Imports (Backend)

```
✅ api → services → domain ← infrastructure
❌ api → infrastructure (skip services)
❌ services → infrastructure (use interfaces)
❌ domain → anything external
```

### Rule 2: No Circular Dependencies

No module may import from a module that imports from it. If A imports B, B must NOT import A (directly or transitively).

### Rule 3: Infrastructure Isolation

Each infrastructure subdirectory (`database/`, `ingestion/`, `ml/`, `llm/`) is self-contained. They may import from `domain/` but NEVER from each other.

```
❌ infrastructure/ml/ → infrastructure/database/
❌ infrastructure/llm/ → infrastructure/ingestion/
```

Cross-infrastructure coordination happens ONLY in the service layer.

### Rule 4: Frontend Component Isolation

- `components/upload/` only deals with upload concerns
- `components/dashboard/` only deals with dashboard visualization
- `components/forecast/` only deals with forecast display
- `components/query/` only deals with Q&A
- `components/ui/` are generic — they know nothing about business logic

### Rule 5: API Client Centralization

All frontend API calls go through `lib/api.ts`. No component directly calls `fetch()`.

---

## 5. Naming Conventions

### Python (Backend)

| Element | Convention | Example |
|---|---|---|
| Files | `snake_case.py` | `ingestion_service.py` |
| Classes | `PascalCase` | `IngestionService` |
| Functions/Methods | `snake_case` | `process_upload()` |
| Variables | `snake_case` | `row_count` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_UPLOAD_SIZE` |
| Protocols/Interfaces | `PascalCase` (no prefix) | `Repository`, `Forecaster` |
| Private methods | `_leading_underscore` | `_validate_columns()` |
| Type aliases | `PascalCase` | `ColumnMapping = dict[str, str]` |
| Enum values | `UPPER_SNAKE_CASE` | `EntityType.SALES` |
| Test files | `test_{module}.py` | `test_ingestion_service.py` |
| Test functions | `test_{behavior}` | `test_upload_valid_csv_returns_count()` |

### TypeScript (Frontend)

| Element | Convention | Example |
|---|---|---|
| Files (components) | `PascalCase.tsx` | `MetricCard.tsx` |
| Files (utilities) | `camelCase.ts` | `formatters.ts` |
| Files (hooks) | `camelCase.ts` with `use` prefix | `useSalesData.ts` |
| Files (types) | `camelCase.ts` | `api.ts` |
| Components | `PascalCase` | `SalesChart` |
| Functions | `camelCase` | `fetchSalesData()` |
| Variables | `camelCase` | `totalRevenue` |
| Constants | `UPPER_SNAKE_CASE` | `API_BASE_URL` |
| Types/Interfaces | `PascalCase` | `SaleRecord`, `ForecastPoint` |
| Hooks | `usePascalCase` | `useForecast()` |
| CSS classes | `kebab-case` | `metric-card`, `chart-container` |

### Database

| Element | Convention | Example |
|---|---|---|
| Tables | `snake_case` (plural) | `sales`, `products`, `upload_records` |
| Columns | `snake_case` | `unit_price`, `created_at` |
| Primary keys | `id` | `id` (always) |
| Foreign keys | `{referenced_table_singular}_id` | `product_id`, `customer_id` |
| Indexes | `ix_{table}_{column}` | `ix_sales_date` |
| Unique constraints | `uq_{table}_{column}` | `uq_products_sku` |

### API Endpoints

| Element | Convention | Example |
|---|---|---|
| Base path | `/api/v1/` | Always versioned |
| Resource paths | `/api/v1/{resource}` (plural noun) | `/api/v1/data`, `/api/v1/forecast` |
| Actions | `POST` for actions, `GET` for retrieval | `POST /forecast/train`, `GET /forecast/predict` |
| Query params | `snake_case` | `?page_size=20&sort_by=date` |
