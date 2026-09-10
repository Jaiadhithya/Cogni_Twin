---
marp: true
theme: uncover
class: invert
style: |
  section {
    background-color: #0d1117;
    color: #e6edf3;
    font-family: 'Inter', system-ui, sans-serif;
  }
  h1 { color: #58a6ff; font-size: 2.2em; }
  h2 { color: #79c0ff; font-size: 1.5em; }
  ul { text-align: left; margin-left: 20%; font-size: 0.9em; }
  .columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
  .img-box img { border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
---

# End-to-End Intelligent Sales Analytics
## Forecasting & Explainability

**Target Audience:** ML Faculty Review (Zeroth Review)

![bg right:40%](assets/ml_cover_bg_1786073348781.jpg)

---

# Problem Statement & Motivation

- **The Challenge:** Real-world retail data is sparse, seasonal, and noisy. Existing tools provide visualization but lack robust, explainable forecasting.
- **The Gap:** Standard time-series models (ARIMA) fail on missing data without imputation. Deep learning models lack transparency for business users.
- **Our Goal:** Build an end-to-end pipeline that not only predicts sales accurately but also explains the *why* behind the prediction.

---

# Literature & Research Foundation

Based on recent ML research in robust time-series forecasting (e.g., JMLR 23(306) on interpretable forecasting):
- **Decomposable Models:** Favoring generalized additive models (GAMs) over black-box LSTMs for financial data.
- **Multiplicative Seasonality:** Sales spikes (e.g., holidays) scale with the baseline trend rather than remaining additive.
- **Uncertainty Quantification:** Predictive models must output rigorous confidence bounds (`yhat_lower`, `yhat_upper`), not just point estimates.

---

# Data Ingestion & Preprocessing

<div class="columns">
<div>

- **Automated Pipeline:** Raw CSV parsing, schema mapping, and validation.
- **Handling Sparsity:** Missing dates are structurally filled with zeros instead of interpolated, reflecting true zero-sales days.
- **Granularity Control:** Dynamic resampling (daily, weekly, monthly) using Pandas `sum()` aggregations.

</div>
<div class="img-box">
<img src="assets/ml_architecture_1786073361984.jpg" alt="Architecture" />
</div>
</div>

---

# Predictive Modeling (Prophet vs Alternatives)

<div class="columns">
<div>

### Why Prophet?
- Automatically handles piecewise linear trends and changepoints.
- Native support for multiple seasonalities (weekly, yearly) using Fourier series.
- **Robustness:** Immune to outliers and handles missing data inherently.

*Vs. XGBoost/SARIMA: Avoids manual lag feature engineering and stationarity testing.*

</div>
<div class="img-box">
<img src="assets/time_series_forecast_1786073374789.jpg" alt="Forecast" />
</div>
</div>

---

# Explainable AI (XAI) & Interpretability

- **Component Decomposition:** The forecast is broken down into base trend + weekly seasonality + yearly seasonality.
- **Changepoint Analysis:** The model identifies and explains structural shifts in the data.
- **Visual Evidence:** The frontend dashboard directly surfaces these components, translating mathematical weights into business insights.
- *Key outcome: Trust in the model via transparency.*

---

# System Architecture & Evaluation

- **Backend Architecture:** Python/FastAPI driving the Prophet and Pandas pipelines.
- **Data Layer:** PostgreSQL for persistent historical data storage.
- **Model Persistence:** JSON-based model serialization for security and portability.
- **Evaluation Strategy:** Built-in time-series cross validation (initial=70%, horizon=30 days) tracking **MAE**, **MAPE**, and **RMSE**.

---

# Conclusion & Future Scope

### Achievements
- End-to-end automated ML pipeline for sales forecasting.
- Implementation of transparent, mathematically sound forecasting models.

### Future Work (Phase 2 & 3)
- Integration of external regressors (Marketing spend, Weather).
- Auto-selection between Prophet, XGBoost, and NeuralProphet based on evaluation metrics.
- Large-Language Model (LLM) query engine for conversational analytics.

---
