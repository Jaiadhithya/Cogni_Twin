# Phase 1 — API Specification

> **Document Purpose**: Define every HTTP endpoint, request/response format, status code, error response, and behavioral contract. An AI coding agent should be able to implement all FastAPI routers from this document alone.

---

## 1. API Design Principles

1. **REST conventions**: Resources are nouns (`/data`, `/forecast`), actions are HTTP methods.
2. **Versioned**: All endpoints prefixed with `/api/v1/`. This allows future `/api/v2/` without breaking existing clients.
3. **Consistent error format**: Every error response uses the same JSON structure regardless of the error type.
4. **Pagination by default**: All list endpoints return paginated results.
5. **ISO 8601 dates**: All dates in `YYYY-MM-DD` format. All timestamps in ISO 8601 with timezone.

---

## 2. Base Configuration

| Property | Value |
|---|---|
| Base URL | `http://localhost:8000/api/v1` |
| Content-Type | `application/json` (except file uploads: `multipart/form-data`) |
| Authentication | None (Phase 1) |
| CORS Origins | `["http://localhost:3000"]` |
| CORS Methods | `["GET", "POST", "OPTIONS"]` |
| CORS Headers | `["Content-Type"]` |
| Request Timeout | 30 seconds |
| Max Request Body | 50MB (for uploads), 1MB (for JSON) |

---

## 3. Standard Response Envelope

### Success Response

All successful responses follow this structure:

```json
{
  "status": "success",
  "data": { ... },
  "meta": { ... }
}
```

- `status`: Always `"success"` for 2xx responses.
- `data`: The response payload. Structure varies per endpoint.
- `meta`: Optional metadata (pagination info, processing stats). Omitted if not applicable.

### Error Response

All error responses follow this structure:

```json
{
  "status": "error",
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Human-readable error description",
    "details": [ ... ]
  }
}
```

- `status`: Always `"error"` for 4xx/5xx responses.
- `error.type`: Machine-readable error category (see Error Types below).
- `error.message`: Human-readable description suitable for UI display.
- `error.details`: Optional array of specific error items. Used for validation errors.

### Error Types

| Type | HTTP Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request payload failed validation |
| `FILE_VALIDATION_ERROR` | 400 | Uploaded file is invalid (wrong type, too large, malformed) |
| `SCHEMA_MAPPING_ERROR` | 400 | CSV columns cannot be mapped to expected schema |
| `INSUFFICIENT_DATA_ERROR` | 400 | Not enough data for requested operation |
| `NOT_FOUND` | 404 | Requested resource does not exist |
| `QUERY_GENERATION_ERROR` | 422 | LLM could not generate valid SQL for the question |
| `QUERY_EXECUTION_ERROR` | 422 | Generated SQL failed to execute |
| `FORECAST_NOT_READY` | 409 | No trained model available for predictions |
| `RATE_LIMITED` | 429 | Too many requests (LLM query endpoint) |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `LLM_UNAVAILABLE` | 503 | Gemini API is unreachable |
| `DATABASE_UNAVAILABLE` | 503 | PostgreSQL is unreachable |

### Pagination Meta

For paginated endpoints:

```json
{
  "meta": {
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total_count": 4380,
      "total_pages": 219
    }
  }
}
```

---

## 4. Endpoint Specifications

---

### 4.1 Health Check

#### `GET /api/v1/health`

**Purpose**: Verify system component health. Used by Docker health checks, monitoring, and the frontend to show system status.

**Request**: No parameters.

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "status": "healthy",
    "components": {
      "database": {
        "status": "healthy",
        "latency_ms": 12
      },
      "model_store": {
        "status": "healthy",
        "models_count": 1
      },
      "llm_api": {
        "status": "healthy",
        "provider": "gemini"
      }
    },
    "version": "0.1.0",
    "timestamp": "2024-12-15T10:30:00Z"
  }
}
```

**Response (503)** — when any component is unhealthy:
```json
{
  "status": "success",
  "data": {
    "status": "degraded",
    "components": {
      "database": {
        "status": "healthy",
        "latency_ms": 12
      },
      "model_store": {
        "status": "healthy",
        "models_count": 0
      },
      "llm_api": {
        "status": "unhealthy",
        "error": "Connection timeout"
      }
    },
    "version": "0.1.0",
    "timestamp": "2024-12-15T10:30:00Z"
  }
}
```

**Behavior notes:**
- Returns 200 if ALL components are healthy.
- Returns 503 if ANY component is unhealthy, but still returns the full status JSON (so the frontend can show which component failed).
- Database health: execute `SELECT 1` with 5-second timeout.
- Model store health: verify the model directory exists and is writable.
- LLM API health: do NOT call the API (wastes quota). Instead, verify the API key is configured and non-empty.

---

### 4.2 Data Upload

#### `POST /api/v1/upload/{entity_type}`

**Purpose**: Upload a CSV file containing business data. The system validates, cleans, maps columns, and persists the data.

**Path Parameters:**

| Parameter | Type | Required | Values |
|---|---|---|---|
| `entity_type` | string | Yes | `sales`, `products`, `customers`, `inventory`, `suppliers` |

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File | Yes | CSV file (max 50MB) |

**Response (201):**
```json
{
  "status": "success",
  "data": {
    "upload_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "filename": "sales_2024.csv",
    "entity_type": "sales",
    "rows_ingested": 4380,
    "rows_skipped": 5,
    "warnings": [
      "Row 23: missing 'discount' value, filled with 0.00",
      "Row 156: date format 'DD/MM/YYYY' auto-converted to 'YYYY-MM-DD'",
      "Column 'amt' mapped to 'total_amount' (fuzzy match, confidence: 0.87)"
    ],
    "column_mapping": {
      "Date": "sale_date",
      "Product": "product_name",
      "Qty": "quantity",
      "Price": "unit_price",
      "amt": "total_amount"
    }
  },
  "meta": {
    "processing_time_ms": 2340
  }
}
```

**Error Response (400) — Invalid file:**
```json
{
  "status": "error",
  "error": {
    "type": "FILE_VALIDATION_ERROR",
    "message": "File must be a CSV file (received: application/pdf)",
    "details": []
  }
}
```

**Error Response (400) — Schema mapping failure:**
```json
{
  "status": "error",
  "error": {
    "type": "SCHEMA_MAPPING_ERROR",
    "message": "Cannot map CSV columns to sales schema. Required columns missing: sale_date, total_amount",
    "details": [
      {
        "required_column": "sale_date",
        "csv_columns_available": ["ID", "Name", "Value", "Code"],
        "best_match": null,
        "confidence": 0.0
      },
      {
        "required_column": "total_amount",
        "csv_columns_available": ["ID", "Name", "Value", "Code"],
        "best_match": "Value",
        "confidence": 0.45
      }
    ]
  }
}
```

**Behavior notes:**
- File extension must be `.csv`. Reject others with FILE_VALIDATION_ERROR.
- File size must be ≤ 50MB. Reject with FILE_VALIDATION_ERROR.
- File must have a header row. If no header detected, return FILE_VALIDATION_ERROR.
- Row count must be ≤ 100,000. Reject with FILE_VALIDATION_ERROR.
- Column mapping uses fuzzy matching with minimum confidence threshold of 0.6.
- If required columns (per entity type) cannot be mapped above threshold, return SCHEMA_MAPPING_ERROR.
- Warnings are accumulated but do not stop ingestion.
- The uploaded file is deleted from disk after processing (success or failure).

**Required columns per entity type:**

| Entity Type | Required Columns |
|---|---|
| `sales` | `sale_date`, `total_amount` (at least one of: `quantity`+`unit_price` OR `total_amount`) |
| `products` | `name` |
| `customers` | `name` |
| `inventory` | `product_name` OR `product_id`, `quantity_on_hand` |
| `suppliers` | `name` |

---

### 4.3 Data Retrieval

#### `GET /api/v1/data/{entity_type}`

**Purpose**: Retrieve paginated business data for display in tables.

**Path Parameters:**

| Parameter | Type | Required | Values |
|---|---|---|---|
| `entity_type` | string | Yes | `sales`, `products`, `customers`, `inventory`, `suppliers` |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `page` | integer | No | 1 | Page number (1-indexed) |
| `page_size` | integer | No | 20 | Records per page (max: 100) |
| `sort_by` | string | No | `created_at` | Column to sort by |
| `sort_order` | string | No | `desc` | `asc` or `desc` |
| `date_from` | string | No | — | Start date filter (YYYY-MM-DD, sales only) |
| `date_to` | string | No | — | End date filter (YYYY-MM-DD, sales only) |
| `search` | string | No | — | Text search across name/product columns |

**Response (200) — Example for sales:**
```json
{
  "status": "success",
  "data": {
    "records": [
      {
        "id": "uuid-1",
        "sale_date": "2024-12-15",
        "product_name": "Wireless Earbuds",
        "customer_name": "Rahul Sharma",
        "quantity": 2,
        "unit_price": 1499.00,
        "total_amount": 2998.00,
        "discount": 0.00,
        "payment_method": "UPI",
        "channel": "Store"
      }
    ]
  },
  "meta": {
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total_count": 4380,
      "total_pages": 219
    }
  }
}
```

**Error Response (404):**
Returned when entity_type is valid but no data has been uploaded yet.
```json
{
  "status": "error",
  "error": {
    "type": "NOT_FOUND",
    "message": "No sales data found. Upload a sales CSV file first.",
    "details": []
  }
}
```

---

#### `GET /api/v1/data/summary`

**Purpose**: Return aggregated KPI metrics for the dashboard.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `date_from` | string | No | 30 days ago | Start date for metric calculation |
| `date_to` | string | No | today | End date for metric calculation |

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "period": {
      "from": "2024-11-15",
      "to": "2024-12-15"
    },
    "total_revenue": 452000.00,
    "total_orders": 1250,
    "average_order_value": 361.60,
    "unique_customers": 89,
    "top_products": [
      { "name": "Wireless Earbuds", "revenue": 72000.00, "quantity_sold": 48 },
      { "name": "USB-C Hub", "revenue": 54000.00, "quantity_sold": 36 },
      { "name": "LED Desk Lamp", "revenue": 42000.00, "quantity_sold": 84 }
    ],
    "top_categories": [
      { "category": "Electronics", "revenue": 198000.00 },
      { "category": "Office Supplies", "revenue": 112000.00 }
    ],
    "daily_revenue": [
      { "date": "2024-11-15", "revenue": 14500.00 },
      { "date": "2024-11-16", "revenue": 12300.00 }
    ],
    "payment_method_distribution": [
      { "method": "UPI", "count": 520, "percentage": 41.6 },
      { "method": "Cash", "count": 380, "percentage": 30.4 },
      { "method": "Card", "count": 350, "percentage": 28.0 }
    ],
    "data_status": {
      "sales_count": 4380,
      "products_count": 25,
      "customers_count": 50,
      "inventory_count": 25,
      "suppliers_count": 10,
      "last_upload": "2024-12-15T08:30:00Z"
    }
  }
}
```

**Behavior notes:**
- `top_products` returns maximum 5 products sorted by revenue descending.
- `top_categories` returns maximum 5 categories sorted by revenue descending.
- `daily_revenue` returns one entry per day in the date range.
- If no sales data exists, return all numeric values as 0 and empty arrays. Do NOT return an error.
- `data_status` shows how much data exists across all entity types. This helps the UI show "no data uploaded yet" states.

---

#### `GET /api/v1/data/uploads`

**Purpose**: Return upload history for the data management view.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `page` | integer | No | 1 | Page number |
| `page_size` | integer | No | 20 | Records per page |

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "records": [
      {
        "id": "uuid-1",
        "filename": "sales_2024.csv",
        "entity_type": "sales",
        "row_count": 4380,
        "warning_count": 5,
        "error_count": 0,
        "status": "completed",
        "created_at": "2024-12-15T08:30:00Z"
      }
    ]
  },
  "meta": {
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total_count": 6,
      "total_pages": 1
    }
  }
}
```

---

### 4.4 Sales Forecasting

#### `POST /api/v1/forecast/train`

**Purpose**: Trigger training of a sales forecasting model on available sales data.

**Request Body:**
```json
{
  "granularity": "daily"
}
```

| Field | Type | Required | Default | Values | Description |
|---|---|---|---|---|---|
| `granularity` | string | No | `daily` | `daily`, `weekly`, `monthly` | Aggregation level for training |

**Response (202):**
```json
{
  "status": "success",
  "data": {
    "message": "Model training started",
    "training_id": "uuid-training-1",
    "data_points_used": 365,
    "date_range": {
      "from": "2024-01-01",
      "to": "2024-12-31"
    },
    "estimated_time_seconds": 15
  }
}
```

**Behavior notes:**
- Training happens synchronously in Phase 1 (no background tasks). The 202 status code is used because training is conceptually an asynchronous operation. However, Phase 1 blocks until training completes.
- Minimum 30 data points required. Below that, return INSUFFICIENT_DATA_ERROR (400).
- If a model already exists, it is replaced with the new model.
- The response returns the actual data range and point count used for training.
- Training typically takes 5-30 seconds depending on data size.

**Error Response (400) — Insufficient data:**
```json
{
  "status": "error",
  "error": {
    "type": "INSUFFICIENT_DATA_ERROR",
    "message": "Sales forecasting requires at least 30 data points. Current data has 12 data points.",
    "details": [
      {
        "required": 30,
        "available": 12,
        "suggestion": "Upload more historical sales data to enable forecasting."
      }
    ]
  }
}
```

---

#### `GET /api/v1/forecast/predict`

**Purpose**: Get sales predictions from the trained model.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `horizon_days` | integer | No | 30 | Number of days to forecast (max: 90) |
| `include_history` | boolean | No | true | Include historical actuals in the response |

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "model_info": {
      "trained_at": "2024-12-15T10:00:00Z",
      "data_points_used": 365,
      "granularity": "daily"
    },
    "history": [
      {
        "date": "2024-12-01",
        "actual": 14500.00
      },
      {
        "date": "2024-12-02",
        "actual": 12300.00
      }
    ],
    "forecast": [
      {
        "date": "2025-01-01",
        "predicted": 15200.00,
        "lower_bound": 12800.00,
        "upper_bound": 17600.00
      },
      {
        "date": "2025-01-02",
        "predicted": 14800.00,
        "lower_bound": 12400.00,
        "upper_bound": 17200.00
      }
    ]
  }
}
```

**Behavior notes:**
- If `include_history` is true, return the last 90 days of actual sales (or all history if less than 90 days). This allows the frontend to show both actual and predicted on the same chart.
- History values are aggregated to match the model's granularity (daily/weekly/monthly).
- `horizon_days` is capped at 90. If the user requests more, silently cap at 90.
- Returns FORECAST_NOT_READY (409) if no model has been trained yet.

**Error Response (409) — No model:**
```json
{
  "status": "error",
  "error": {
    "type": "FORECAST_NOT_READY",
    "message": "No forecast model has been trained yet. Train a model first using POST /api/v1/forecast/train.",
    "details": []
  }
}
```

---

#### `GET /api/v1/forecast/status`

**Purpose**: Check if a trained model exists and its metadata.

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "model_available": true,
    "trained_at": "2024-12-15T10:00:00Z",
    "data_points_used": 365,
    "granularity": "daily",
    "date_range": {
      "from": "2024-01-01",
      "to": "2024-12-31"
    }
  }
}
```

If no model exists:
```json
{
  "status": "success",
  "data": {
    "model_available": false,
    "trained_at": null,
    "data_points_used": null,
    "granularity": null,
    "date_range": null
  }
}
```

---

### 4.5 Natural Language Query

#### `POST /api/v1/query`

**Purpose**: Accept a natural language business question, convert to SQL, execute, and return a formatted answer.

**Request Body:**
```json
{
  "question": "What were the total sales last month?"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `question` | string | Yes | Natural language business question (min 5 chars, max 500 chars) |

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "question": "What were the total sales last month?",
    "answer": "Total sales last month (November 2024) were **₹4,52,000** across **1,250 transactions**. This represents a 12% increase compared to October 2024 (₹4,03,500).",
    "generated_sql": "SELECT SUM(total_amount) as total_sales, COUNT(*) as transaction_count FROM sales WHERE sale_date >= '2024-11-01' AND sale_date < '2024-12-01'",
    "raw_data": [
      {
        "total_sales": 452000.00,
        "transaction_count": 1250
      }
    ],
    "confidence": "high"
  },
  "meta": {
    "llm_model": "gemini-2.0-flash",
    "processing_time_ms": 2100
  }
}
```

**Behavior notes:**
- The pipeline is: question → LLM generates SQL → validate SQL → execute SQL → LLM formats answer.
- `generated_sql` is always returned for transparency, even on success.
- `raw_data` contains the raw SQL query results (array of objects).
- `confidence` is `"high"` if the LLM generated SQL successfully and it returned results, `"low"` if the query returned empty results or the LLM expressed uncertainty.
- SQL validation: Only `SELECT` statements are allowed. The SQL is executed against the read-only database role with a 10-second timeout.
- Rate limited: 10 requests per minute per IP. Return RATE_LIMITED (429) if exceeded.

**Error Response (422) — Query generation failed:**
```json
{
  "status": "error",
  "error": {
    "type": "QUERY_GENERATION_ERROR",
    "message": "I couldn't understand that question well enough to query the database. Try rephrasing your question, for example: 'What were the total sales in November?'",
    "details": [
      {
        "original_question": "asdlfkjasldf",
        "suggestion": "Try asking about sales, products, customers, inventory, or suppliers."
      }
    ]
  }
}
```

**Error Response (422) — Query execution failed:**
```json
{
  "status": "error",
  "error": {
    "type": "QUERY_EXECUTION_ERROR",
    "message": "The query was generated but could not be executed against the database. This usually means the data needed to answer your question hasn't been uploaded yet.",
    "details": [
      {
        "generated_sql": "SELECT ... FROM orders ...",
        "db_error": "relation \"orders\" does not exist"
      }
    ]
  }
}
```

**Error Response (503) — LLM unavailable:**
```json
{
  "status": "error",
  "error": {
    "type": "LLM_UNAVAILABLE",
    "message": "The AI service is temporarily unavailable. Please try again in a few moments.",
    "details": []
  }
}
```

---

## 5. Request ID Tracing

Every API response includes a `X-Request-Id` header:

```
X-Request-Id: req_a1b2c3d4e5f6
```

- Generated per request as `req_` + UUID4 (first 12 hex chars).
- Included in all log entries for that request.
- Returned in the response header for client-side debugging.
- Included in error responses as well.

---

## 6. Rate Limiting

| Endpoint | Limit | Window |
|---|---|---|
| `POST /api/v1/query` | 10 requests | Per minute |
| `POST /api/v1/upload/*` | 5 requests | Per minute |
| `POST /api/v1/forecast/train` | 3 requests | Per minute |
| All other endpoints | 60 requests | Per minute |

**Implementation**: In-memory rate limiting using a sliding window counter (no Redis needed in Phase 1). Rate limit state resets on server restart.

**Response when limited:**
```
HTTP 429 Too Many Requests
Retry-After: 30

{
  "status": "error",
  "error": {
    "type": "RATE_LIMITED",
    "message": "Too many requests. Please try again in 30 seconds.",
    "details": []
  }
}
```
