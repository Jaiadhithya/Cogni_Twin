# Phase 1 — Error Handling and Logging Specification

> **Document Purpose**: Define the error taxonomy, error response format, logging strategy, structured log format, health check design, and request tracing. An AI coding agent should be able to implement all error handling and logging from this document alone.

---

## 1. Error Handling Philosophy

### Principles

1. **Errors are expected, not exceptional**: File uploads will fail. LLM calls will time out. Users will ask nonsensical questions. The system must handle all of these gracefully.

2. **User-facing errors are friendly**: Never expose stack traces, database error codes, or technical jargon to the user. Every error message should be understandable by a small business owner.

3. **Developer-facing errors are detailed**: Log entries include full context — stack traces, request IDs, parameters, timing — for debugging.

4. **Errors are typed**: Every error has a machine-readable type (e.g., `VALIDATION_ERROR`) so the frontend can react programmatically (show different UI for different error types).

5. **Never silently swallow errors**: Every exception is either handled (caught, logged, converted to a user error) or propagated. No bare `except: pass`.

---

## 2. Error Taxonomy

### Domain Exceptions (`backend/src/domain/exceptions.py`)

These are business-logic errors defined in the domain layer. They carry no HTTP information.

| Exception Class | When Raised | Example |
|---|---|---|
| `CogniTwinError` | Base exception for all domain errors | Never raised directly |
| `ValidationError` | Data validation failed | "Quantity must be positive" |
| `FileValidationError` | Uploaded file is invalid | "File must be CSV" |
| `SchemaMapError` | Cannot map CSV to schema | "Required column 'sale_date' not found" |
| `InsufficientDataError` | Not enough data for operation | "Need 30+ data points for forecasting" |
| `ForecastNotReadyError` | No trained model available | "Train a model first" |
| `QueryGenerationError` | LLM failed to generate SQL | "Could not understand the question" |
| `QueryExecutionError` | Generated SQL failed | "Query execution failed" |
| `RateLimitError` | Too many requests | "Rate limit exceeded" |
| `ExternalServiceError` | External API failed | "Gemini API unavailable" |

### Exception Hierarchy

```
CogniTwinError
├── ValidationError
│   ├── FileValidationError
│   └── SchemaMapError
├── InsufficientDataError
├── ForecastNotReadyError
├── QueryGenerationError
├── QueryExecutionError
├── RateLimitError
└── ExternalServiceError
```

### Exception to HTTP Status Code Mapping

This mapping is defined ONLY in the API layer (global exception handler). Domain exceptions know nothing about HTTP.

| Exception | HTTP Status | Error Type |
|---|---|---|
| `FileValidationError` | 400 | `FILE_VALIDATION_ERROR` |
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `SchemaMapError` | 400 | `SCHEMA_MAPPING_ERROR` |
| `InsufficientDataError` | 400 | `INSUFFICIENT_DATA_ERROR` |
| `QueryGenerationError` | 422 | `QUERY_GENERATION_ERROR` |
| `QueryExecutionError` | 422 | `QUERY_EXECUTION_ERROR` |
| `ForecastNotReadyError` | 409 | `FORECAST_NOT_READY` |
| `RateLimitError` | 429 | `RATE_LIMITED` |
| `ExternalServiceError` | 503 | `LLM_UNAVAILABLE` or `DATABASE_UNAVAILABLE` |
| `Pydantic ValidationError` | 422 | `VALIDATION_ERROR` |
| `Exception` (unhandled) | 500 | `INTERNAL_ERROR` |

---

## 3. Global Exception Handler

Register a global exception handler in `main.py` that catches all exceptions and converts them to the standard error response format:

```
{
  "status": "error",
  "error": {
    "type": "<ERROR_TYPE>",
    "message": "<user-friendly message>",
    "details": [<additional context>]
  }
}
```

### Handler Behavior

1. **`CogniTwinError` subclasses**: Map to appropriate HTTP status and error type. Use the exception's message as the user-facing message.

2. **Pydantic `ValidationError`**: Map to 422. Format field errors as details array:
   ```json
   {
     "details": [
       { "field": "question", "message": "String must have at least 5 characters" }
     ]
   }
   ```

3. **`asyncpg.exceptions.ConnectionDoesNotExistError`** (or any DB connection error): Map to 503 `DATABASE_UNAVAILABLE`.

4. **Any unhandled `Exception`**: Map to 500 `INTERNAL_ERROR`. The user sees "An unexpected error occurred. Please try again." The actual exception is logged with full traceback.

### Critical Rule

The global handler must NEVER expose:
- Stack traces to the client
- Database connection strings
- API keys
- Internal file paths
- SQL queries from database errors (only from the intentional LLM query flow)

---

## 4. Error Propagation Flow

```
Infrastructure Layer (catches external errors)
       │
       │  Wraps in domain exception with context
       ▼
Service Layer (catches domain exceptions if recoverable)
       │
       │  May retry, may re-raise
       ▼
API Layer (catches nothing — lets global handler process)
       │
       ▼
Global Exception Handler
       │
       │  Maps to HTTP response
       ▼
JSON Error Response → Client
```

### Example Flow: Gemini API Timeout

```
1. gemini_client.py: google.api_core.exceptions.DeadlineExceeded is raised
2. gemini_client.py: Catches it, retries once
3. gemini_client.py: Still fails → raises ExternalServiceError("Gemini API timed out after 2 attempts")
4. query_service.py: Does NOT catch ExternalServiceError (not recoverable)
5. query_router.py: Does NOT catch it either
6. Global handler: Catches ExternalServiceError → 503 LLM_UNAVAILABLE
7. Logs: ERROR with full context (request_id, question, retry count, timeout values)
8. Client receives: {"status": "error", "error": {"type": "LLM_UNAVAILABLE", ...}}
```

---

## 5. Logging Strategy

### Log Format: Structured JSON

All log output is JSON-formatted to stdout. This enables:
- Machine-parseable logs for Docker log drivers
- Easy filtering and searching
- Structured data (not string concatenation)

### Log Entry Structure

Every log entry includes these fields:

| Field | Type | Description |
|---|---|---|
| `timestamp` | string (ISO 8601) | When the log was created |
| `level` | string | DEBUG, INFO, WARNING, ERROR, CRITICAL |
| `logger` | string | Logger name (typically module path) |
| `message` | string | Human-readable log message |
| `request_id` | string or null | Request trace ID (null for non-request logs) |
| `module` | string | Python module name |
| `function` | string | Function name |
| `extra` | object | Additional context data (varies per log event) |

### Example Log Entries

**Request log:**
```json
{
  "timestamp": "2024-12-15T10:30:00.123Z",
  "level": "INFO",
  "logger": "src.api",
  "message": "Request completed",
  "request_id": "req_a1b2c3d4e5f6",
  "module": "middleware",
  "function": "log_request",
  "extra": {
    "method": "POST",
    "path": "/api/v1/upload/sales",
    "status_code": 201,
    "duration_ms": 2340,
    "client_ip": "127.0.0.1"
  }
}
```

**Upload processing log:**
```json
{
  "timestamp": "2024-12-15T10:30:02.456Z",
  "level": "INFO",
  "logger": "src.services.ingestion",
  "message": "CSV ingestion completed",
  "request_id": "req_a1b2c3d4e5f6",
  "module": "ingestion_service",
  "function": "process_upload",
  "extra": {
    "filename": "sales_2024.csv",
    "entity_type": "sales",
    "rows_ingested": 4380,
    "rows_skipped": 5,
    "warning_count": 12,
    "processing_time_ms": 2100
  }
}
```

**Error log:**
```json
{
  "timestamp": "2024-12-15T10:35:00.789Z",
  "level": "ERROR",
  "logger": "src.infrastructure.llm",
  "message": "Gemini API call failed",
  "request_id": "req_b2c3d4e5f6a7",
  "module": "gemini_client",
  "function": "generate_sql",
  "extra": {
    "question": "What were sales?",
    "error_type": "DeadlineExceeded",
    "retry_count": 2,
    "timeout_seconds": 30
  }
}
```

### Log Levels — When to Use What

| Level | When to Use | Example |
|---|---|---|
| `DEBUG` | Detailed diagnostic info, only in development | Column mapping details, SQL query text |
| `INFO` | Normal operations worth recording | Request completed, upload processed, model trained |
| `WARNING` | Unexpected but handled situations | Fuzzy match low confidence, date format auto-converted, retry succeeded |
| `ERROR` | Failed operations that affect the user | LLM call failed, database query error, upload rejected |
| `CRITICAL` | System-level failures | Database connection lost, cannot write to model directory |

### What to ALWAYS Log

| Event | Level | Extra Fields |
|---|---|---|
| Request start | DEBUG | method, path |
| Request complete | INFO | method, path, status_code, duration_ms |
| File upload received | INFO | filename, file_size_bytes, entity_type |
| Ingestion complete | INFO | rows_ingested, rows_skipped, warning_count |
| Schema mapping applied | INFO | column_mapping (dict) |
| Model training start | INFO | data_points, granularity |
| Model training complete | INFO | duration_seconds, evaluation_metrics |
| NL query received | INFO | question (first 100 chars) |
| SQL generated | DEBUG | generated_sql |
| SQL executed | INFO | execution_time_ms, row_count |
| Gemini API call | DEBUG | prompt_length, response_length, latency_ms |
| Any error | ERROR | error_type, message, stack_trace (in extra) |
| Rate limit hit | WARNING | client_ip, endpoint, limit, window |

### What to NEVER Log

- Full API keys (log last 4 chars only: `...abcd`)
- Full uploaded file contents
- Full database connection strings (log host:port only)
- User PII beyond what's in the business data

---

## 6. Request Tracing

### Request ID Generation

Every incoming request gets a unique ID:

```
Format: req_{12 hex chars from UUID4}
Example: req_a1b2c3d4e5f6
```

### Implementation

A FastAPI middleware:
1. Generate request ID at request start
2. Store in request state (`request.state.request_id`)
3. Add to response header: `X-Request-Id: req_a1b2c3d4e5f6`
4. Inject into Python logging context using a logging filter
5. All log entries during this request automatically include the request_id

### Why Request IDs Matter

When a user reports "the upload failed," the support person (or developer) can:
1. Get the request ID from the error response
2. Search logs for that request ID
3. See the complete trace: request received → file parsed → schema mapped → cleaning → error at row 45

---

## 7. Health Check Design

### `GET /api/v1/health`

Checks three components:

#### Database Health
- Execute `SELECT 1` with a 5-second timeout
- If succeeds: `{"status": "healthy", "latency_ms": 12}`
- If fails: `{"status": "unhealthy", "error": "Connection timeout"}`

#### Model Store Health
- Check that `ML_MODELS_DIR` exists and is writable (attempt to create a temp file and delete it)
- Report number of saved models
- If accessible: `{"status": "healthy", "models_count": 1}`
- If not: `{"status": "unhealthy", "error": "Directory not writable"}`

#### LLM API Health
- Do NOT call the Gemini API (wastes quota and money)
- Instead, verify that `GEMINI_API_KEY` is configured and non-empty
- If configured: `{"status": "healthy", "provider": "gemini"}`
- If not: `{"status": "unhealthy", "error": "API key not configured"}`

### Overall Status

- `healthy`: ALL components are healthy → HTTP 200
- `degraded`: SOME components are unhealthy → HTTP 503 (but still return JSON body)
- `unhealthy`: ALL components are unhealthy → HTTP 503

The frontend uses this to show the system health indicator in the header.

---

## 8. Middleware Stack

Applied in this order (outermost to innermost):

1. **Request ID middleware**: Generate and attach request ID
2. **Request logging middleware**: Log request start and completion with timing
3. **CORS middleware**: Handle CORS preflight and headers
4. **Rate limiting middleware**: Check rate limits on applicable endpoints
5. **Exception handler**: Global exception handler (registered as FastAPI exception handler, not middleware)

### Middleware Implementation Notes

- Request logging middleware wraps the request handler to capture `duration_ms = end - start`
- CORS middleware uses FastAPI's built-in `CORSMiddleware`
- Rate limiting middleware uses an in-memory sliding window counter (dictionary of endpoint → request timestamps)
- All middleware is async-compatible
