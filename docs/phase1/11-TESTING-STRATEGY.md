# Phase 1 — Testing Strategy

> **Document Purpose**: Define what to test, how to test, test organization, test data strategy, and coverage expectations. An AI coding agent should be able to write the complete test suite from this document alone.

---

## 1. Testing Philosophy

1. **Test behavior, not implementation**: Tests verify what a module does, not how it does it. Refactoring internals should not break tests.
2. **Test at the right level**: Unit tests for business logic, integration tests for infrastructure, end-to-end tests for critical user flows.
3. **Fast feedback**: The full test suite should complete in under 60 seconds. Tests that require external services (Gemini API) use mocks.
4. **Deterministic**: No test depends on real-time, network access, or random values (seed all random generators).

---

## 2. Testing Pyramid

```
        /  E2E  \         ← 3-5 tests (critical user flows)
       /──────────\
      / Integration \     ← 15-20 tests (database, API endpoints)
     /────────────────\
    /     Unit Tests    \  ← 40-60 tests (business logic, utilities)
   /──────────────────────\
```

---

## 3. Test Organization

```
backend/tests/
├── __init__.py
├── conftest.py                  # Shared fixtures (DB session, test client, mocks)
├── unit/                        # Pure logic tests, no external deps
│   ├── __init__.py
│   ├── test_csv_parser.py       # CSV parsing logic
│   ├── test_data_cleaner.py     # Data cleaning logic
│   ├── test_schema_mapper.py    # Column mapping logic
│   ├── test_row_validator.py    # Row validation rules
│   ├── test_sql_validator.py    # SQL safety validation
│   ├── test_config.py           # Configuration loading
│   └── test_entities.py         # Domain entity creation/validation
├── integration/                 # Tests with real DB or full API
│   ├── __init__.py
│   ├── test_upload_api.py       # Upload endpoint integration
│   ├── test_data_api.py         # Data retrieval endpoint
│   ├── test_forecast_api.py     # Forecast endpoint
│   ├── test_query_api.py        # NL query endpoint (mocked LLM)
│   ├── test_repository.py       # Database repository operations
│   └── test_health_api.py       # Health check endpoint
└── test_data/                   # CSV fixtures
    ├── valid_sales.csv
    ├── valid_products.csv
    ├── valid_customers.csv
    ├── valid_inventory.csv
    ├── valid_suppliers.csv
    ├── malformed_csv.csv         # Bad encoding/formatting
    ├── missing_columns.csv       # Missing required columns
    ├── empty_file.csv            # Empty file (header only)
    ├── large_file.csv            # Near-limit size file
    ├── weird_column_names.csv    # Column names needing fuzzy match
    └── mixed_date_formats.csv    # Multiple date formats
```

---

## 4. Test Fixtures (`conftest.py`)

### Shared Fixtures

#### `test_db_session`
- Creates a temporary PostgreSQL test database (or uses a test schema)
- Runs Alembic migrations
- Yields an async session
- Rolls back all changes after each test (transactional isolation)
- **Alternative for CI**: Use SQLite in-memory for unit tests (with SQLAlchemy compatibility), PostgreSQL for integration tests

#### `test_client`
- Creates a FastAPI `AsyncClient` (from `httpx`) using the test app
- Uses test database session
- Uses mocked LLM client
- Uses temporary model storage directory

#### `mock_llm_client`
- Returns a fake `LLMClient` implementation that:
  - `generate_sql()`: Returns pre-defined SQL for known questions, raises `QueryGenerationError` for unknown
  - `format_answer()`: Returns a template answer with the data filled in
- No actual Gemini API calls in tests

#### `mock_forecaster`
- Returns a fake `Forecaster` that:
  - `train()`: Always succeeds immediately
  - `predict()`: Returns deterministic fake forecast data
  - `is_trained()`: Returns True after `train()` is called

#### `seed_sales_data`
- Inserts 100 sales records spanning 90 days into the test database
- Returns the inserted records for assertion

#### `seed_products_data`
- Inserts 10 products into the test database

---

## 5. Unit Tests

### `test_csv_parser.py`

| Test | Input | Expected Output |
|---|---|---|
| Parse valid CSV | `valid_sales.csv` | DataFrame with correct columns, row count |
| Detect comma delimiter | CSV with commas | Parsed correctly |
| Detect semicolon delimiter | CSV with semicolons | Parsed correctly |
| Detect tab delimiter | CSV with tabs | Parsed correctly |
| Handle UTF-8 BOM | CSV with BOM | Parsed correctly, BOM stripped |
| Reject non-CSV file | Binary file | Raises `FileValidationError` |
| Reject oversized file | 60MB file (mock size) | Raises `FileValidationError` |
| Reject empty file | 0 bytes | Raises `FileValidationError` |
| Reject header-only file | 1 line CSV | Raises `FileValidationError` |
| Handle duplicate column names | "Name, Name, Price" | Renamed to "Name", "Name_1", "Price" |

### `test_data_cleaner.py`

| Test | Input | Expected Output |
|---|---|---|
| Strip whitespace | `"  hello  "` | `"hello"` |
| Parse ISO date | `"2024-12-15"` | `datetime(2024, 12, 15)` |
| Parse DD/MM/YYYY date | `"15/12/2024"` | `datetime(2024, 12, 15)` |
| Parse DD-Mon-YYYY date | `"15-Dec-2024"` | `datetime(2024, 12, 15)` |
| Remove currency symbols | `"₹1,499.00"` | `1499.00` |
| Handle Indian numbering | `"1,49,900"` | `149900.0` |
| Fill missing quantity with 1 | quantity=NaN, total=500, price=500 | quantity=1 |
| Compute total from qty × price | quantity=3, price=100, total=NaN | total=300.0 |
| Remove duplicate rows | 3 identical rows | 1 row, warning logged |
| Remove empty rows | Row with all NaN | Row removed, warning logged |
| Handle all-null date column | All date values are empty | All set to None, warnings |

### `test_schema_mapper.py`

| Test | Input CSV Columns | Entity Type | Expected Mapping |
|---|---|---|---|
| Exact match | `sale_date, total_amount` | sales | `{"sale_date": "sale_date", "total_amount": "total_amount"}` |
| Alias match | `Date, Amt` | sales | `{"Date": "sale_date", "Amt": "total_amount"}` |
| Fuzzy match | `Sale Date, Grand Total` | sales | `{"Sale Date": "sale_date", "Grand Total": "total_amount"}` |
| Missing required | `Name, Color` | sales | Raises `SchemaMapError` (no date or amount) |
| All products columns | `Product, Category, Price` | products | Correct mapping |
| Extra columns ignored | `date, amount, weather` | sales | `weather` not mapped, warning |
| Case insensitive | `DATE, AMOUNT, QTY` | sales | Correctly mapped |

### `test_sql_validator.py`

| Test | Input SQL | Expected Result |
|---|---|---|
| Valid SELECT | `SELECT * FROM sales` | Passes validation |
| Valid WITH (CTE) | `WITH cte AS (...) SELECT ...` | Passes validation |
| Block INSERT | `INSERT INTO sales...` | Raises `QueryGenerationError` |
| Block UPDATE | `UPDATE sales SET...` | Raises `QueryGenerationError` |
| Block DELETE | `DELETE FROM sales` | Raises `QueryGenerationError` |
| Block DROP | `DROP TABLE sales` | Raises `QueryGenerationError` |
| Block multiple statements | `SELECT 1; DROP TABLE sales` | Raises `QueryGenerationError` |
| Block system tables | `SELECT * FROM pg_catalog.pg_tables` | Raises `QueryGenerationError` |
| Strip code blocks | `` ```sql\nSELECT 1\n``` `` | Returns `SELECT 1` |
| Handle CANNOT_ANSWER | `CANNOT_ANSWER: Not about data` | Raises `QueryGenerationError` with reason |
| Empty response | `""` | Raises `QueryGenerationError` |

### `test_entities.py`

| Test | Description |
|---|---|
| Create Sale entity | All fields set correctly, id is UUID |
| Create Product entity | Required fields enforced |
| EntityType enum | All 5 entity types exist |
| ForecastPoint | date, predicted, lower, upper fields |
| IngestionResult | rows, warnings, errors tracking |

---

## 6. Integration Tests

### `test_upload_api.py`

| Test | Action | Expected |
|---|---|---|
| Upload valid sales CSV | POST valid CSV to /upload/sales | 201, correct row count |
| Upload valid products CSV | POST to /upload/products | 201 |
| Upload invalid entity type | POST to /upload/orders | 422 (path validation) |
| Upload non-CSV file | POST .pdf file | 400, FILE_VALIDATION_ERROR |
| Upload empty file | POST 0-byte file | 400, FILE_VALIDATION_ERROR |
| Upload with fuzzy columns | POST CSV with "Dt", "Amt" columns | 201, mapping in response |
| Upload with missing required cols | POST CSV missing date/amount | 400, SCHEMA_MAPPING_ERROR |
| Data persisted in DB | Upload then GET /data/sales | Same row count |

### `test_data_api.py`

| Test | Action | Expected |
|---|---|---|
| Get sales (empty DB) | GET /data/sales | 404, NOT_FOUND |
| Get sales (with data) | Seed data then GET /data/sales | 200, paginated results |
| Pagination works | GET /data/sales?page=2&page_size=10 | Correct page metadata |
| Sort works | GET /data/sales?sort_by=total_amount&sort_order=desc | First record has highest amount |
| Date filter works | GET /data/sales?date_from=2024-06-01&date_to=2024-06-30 | Only June records |
| Get summary | GET /data/summary | 200, metrics object |
| Get uploads | GET /data/uploads | 200, upload history |

### `test_forecast_api.py`

| Test | Action | Expected |
|---|---|---|
| Train with no data | POST /forecast/train (empty DB) | 400, INSUFFICIENT_DATA_ERROR |
| Train with sufficient data | Seed 100 days, POST /forecast/train | 202, training result |
| Predict after training | Train then GET /forecast/predict | 200, forecast points |
| Predict without training | GET /forecast/predict (no model) | 409, FORECAST_NOT_READY |
| Check status (no model) | GET /forecast/status | 200, model_available=false |
| Check status (with model) | Train then GET /forecast/status | 200, model_available=true |
| Horizon capped at 90 | GET /forecast/predict?horizon_days=180 | Returns 90 days of predictions |

### `test_query_api.py` (uses mock LLM)

| Test | Action | Expected |
|---|---|---|
| Ask valid question | POST /query with known question | 200, answer + SQL |
| Ask nonsense | POST /query with gibberish | 422, QUERY_GENERATION_ERROR |
| Empty question | POST /query with "" | 422, validation error |
| Too short question | POST /query with "hi" | 422, validation error (min 5 chars) |
| Response includes SQL | POST /query | generated_sql field present |
| Rate limiting | Send 11 requests in 1 minute | 11th returns 429 |

### `test_health_api.py`

| Test | Action | Expected |
|---|---|---|
| All healthy | GET /health (normal) | 200, status=healthy |
| DB down | GET /health (mock DB failure) | 503, database unhealthy |

---

## 7. Test Data Files

### `test_data/valid_sales.csv`

```csv
Date,Product,Customer,Qty,Price,Total,Discount,Payment
2024-01-15,Wireless Earbuds,Rahul Sharma,2,1499.00,2998.00,0,UPI
2024-01-15,USB-C Hub,Priya Patel,1,1200.00,1200.00,0,Card
2024-01-16,LED Desk Lamp,Amit Kumar,3,500.00,1500.00,75.00,Cash
... (at least 50 rows covering various scenarios)
```

### `test_data/weird_column_names.csv`

```csv
Dt,Prod Name,Cust,No of Items,Rate,Amt,Disc,Pay Mode
2024-01-15,Wireless Earbuds,Rahul Sharma,2,1499.00,2998.00,0,UPI
```
(Tests fuzzy column matching)

### `test_data/mixed_date_formats.csv`

```csv
date,amount
2024-01-15,1000
15/01/2024,2000
01-15-2024,3000
15-Jan-2024,4000
```
(Tests date format detection)

### `test_data/malformed_csv.csv`

```csv
a,b,c
1,2,3
1,2
1,2,3,4
"unclosed quote,2,3
```
(Tests error handling for bad CSV)

---

## 8. Running Tests

### Commands

```bash
# Run all tests
pytest

# Run unit tests only
pytest tests/unit/

# Run integration tests only
pytest tests/integration/

# Run with coverage report
pytest --cov=src --cov-report=term-missing

# Run a specific test file
pytest tests/unit/test_schema_mapper.py

# Run a specific test
pytest tests/unit/test_schema_mapper.py::test_fuzzy_match_sale_date

# Run with verbose output
pytest -v
```

### Coverage Target

| Module | Minimum Coverage | Rationale |
|---|---|---|
| `domain/` | 95% | Pure logic, easy to test, critical to be correct |
| `services/` | 85% | Business orchestration, key workflows |
| `infrastructure/ingestion/` | 90% | Data quality depends on this |
| `infrastructure/ml/` | 75% | Some ML internals are hard to unit test |
| `infrastructure/llm/` | 70% | Heavily mocked, lower value in unit coverage |
| `infrastructure/database/` | 80% | SQL queries, repository methods |
| `api/` | 80% | Endpoint behavior, error handling |
| **Overall** | **80%** | Minimum acceptable for Phase 1 |

---

## 9. Testing Rules

### DO

- Test edge cases (empty input, max values, null values)
- Test error paths (not just happy paths)
- Use descriptive test names: `test_upload_csv_with_missing_date_column_returns_schema_error`
- Use fixtures for shared setup
- Assert specific values, not just `is not None`

### DO NOT

- Call the real Gemini API in tests (use mocks)
- Depend on test execution order
- Use `time.sleep()` in tests
- Test framework internals (don't test that FastAPI routes correctly — test your handler logic)
- Write tests that take more than 5 seconds individually
