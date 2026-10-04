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
| Authentication | `X-API-Key` header. Required on every endpoint except `/health`, `/docs`, `/redoc`, and `/openapi.json`. Set `API_KEY` in the environment to enable; when unset, the header is not checked. |
| CORS Origins | Configured via `CORS_ORIGINS` (defaults to `http://localhost:3000` and `http://localhost:3001`, including `127.0.0.1` variants). Comma-separated string or JSON array. |
| CORS Methods | `["*"]` |
| CORS Headers | `["*"]` |
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

**Purpose**: List the datasets ingested through `POST /ingest/csv` (rows of `dataset_metadata`), newest first. Each record's `id` is the dataset id accepted by `?dataset_id=` on other endpoints and by `DELETE /data/uploads/{upload_id}`.

The record shape predates the schemaless pipeline and is kept for compatibility: `entity_type` is always `"dynamic"`, `status` is always `"completed"` (ingestion is all-or-nothing), and `warning_count`/`error_count` are always `0`.

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
        "entity_type": "dynamic",
        "row_count": 4380,
        "warning_count": 0,
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

#### `DELETE /api/v1/data/uploads/{upload_id}`

**Purpose**: Undo an upload. `upload_id` is the `dataset_id` returned by `POST /api/v1/ingest/csv`.

In one database transaction the endpoint drops the dataset's `dataset_<uuid>` table, deletes its `dataset_metadata` (and any `upload_records`) rows and the cached factor-attribution rows of its models. After the commit it removes the dataset's trained model files and registry entries and invalidates the cached schema context.

**Response (200):**
```json
{
  "status": "success",
  "data": { "dataset_id": "f3a2b1c0-…", "table_name": "dataset_f3a2b1c0…", "models_removed": 1 }
}
```

**Errors:** `404 NOT_FOUND` for an unknown dataset id; `422` for a malformed id. Other datasets are never touched.

---

#### `GET /api/v1/data/{dataset_id}/profile`

Per-column statistics for a dataset. Numeric columns: `count`, `nulls`, `mean`, `median`, `std` (sample), `min`, `max`, `iqr` (q3 − q1), `skewness` (population g1). Categorical columns: `count`, `nulls`, `cardinality`, `top_values` (up to 5 `{value, count}`). Computed in SQL; cached per dataset until the next upload/undo. At most 50 columns of each kind are profiled (`skipped_columns` lists the rest).

#### `GET /api/v1/data/{dataset_id}/correlations?method=pearson|spearman`

Correlation matrix over the numeric columns: `{ method, columns, matrix, n, sampled, sample_size }`. `matrix[i][j]` is `null` when undefined (e.g. a constant column) and `n[i][j]` is the pairwise-complete sample size. Datasets above `ANALYSIS_SAMPLE_ROWS` (default 50,000) are randomly sampled and flagged with `sampled: true`.

#### `GET /api/v1/data/{dataset_id}/scatter?x=&y=&limit=`

Random sample (`limit` 1–5000, default 500) of `(x, y)` points: `{ x, y, points: [{<x>: …, <y>: …}], total_pairs, returned, sampled, pearson_r }`. `x` and `y` must be numeric columns of the dataset (validated against its schema, otherwise `400`).

All three return `404 NOT_FOUND` for an unknown dataset and `422` for a malformed id.

**Natural-language queries:** `POST /api/v1/query` recognises relationship questions ("how does marketing spend relate to sales?") when two numeric columns can be identified in them, and answers with a `scatter` chart plus the Pearson r (`source: "RELATIONSHIP"`, no SQL generated). Questions that do not resolve to two columns use the normal routing.

---

### 4.4 Sales Forecasting

#### `POST /api/v1/forecast/train`

**Purpose**: Start training a forecasting model for a dataset as a **background job**.

**Request Body:**
```json
{ "granularity": "daily", "dataset_id": "f3a2b1c0-…" }
```

| Field | Type | Required | Default | Values | Description |
|---|---|---|---|---|---|
| `granularity` | string | No | `daily` | `daily`, `weekly`, `monthly` | Aggregation level for training |
| `dataset_id` | string | No | latest dataset | | Dataset to train on |

**Query Parameters:** `wait` (boolean, default `false`) — block until the job finishes and return the legacy synchronous payload.

**Response (202)** — default:
```json
{
  "status": "success",
  "data": {
    "job_id": "uuid-job-1",
    "dataset_id": "f3a2b1c0-…",
    "granularity": "daily",
    "status": "queued",
    "error": null,
    "created_at": "2026-10-03T10:00:00+00:00",
    "started_at": null,
    "finished_at": null,
    "metrics": null
  }
}
```

**Response (200)** — with `?wait=true` and a successful job: `{ "job_id", "message", "training_id", "dataset_id", "data_points_used", "date_range": {"start","end"}, "estimated_time_seconds" }`.

**Behavior notes:**
- Job states: `queued` → `running` → `succeeded` | `failed`. On success `metrics` holds `training_id`, `data_points_used`, `date_range`, `duration_seconds`; on failure `error` holds the reason.
- Only one training per dataset runs at a time: while a job for the dataset is `queued`/`running`, the same job is returned (still `202`) instead of starting another.
- Jobs left `queued`/`running` by a previous server process are marked `failed` at startup.
- With `?wait=true` a failed job returns `400 ML_ERROR` with the failure message.
- Minimum 30 data points required. A new model replaces the previous one.

#### `GET /api/v1/forecast/jobs/{job_id}`

Returns the job object shown above (`200`), or `404 NOT_FOUND` for an unknown id.

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

**Uncertainty field (added to the simulate response `data`):**

```json
{
  "uncertainty": {
    "method": "split_conformal",
    "calibration_points": 28,
    "dates": ["2026-10-04", "…"],
    "levels": {
      "80": { "half_width": 6.2, "baseline": { "lower": [], "upper": [] }, "scenario": { "lower": [], "upper": [] } },
      "95": { "half_width": 11.4, "baseline": { "lower": [], "upper": [] }, "scenario": { "lower": [], "upper": [] } }
    },
    "notes": ["Intervals are the point forecast ± the holdout error quantile; …"]
  }
}
```

- `method: "split_conformal"` — the interval is the day's point forecast ± the finite-sample quantile of absolute errors from a 28-day backtest (the same backtest as `GET /forecast/backtest`, cached per trained model). 95% is omitted when too few calibration points exist to support it. It describes model error, not uncertainty about the lever values; days beyond the calibration window are flagged in `notes` as likely wider.
- `method: "model_intervals"` — used when the history is shorter than the minimum + 14 days or the backtest fails: the model's own 80% bounds only (Prophet's intervals, or the linear tier's predictive interval), with the reason in `notes`.
- `dates`, and every `lower`/`upper` array, are aligned with `points`.

**Profit and pricing fields (added to the simulate response `data`):**

```json
{
  "profit": {
    "available": true,
    "reason": null,
    "baseline_gross_profit": 41250.0,
    "simulated_gross_profit": 40100.5,
    "delta": -1149.5,
    "delta_pct": -2.79,
    "unit_cost": 4.0,
    "cost_source": "request_unit_cost",
    "price_column": "unit_price",
    "marketing_column": "marketing_spend",
    "margin_guardrail": { "triggered": true, "message": "Volume rises but gross profit falls: …" },
    "assumptions": ["…"]
  },
  "pricing": {
    "elasticity": { "elasticity": -1.9, "std_err": 0.08, "t_stat": -23.7, "r2": 0.93, "n": 120, "controls": ["marketing_spend"], "usable": true, "reason": null },
    "optimal_price": { "price": 8.4, "reason": null, "elasticity": -1.9, "unit_cost": 4.0, "observed_price_range": [5.0, 15.0], "extrapolated": false }
  }
}
```

- Gross profit = `Σ (Q̂·P − Q̂·cost − marketing_spend)` over the horizon, per day, for baseline and scenario. Cost comes from a dataset column (name matches `cost`/`cogs`) or the request's `unit_cost`. **Cost is never guessed**: with neither, or when the forecast target is not a unit volume, `profit` is `{ "available": false, "reason": "…", "profit": null }`.
- Elasticity is the log-log slope of volume on price (negative for ordinary demand), controlling for the other levers when there is enough data. It is `usable` only with ≥ 20 points, varying price, |t| ≥ 2 and R² ≥ 0.10.
- `optimal_price.price = ε/(ε+1)·cost`, defined only for a usable ε < −1; otherwise `null` with a reason (inelastic demand, poor fit, no cost). `extrapolated` flags an optimum outside the observed price range.
- `margin_guardrail.triggered` is true when scenario volume rises but gross profit falls.

---

#### `GET /api/v1/forecast/simulations`

**Purpose**: List saved what-if scenarios (newest first).

| Parameter | Type | Default | Description |
|---|---|---|---|
| `dataset_id` | string | all | Only scenarios of this dataset |
| `page` / `page_size` | integer | 1 / 20 (max 100) | Pagination; totals are in `meta.pagination` |

**Response (200):** `data.records[]` of `{ id, dataset_id, name, mutations, horizon_days, baseline_summary: {total, daily_average}, simulated_summary: {total, daily_average}, delta_metrics: {total_delta, total_delta_pct}, created_at }`.

#### `GET /api/v1/forecast/simulations/compare?ids=a,b,c`

**Purpose**: Compare 2–10 saved scenarios of the **same dataset** side by side.

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "run_ids": ["a", "b"],
    "runs": [{ "id": "a", "name": "more marketing", "dataset_id": "…", "mutations": {}, "horizon_days": 14, "created_at": "…" }],
    "metrics": [
      { "metric": "baseline_total", "values": [1200.0, 1200.0] },
      { "metric": "simulated_total", "values": [1310.5, 1105.2] },
      { "metric": "total_delta", "values": [110.5, -94.8] }
    ]
  }
}
```
`metrics` also lists `baseline_daily_average`, `simulated_daily_average` and `total_delta_pct`. Each `values` array is aligned to `run_ids`.

**Errors:** `400` for fewer than 2 / more than 10 ids, malformed ids, or scenarios from different datasets; `404` if an id is unknown.

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
    },
    "model_tier": "prophet"
  }
}
```

`model_tier` says which model the history length selected (models trained before tiers report `prophet`):

| Tier | History | Model |
|---|---|---|
| `linear` | 30–59 points | BayesianRidge on a trend term, day-of-week dummies and the regressors |
| `prophet` | 60–364 points | Prophet with regressors |
| `prophet_lgbm` | 365+ points | Prophet plus LightGBM fitted on Prophet's residuals (features: regressors, log price, residual lags 1/7/30, rolling means 7/28, day of week; recursive over the horizon) |

The tier is chosen by size thresholds, not by search. `FORECAST_MIN_DATA_POINTS` (30) remains the floor. `GET /api/v1/forecast/backtest` returns the same `model_tier` for the model it evaluated, next to `mae`, `rmse` and `mape`. `mape` is in percent units (12.5 means 12.5%), like every other percentage the API returns.

**Regressor selection.** Training uses only numeric columns that act as levers. Outcome columns — units sold, quantity, orders, revenue, sales, profit, margin, COGS — are excluded by name (unless the name also marks an input rate such as `unit_price` or `discount_pct`), and any column with |Pearson r| ≥ 0.97 against the target is excluded as derived from it. `POST /forecast/train` reports them in `excluded_regressors` with the reason, and `POST /forecast/simulate` only accepts the remaining levers.

If no model exists:
```json
{
  "status": "success",
  "data": {
    "model_available": false,
    "trained_at": null,
    "data_points_used": null,
    "granularity": null,
    "date_range": null,
    "model_tier": null
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
    "llm_model": "openai/gpt-oss-120b",
    "processing_time_ms": 2100
  }
}
```

**Behavior notes:**
- The pipeline is: question → LLM generates SQL → validate SQL → execute SQL → LLM formats answer.
- `generated_sql` is always returned for transparency, even on success.
- `raw_data` contains the raw SQL query results (array of objects).
- `confidence` is `"high"` if the LLM generated SQL successfully and it returned results, `"low"` if the query returned empty results or the LLM expressed uncertainty.
- SQL validation: LLM-generated SQL is parsed with `sqlglot` and rejected unless it is a single read-only `SELECT`/`WITH` statement (no `INTO`, DML, DDL, or multi-statement payloads). The validated SQL is wrapped as `SELECT * FROM (<sql>) AS _q LIMIT :max` and executed on the read-only engine (`DATABASE_READONLY_URL`, bound to the `cognitwin_readonly` role) with a 10-second timeout.
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

### 4.6 Counterfactual What-If Simulation

#### `POST /api/v1/forecast/simulate`

**Purpose**: Execute a counterfactual simulation that mutates business levers against the baseline forecast and returns the projected revenue impact.

**Request Body:**
```json
{
  "dataset_id": "f3a2b1c0-1234-5678-9abc-def012345678",
  "horizon_days": 30,
  "mutations": {
    "unit_price": "+15%",
    "marketing_spend": "-10%"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `dataset_id` | string | No | Target dataset. Omit to use the preset enterprise dataset. |
| `horizon_days` | integer | No | Forecast horizon in days. Must be between 7 and 90. Defaults to 30. |
| `mutations` | object | Yes | Lever mutations. Values may be percentage (`"+15%"`), absolute delta (`"+5"`), or fractional (`0.15`). |
| `unit_cost` | number | No | Per-unit cost for gross profit when the dataset has no cost column (overrides one if present). Must be ≥ 0. |
| `save` | boolean | No | Persist the scenario (default `false`). The response then carries `run_id`. |
| `name` | string | No | Optional label for a saved scenario (max 255 chars). |

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "dataset_id": "f3a2b1c0-1234-5678-9abc-def012345678",
    "run_id": null,
    "mutations_applied": { "unit_price": "+15%", "marketing_spend": "-10%" },
    "baseline_total": 5482920.0,
    "mutated_total": 6021212.0,
    "total_delta": 538292.0,
    "total_delta_pct": 9.82,
    "points": [
      {
        "date": "2026-09-21",
        "baseline_predicted": 18200.0,
        "mutated_predicted": 19900.0,
        "delta": 1700.0,
        "delta_pct": 9.34
      }
    ],
    "available_levers": ["unit_price", "marketing_spend", "discount_pct", "supplier_lead_time_days"],
    "shap_forces": [],
    "shap_positive_forces": [],
    "shap_negative_forces": []
  }
}
```

**Behavior notes:**
- Requires a trained model for the target dataset; returns `ML_ERROR` (400) otherwise.
- Each mutation is held constant across the entire horizon (regressors are fixed at their last observed value), so the counterfactual models a sustained step change rather than a trend.
- `available_levers` lists the numeric columns that can be mutated for the active dataset.
- `shap_forces` give each mutated lever's effect on the horizon total in ₹ (`delta_force`). For the `prophet_lgbm` tier the LightGBM stage also reacts to the changed levers; that response is reported as a `model_adjustment` row, so the rows add up to `total_delta` (within 0.5% of the baseline).

**Error Response (400) — No trained model or invalid mutation:**
```json
{
  "status": "error",
  "error": {
    "type": "ML_ERROR",
    "message": "No forecast model has been trained yet. Train a model first using POST /api/v1/forecast/train.",
    "details": []
  }
}
```

---

### 4.7 Forecast Explainability

#### `GET /api/v1/forecast/explain/{product_id}`

**Purpose**: Return a component-attribution explanation for a single product's forecast on a given date.

**Path Parameters:**

| Field | Type | Required | Description |
|---|---|---|---|
| `product_id` | string | Yes | The product identifier to explain. Treated as an untrusted value and passed as a bound SQL parameter. |

**Query Parameters:**

| Field | Type | Required | Description |
|---|---|---|---|
| `forecast_date` | string | No | Target date in `YYYY-MM-DD` format. Defaults to tomorrow. |
| `dataset_id` | string | No | Explain this dataset's model. Without it the most recently trained model (of any dataset) is used, so clients should always send it. |

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "product_id": "PRD-1042",
    "forecast_date": "2026-09-21",
    "predicted_value": 48250.0,
    "base_value": 45000.0,
    "top_positive_drivers": [
      { "feature": "weekly", "contribution": 4100.0, "description": "Day of the week" }
    ],
    "top_negative_drivers": [
      { "feature": "marketing_spend", "contribution": -850.0, "description": "Marketing spend" }
    ],
    "forces": [],
    "explanation_text": "Projected ₹48,250 for PRD-1042...",
    "method": "prophet_component_decomposition",
    "method_note": "Each factor's effect in ₹ on this day's forecast, measured from the underlying trend level. The trend level plus the factors adds up to the forecast.",
    "document_context": null
  }
}
```

**Behavior notes:**
- `base_value` is the underlying trend level for the date. Each driver's `contribution` is that factor's effect in the target's units (₹ for revenue): day of week, time of year, holidays, each lever, and for the `prophet_lgbm` tier a `recent_momentum` driver (the LightGBM correction). `base_value` plus all factors equals `predicted_value`; the response lists the three largest each way and skips factors under 0.1% of the forecast. Multiplicative Prophet components (fractions of the trend) are converted to amounts by multiplying by the trend.
- The future lever values are projected the same way as `GET /forecast/predict`, so `predicted_value` matches the forecast chart for that date.
- `method` is `linear_coefficients` for the `linear` tier (< 60 points) and `prophet_component_decomposition` otherwise. These are decompositions of the model's own forecast, not Shapley values; field names such as `shap_drivers`/`shap_forces` and the `shap_cache` table keep their legacy names.
- Cached explanations are keyed by product, date, **the current model id** and the current `method_note`, so retraining (or a change to how contributions are computed) invalidates them.
- `product_id` is matched with a bound parameter (`CAST(id AS TEXT) = :pid`); it is never string-interpolated into SQL.
- Explanations are cached in the `shap_cache` table keyed by `product_id` and `forecast_date`.

**Error Response (400) — Product not found or malformed date:**
```json
{
  "status": "error",
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "No forecast found for product 'PRD-9999' on 2026-09-21.",
    "details": []
  }
}
```

#### `GET /api/v1/forecast/explain-prescribe`

**Purpose**: Return a unified bundle — forecast points, component drivers, anomaly detection, ranked prescriptive actions, and an executive summary — for a single client round-trip.

**Query Parameters:**

| Field | Type | Required | Description |
|---|---|---|---|
| `horizon_days` | integer | No | Forecast horizon in days. Defaults to 30. |
| `dataset_id` | string | No | Target dataset. Omit to use the preset enterprise dataset. |

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "forecast_points": [
      { "date": "2026-09-21", "predicted": 18200.0, "lower_bound": 16800.0, "upper_bound": 19600.0 }
    ],
    "shap_drivers": {
      "positive": [
        { "feature": "trend", "contribution": 0.082, "description": "Underlying upward trend" }
      ],
      "negative": [
        { "feature": "marketing_spend", "contribution": -0.045, "description": "Reduced marketing intensity" }
      ]
    },
    "anomaly_detected": true,
    "anomaly_description": "Projected 7-day mean is 12.4% below the trailing 30-day mean.",
    "anomaly_root_cause": {
      "attribution_date": "2026-10-03",
      "method": "prophet_component_decomposition",
      "drivers": [{ "feature": "marketing_spend", "contribution": -4.5, "description": "…", "direction": "negative" }],
      "documents": [{ "document_id": "…", "document_title": "supplier_report.pdf", "text_snippet": "…", "relevance_score": 0.81 }],
      "summary": "…",
      "summary_source": "llm"
    },
    "prescriptive_actions": [
      {
        "priority": 1,
        "action": "Increase marketing spend on top 3 SKUs",
        "expected_impact": "Projected +₹4.5 Lakh over 30 days",
        "timeframe": "Immediate"
      }
    ],
    "executive_summary": "Revenue is trending up 8.2%..."
  }
}
```

**Behavior notes:**
- This endpoint aggregates the forecast, `ShapEngine` decomposition, anomaly check, and two LLM calls into one response.
- `anomaly_root_cause` is null unless an anomaly is flagged. Its drivers are the factor attribution for the lowest forecast day of the window; its documents are the top Qdrant matches for the anomaly and its negative drivers. The LLM summary must cite only returned drivers/documents (validated); otherwise `summary_source` is `deterministic` and `summary` is a plain listing.
- An anomaly is flagged when the projected 7-day mean falls more than 10% below the trailing 30-day mean.
- Requires a trained model for the target dataset; returns `ML_ERROR` (400) otherwise.

---

### 4.8 Document Intelligence (RAG)

#### `POST /api/v1/documents/upload`

**Purpose**: Ingest a PDF document (extension `.pdf` and `%PDF-` magic bytes required; max `MAX_DOCUMENT_UPLOAD_SIZE_MB`, default 25 — larger uploads get `413 FILE_TOO_LARGE`, other types `400 VALIDATION_ERROR`), extract and chunk its text, embed the chunks, and store them in Qdrant for semantic search.

**Request — `multipart/form-data`:**

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | file | Yes | The PDF to upload. |

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "document_id": "d1e2f3a4-b5c6-7890-abcd-ef1234567890",
    "filename": "supplier_contract.pdf",
    "chunk_count": 12,
    "status": "indexed"
  }
}
```

**Behavior notes:**
- Extraction uses PyMuPDF; text is chunked at 500 words with 50-word overlap.
- Embeddings are generated locally with fastembed (`BAAI/bge-small-en-v1.5`, **384 dimensions**).
- The file is written to `UPLOAD_DIR` under a generated UUID filename (`<uuid>.<ext>`); the caller-supplied filename is stored only as metadata and is never used as a path component.
- If the Qdrant server is unreachable the request fails loudly with `VectorStoreError` (500) rather than silently falling back to an in-memory store.

**Error Response (400) — Unparseable document or missing filename:**
```json
{
  "status": "error",
  "error": {
    "type": "DocumentParseError",
    "message": "Failed to process document supplier_contract.pdf: empty or unreadable PDF.",
    "details": []
  }
}
```

**Error Response (500) — Vector store unavailable:**
```json
{
  "status": "error",
  "error": {
    "type": "VectorStoreError",
    "message": "Failed to upsert vectors for document d1e2f3a4...: connection refused.",
    "details": []
  }
}
```

#### `POST /api/v1/documents/search`

**Purpose**: Run a semantic search against indexed documents and return the most relevant chunks.

**Request Body:**
```json
{
  "query": "What is the penalty for late delivery?",
  "top_k": 4
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `query` | string | Yes | The natural language search query. |
| `top_k` | integer | No | Number of chunks to return. Defaults to 4. |

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "results": [
      {
        "chunk_id": "a1b2c3d4",
        "document_id": "d1e2f3a4-b5c6-7890-abcd-ef1234567890",
        "score": 0.942,
        "text": "Section 4.2: Late deliveries incur a penalty of 1.5% per week...",
        "metadata": { "filename": "supplier_contract.pdf", "doc_type": "contract" }
      }
    ]
  }
}
```

**Behavior notes:**
- Ranking is cosine similarity over 384-dimensional embeddings.
- Returns `VectorStoreError` (500) when the vector store is unavailable; clients must not interpret this as an empty result set.

---

### 4.9 Dynamic Schemaless Ingestion

#### `POST /api/v1/ingest/csv`

**Purpose**: Ingest an arbitrary CSV with no predefined schema — columns are cleaned, semantically mapped with LLM assistance, and written to a dedicated `dataset_<uuid>` table.

**Request — `multipart/form-data`:**

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | file | Yes | A CSV file (`.csv` extension required). |

**Response (200):**
```json
{
  "dataset_id": "f3a2b1c0-1234-5678-9abc-def012345678",
  "table_name": "dataset_f3a2b1c0123456789abcdef0123456789",
  "row_count": 1840,
  "columns": [
    { "name": "sale_date", "type": "datetime64[ns]" },
    { "name": "revenue", "type": "float64" }
  ],
  "column_mapping": {
    "sale_date": { "role": "temporal_axis", "dtype": "date" },
    "revenue": { "role": "metric", "dtype": "numeric" }
  },
  "warnings": []
}
```

**Behavior notes:**
- **This endpoint returns a bare object, not the standard `{ "status": "success", "data": ... }` envelope.** Clients must read the payload directly. This deviation is intentional and retained for backward compatibility.
- Enforced limits: file size must not exceed `MAX_UPLOAD_SIZE_MB` (default 50 MB) and the row count must not exceed `MAX_UPLOAD_ROWS` (default 100,000). Both the router and the service enforce these.
- Column names are sanitized to `[A-Za-z0-9_]`; the LLM's semantic role guesses are re-validated against the real DataFrame columns ("anti-pollution shield") and backfilled deterministically if the guess is wrong.
- The target table is named with a full UUID hex (`dataset_<32 hex chars>`), so collisions with existing datasets are effectively impossible.
- The table is created and the dataset metadata is committed on separate transactions; a failure after table creation can leave an orphaned table.

**Error Response (400) — Invalid file or limits exceeded:**
```json
{
  "status": "error",
  "error": {
    "type": "FILE_VALIDATION_ERROR",
    "message": "Row count 150000 exceeds 100000 row limit.",
    "details": []
  }
}
```

**Error Response (413) — File too large:**
```json
{
  "status": "error",
  "error": {
    "type": "FILE_TOO_LARGE",
    "message": "File size exceeds 50MB limit.",
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
| `POST /api/v1/query` | 10 requests (configurable via `QUERY_RATE_LIMIT`) | Per minute |
| All other endpoints | Not currently rate limited | — |

**Implementation**: An in-process sliding-window counter (`src/infrastructure/rate_limiter.py`) keyed per client, applied to `POST /api/v1/query`. It is dependency-free and single-process: state is held in memory and resets on server restart, and the limits above for other endpoints are not yet enforced. A horizontally scaled deployment would need a shared store (e.g. Redis).

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

---

## Appendix: Prompt-injection hardening (`POST /api/v1/query`)

- Questions, schema context (column names, sampled cell values) and result rows are sanitised (control characters stripped, length capped, delimiters neutralised) and placed in `<untrusted_data>` blocks; the prompt tells the model they are data, not instructions.
- Generated SQL must pass the `sqlglot` validator **and** reference only tables/columns listed in the dataset's schema context (plus CTE names and aliases); otherwise the deterministic fallback query runs. It still executes only on the read-only engine.
- The LLM intent must be exactly one known intent, otherwise `SQL` is used; chart specs referencing columns absent from their data are dropped.

## Appendix: Observability

- `GET /metrics` (Prometheus text format) requires the `X-API-Key` header when `API_KEY` is set, unless `METRICS_PUBLIC=true` (only for ports that are not publicly reachable). It exposes `http_requests_total` / `http_request_duration_seconds` (by method, route template, status), `llm_calls_total` / `llm_call_duration_seconds` (by operation), `llm_fallbacks_total`, `training_duration_seconds` and `training_jobs_active` (queue depth in this process).
- Setting `SENTRY_DSN` enables Sentry error reporting (without PII); it is off otherwise.
