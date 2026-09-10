# Phase 1 — ML Forecasting Engine Specification

> **Document Purpose**: Define the sales forecasting system — data requirements, feature engineering, Prophet configuration, training pipeline, prediction API, model persistence, evaluation, and failure handling. An AI coding agent should be able to implement the complete forecasting engine from this document alone.

---

## 1. Why This Module Exists

The core value proposition of CogniTwin is **prediction, not just visualization**. Any BI tool can show a sales chart. CogniTwin predicts future sales and explains the prediction.

Sales forecasting is the first ML module because:
1. **Highest business impact**: "How much will I sell next month?" is the most common question a retailer asks.
2. **Simplest data requirement**: Needs only date + amount (two columns from sales data).
3. **Most demonstrable**: A forecast chart with confidence bands is visually compelling and immediately understandable.
4. **Foundation for Phase 3**: Inventory demand forecasting builds on sales forecasting. Revenue prediction extends it. Getting the pipeline right now pays off later.

---

## 2. Why Facebook Prophet

### What Prophet Does Well

- **Handles seasonality automatically**: Decomposes time series into trend + yearly seasonality + weekly seasonality + holidays. Retail sales are highly seasonal (festivals, weekends, end-of-month).
- **Robust to missing data**: Real-world sales data has gaps (holidays, closures). Prophet handles this natively without imputation.
- **Handles outliers**: Uses a piecewise linear trend that adapts to changepoints (e.g., sudden growth or decline).
- **Produces uncertainty intervals**: Returns `yhat_lower` and `yhat_upper` alongside `yhat`. This is essential for communicating to business owners that forecasts are probabilistic.
- **No manual hyperparameter tuning**: Works well with default parameters for most retail time series.
- **Fast training**: 5-30 seconds for 1-3 years of daily data. Acceptable for synchronous API response.

### Why NOT ARIMA/SARIMA
- Requires stationarity testing (ADF test), differencing, and manual (p,d,q) parameter selection.
- Sensitive to missing data — requires imputation before fitting.
- Seasonal ARIMA (SARIMA) requires specifying seasonal period manually.
- Not designed for automatic pipeline — requires data scientist intervention.

### Why NOT XGBoost/LightGBM for Time-Series
- These are regression models, not time-series models. Using them for forecasting requires:
  - Manual lag feature creation (lag_1, lag_7, lag_30, rolling_mean_7, etc.)
  - Manual train/test split with temporal ordering
  - No native uncertainty quantification (would need quantile regression)
- More engineering effort for Phase 1 with no clear quality advantage on small datasets.

### Why NOT Neural Prophet / N-BEATS
- Neural Prophet is Prophet + neural network components. Overkill for Phase 1 data sizes.
- N-BEATS requires GPU for reasonable training times.
- Both require larger datasets to outperform vanilla Prophet.

---

## 3. Data Requirements

### Minimum Requirements

| Requirement | Value | Reason |
|---|---|---|
| Minimum data points | 30 | Prophet needs at least 30 observations for meaningful seasonality decomposition |
| Minimum date range | 30 days | Less than 30 days provides no seasonal signal |
| Required columns | `sale_date`, `total_amount` | Prophet needs only (date, value) pairs |

### Recommended for Good Forecasts

| Requirement | Value | Reason |
|---|---|---|
| Ideal data points | 365+ (1 year) | Captures yearly seasonality |
| Ideal date range | 1-3 years | Captures trend and multiple seasonal cycles |
| Frequency | Daily | Weekly/monthly reduces signal resolution |

### Data Preprocessing for Prophet

Prophet requires input in exactly this format:

| Column | Name | Type | Description |
|---|---|---|---|
| Date column | `ds` | datetime | The date (pandas Timestamp) |
| Value column | `y` | float | The value to forecast |

**Preprocessing pipeline:**

1. Query all sales from the database: `SELECT sale_date, SUM(total_amount) FROM sales GROUP BY sale_date ORDER BY sale_date`
2. The result is daily revenue (sum of all transactions per day).
3. Fill missing dates (days with zero sales) with `y = 0`. Prophet handles missing dates, but explicit zeros are clearer for retail (a day with no sales is a real data point, not missing data).
4. Rename columns: `sale_date` → `ds`, `revenue` → `y`.
5. Ensure `ds` is a pandas Timestamp and `y` is float64.

### Granularity Options

The API supports three granularity levels:

| Granularity | Aggregation | Prophet Frequency | Use Case |
|---|---|---|---|
| `daily` | SUM(total_amount) per day | Default (daily) | Fine-grained daily forecast |
| `weekly` | SUM(total_amount) per ISO week | Resample to weekly | Smoother, less noisy forecast |
| `monthly` | SUM(total_amount) per calendar month | Resample to monthly | High-level planning |

**Aggregation happens before training.** If the user selects `weekly`, the daily data is resampled to weekly sums before feeding to Prophet.

---

## 4. Prophet Configuration

### Model Parameters

```
Prophet(
    growth='linear',           # Linear trend (not logistic — no capacity ceiling for retail)
    yearly_seasonality=True,   # Capture Diwali, Christmas, summer lull, etc.
    weekly_seasonality=True,   # Capture weekend vs weekday patterns
    daily_seasonality=False,   # Too noisy for small business (not enough intra-day data)
    seasonality_mode='multiplicative',  # Seasonal effects scale with trend (not additive)
    interval_width=0.80,       # 80% confidence interval
    changepoint_prior_scale=0.05,  # Default — controls trend flexibility
)
```

### Why `multiplicative` Seasonality

For retail businesses, seasonal effects typically **scale** with overall sales level. If base sales grow from ₹10K/day to ₹20K/day, the Diwali spike also grows proportionally. Multiplicative seasonality captures this behavior. Additive would assume the Diwali spike stays the same absolute amount regardless of base level.

### Why NOT Add Holidays

Phase 1 does NOT configure Indian holidays in Prophet because:
1. Holiday effects vary widely by region and business type.
2. Adding wrong holidays is worse than omitting them (creates false patterns).
3. Phase 2 can add configurable holiday lists per business.

Prophet's changepoint detection partially captures holiday effects even without explicit holiday configuration.

### Why NOT Add Regressors

Prophet supports external regressors (temperature, marketing spend, etc.). Phase 1 does not use them because:
1. Regressor data must be available for both historical and forecast periods.
2. Small businesses rarely track external variables systematically.
3. Keeping the model simple reduces overfitting risk on small datasets.

---

## 5. Training Pipeline

### Step-by-Step Flow

```
1. Retrieve historical sales data from PostgreSQL
   │
   ▼
2. Validate minimum data requirements (≥30 data points)
   │
   ▼
3. Aggregate to requested granularity (daily/weekly/monthly)
   │
   ▼
4. Fill missing dates with zero values
   │
   ▼
5. Format as Prophet DataFrame (ds, y)
   │
   ▼
6. Instantiate Prophet with configuration
   │
   ▼
7. Fit model on data
   │
   ▼
8. Serialize model to JSON
   │
   ▼
9. Save to model storage with metadata
   │
   ▼
10. Return training result
```

### Training Result Object

```
TrainingResult:
    success: bool
    data_points_used: int
    date_range_start: date
    date_range_end: date
    granularity: str
    training_duration_seconds: float
    model_path: str
    error_message: str | None  (only if success=False)
```

### Failure Conditions

| Condition | Handling |
|---|---|
| No sales data in database | Return `InsufficientDataError` with message "No sales data found." |
| Less than 30 data points after aggregation | Return `InsufficientDataError` with message "Need 30+ data points, found {n}." |
| Prophet fitting fails (numerical error) | Catch exception, return `TrainingResult(success=False, error="Model fitting failed: {reason}")` |
| All sales values are zero | Return `InsufficientDataError` with message "All sales values are zero." |
| All sales values are identical | Prophet may still fit but with zero uncertainty. Allow it but log a warning. |

---

## 6. Prediction Pipeline

### Step-by-Step Flow

```
1. Check if a trained model exists in storage
   │
   ▼
2. Load the model from storage
   │
   ▼
3. Create future DataFrame for requested horizon
   │
   ▼
4. Generate predictions
   │
   ▼
5. Apply sanity checks
   │
   ▼
6. Format results
   │
   ▼
7. Optionally retrieve historical actuals
   │
   ▼
8. Return prediction result
```

### Creating the Future DataFrame

Prophet requires a DataFrame with a `ds` column containing future dates:

```
future = model.make_future_dataframe(periods=horizon_days)
forecast = model.predict(future)
```

For weekly granularity, `periods` = `horizon_days / 7` (rounded up).
For monthly granularity, `periods` = `horizon_days / 30` (rounded up).

### Sanity Checks on Predictions

After Prophet generates predictions:

1. **No negative values**: If `yhat < 0`, clamp to 0. (Revenue cannot be negative in a forecast.)
2. **No negative lower bounds**: If `yhat_lower < 0`, clamp to 0.
3. **Reasonable upper bounds**: If `yhat_upper > 10 × max(historical_values)`, cap at `10 × max(historical_values)`. Log a warning. (Prevents absurd exponential growth predictions.)
4. **Round to 2 decimal places**: Financial values should not have excessive precision.

### Prediction Result Object

```
ForecastPoint:
    date: date
    predicted: float        # yhat
    lower_bound: float      # yhat_lower
    upper_bound: float      # yhat_upper

PredictionResult:
    model_info:
        trained_at: datetime
        data_points_used: int
        granularity: str
    history: list[HistoryPoint]     # (date, actual_value)
    forecast: list[ForecastPoint]   # (date, predicted, lower, upper)
```

---

## 7. Model Persistence

### Serialization Format

Prophet models are serialized using Prophet's built-in JSON serialization:

```python
from prophet.serialize import model_to_json, model_from_json

# Save
model_json = model_to_json(model)
with open(path, 'w') as f:
    f.write(model_json)

# Load
with open(path, 'r') as f:
    model = model_from_json(f.read())
```

### Why JSON (not pickle)

- **Security**: pickle can execute arbitrary code on deserialization. JSON is safe.
- **Portability**: JSON models can be loaded across different Python versions.
- **Inspectability**: JSON models are human-readable for debugging.
- **Prophet support**: Prophet officially supports JSON serialization.

### File Naming Convention

```
{ML_MODELS_DIR}/forecast_sales_{granularity}_{timestamp}.json
```

Example: `ml_models/forecast_sales_daily_20241215T100000.json`

### Model Management

- Only the latest model per granularity is used for predictions.
- When a new model is trained, the old model file is NOT deleted (kept for rollback).
- A metadata file `ml_models/model_registry.json` tracks:
  ```json
  {
    "latest": {
      "daily": {
        "path": "forecast_sales_daily_20241215T100000.json",
        "trained_at": "2024-12-15T10:00:00Z",
        "data_points": 365,
        "date_range": ["2024-01-01", "2024-12-31"]
      }
    }
  }
  ```
- `is_trained()` checks if `model_registry.json` exists and has a `latest` entry for the requested granularity.

---

## 8. Forecast Evaluation

Phase 1 does NOT expose evaluation metrics to the user. However, the training pipeline should internally compute and log these metrics for developer monitoring:

### Metrics Computed

| Metric | Formula | Purpose |
|---|---|---|
| MAE (Mean Absolute Error) | `mean(|actual - predicted|)` | Average prediction error in absolute terms |
| MAPE (Mean Absolute Percentage Error) | `mean(|actual - predicted| / actual) × 100` | Percentage error (interpretable) |
| RMSE (Root Mean Square Error) | `sqrt(mean((actual - predicted)²))` | Penalizes large errors more |

### Evaluation Method

- **Time-series cross-validation** using Prophet's built-in `cross_validation()`:
  - `initial`: 70% of data for initial training
  - `period`: 7 days between cutoff points
  - `horizon`: 30 days
- This is computationally expensive, so it runs ONLY if data has ≥90 data points.
- If <90 data points, skip cross-validation and log: "Insufficient data for cross-validation."
- Results are logged at INFO level, not returned to the user.

### Logged Output

```json
{
  "event": "forecast_model_trained",
  "granularity": "daily",
  "data_points": 365,
  "training_seconds": 8.3,
  "evaluation": {
    "mae": 1250.50,
    "mape": 8.3,
    "rmse": 1890.25,
    "cross_validation_performed": true
  }
}
```

---

## 9. Edge Cases and Special Handling

| Scenario | Handling |
|---|---|
| All data on the same date | Return `InsufficientDataError`. Prophet needs multiple dates. |
| Data with very large gaps (months of no sales) | Prophet handles this. The gap period will show trend continuation. Log warning: "Data has gaps of {n} days." |
| Extremely volatile data (high variance) | Prophet's confidence intervals will be wide. This is correct behavior — high uncertainty is real. |
| Seasonal data with <1 year | Yearly seasonality disabled automatically when data < 2 years. Weekly seasonality still applies. |
| Data with all identical values | Prophet fits with zero uncertainty. Predictions are flat. Allow but log warning. |
| Training requested while training is in progress | Phase 1 is synchronous, so this can't happen. The second request waits for the first to complete. |
| Model file corrupted on disk | `model_from_json()` will throw an error. Catch it, delete the corrupted file, return `ForecastNotReadyError`. |

---

## 10. Future Extensibility

This module is designed so future phases can add:

1. **Multiple forecast targets**: Phase 3 can add inventory demand forecasting and revenue forecasting. The `Forecaster` protocol is target-agnostic — just change the training data query.

2. **Model comparison**: Phase 3 can train multiple models (Prophet, XGBoost, LSTM) and compare MAE/MAPE to auto-select the best one. The `Forecaster` protocol supports this — each model is a different implementation.

3. **Regressors**: Phase 3 can add external regressors (marketing spend, competitor pricing) by extending the `train()` method signature.

4. **Automatic retraining**: Phase 4 can add a scheduled job that retrains the model weekly when new data is uploaded. The training pipeline is already a callable function.

5. **Ensemble forecasting**: Multiple `Forecaster` implementations can be combined into an `EnsembleForecaster` that averages predictions. The protocol supports this pattern.
