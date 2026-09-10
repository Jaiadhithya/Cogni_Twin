# CogniTwin AI — Retail Enterprise Business Dataset Documentation

**Dataset File**: [retail_enterprise_business_data.csv](file:///c:/ML%20Project/retail_enterprise_business_data.csv)  
**Total Records**: 1,840 transaction rows  
**Time Horizon**: 2024-01-01 to 2025-12-31 (730 continuous daily cycles)  
**Industry Domain**: High-Growth B2B/B2C Enterprise Hardware, Edge AI & Cloud Infrastructure  

---

## 1. Business Scenario & System Context

This dataset simulates an omnichannel tech enterprise (**CogniTwin Dynamics Corp**) operating across four global geographic regions and distributing five specialized product lines through four distinct sales channels. 

The dataset is engineered specifically to stress-test and showcase all capabilities of the **CogniTwin AI Platform**:
1. **Dynamic Zero-Pollution Ingestion**: Automatic detection of temporal axes, numeric target metrics, and multidimensional categorical segmentation without synthetic column pollution.
2. **Observatory Dashboard Visualizations**: Populates real continuous revenue timelines, multi-dimensional sector breakdowns (Bar & Donut charts), top seller rankings, and real-time KPI strips.
3. **Prophet Forecasting Engine**: Contains distinct weekly seasonality, Q4 holiday budget spikes, and non-linear trend dynamics.
4. **SHAP Driver & Causal Explainability**: Incorporates realistic economic relationships (marketing spend power curves, price discount elasticities, competitor discount penalties, and lead times).
5. **AI Analyst Natural Language Interface**: Provides rich business dimensions for executive SQL generation, automated multi-chart synthesis (Line, Bar, Pie, Scatter), and prescriptive action plans.

---

## 2. Complete Column Schema & Specifications

| # | Column Name | Physical Type | Semantic Role | Unit / Format | Description |
|---|-------------|---------------|---------------|---------------|-------------|
| 1 | date | DATE / datetime64 | Primary Timeline | YYYY-MM-DD | Daily transaction timestamp spanning Jan 1, 2024 to Dec 31, 2025. |
| 2 | sku_name | VARCHAR(100) | Categorical Dimension | String | High-velocity product SKU (15 unique items, 3 per category). |
| 3 | product_category | VARCHAR(50) | Categorical Dimension | String | Top-level product category (5 sectors). |
| 4 | sales_channel | VARCHAR(50) | Categorical Dimension | String | Distribution channel (Direct, E-Commerce, Partner, Government). |
| 5 | 
egion | VARCHAR(50) | Categorical Dimension | String | Global operating theatre (North America, EMEA, APAC, Latin America). |
| 6 | customer_segment | VARCHAR(50) | Categorical Dimension | String | Client tier (Fortune 500, High-Growth Tech, Mid-Market, Research). |
| 7 | units_sold | INTEGER | Volume Metric | Units | Discrete volume sold per SKU-day (1 to 85 units). |
| 8 | unit_price | NUMERIC(10,2) | Pricing Driver | ₹ / $ | Base unit price before discounts (.00 – ,200.00). |
| 9 | discount_pct | NUMERIC(5,2) | Promotional Lever | Percentage (0–20%) | Discount percentage applied to the order. |
| 10 | competitor_discount_pct | NUMERIC(5,2) | Exogenous Factor | Percentage (2–18%) | Average competitive market discount during the cycle. |
| 11 | marketing_spend | NUMERIC(10,2) | Demand Driver | ₹ / $ | Daily regional marketing and acquisition budget (,500 – ,000). |
| 12 | supplier_lead_time_days | INTEGER | Supply Chain Lever | Days (3–21 days) | Latency for replenishment from primary hardware fabrication tier. |
| 13 | customer_satisfaction_score | NUMERIC(3,2) | Quality Index | Scale 1.0 – 5.0 | Net CSAT score recorded for the cycle (mean: 4.40). |
| 14 | cogs | NUMERIC(12,2) | Cost Metric | ₹ / $ | Cost of Goods Sold (direct bill-of-materials and cloud infrastructure). |
| 15 | 
et_revenue | NUMERIC(14,2) | Target Forecasting Metric | ₹ / $ | Total invoiced sales revenue after discounts. |
| 16 | gross_profit | NUMERIC(14,2) | Margin Metric | ₹ / $ | Net revenue minus COGS. |

---

## 3. Product Catalog & Base Pricing Structure

| Category | Representative SKUs | Typical Base Price | Margin Target |
|----------|---------------------|--------------------|---------------|
| **Smart Robotics** | AgileCobot Arm 600, Automated Guided Rover, VisionSorter 2.0 | ,900.00 | ~48% |
| **Quantum Sensors** | Quantum Flux Magnetometer, Cryo-Temp Probe A9, Precision Laser Resonator | ,200.00 | ~52% |
| **Enterprise Hardware** | PowerNode V4 Blade, Apex Server Cluster, HyperRack 800 | ,500.00 | ~44% |
| **Edge AI Devices** | NeuroEdge Core T3, OmniVision Sensor Unit, EdgeGateway X1 | ,200.00 | ~45% |
| **Cloud Subscriptions** | CogniTwin Enterprise Tier, Neural API Pro, Autonomous Cloud Seat | .00 | ~55% |

---

## 4. Built-In Causal Mechanics & Statistical Properties

To ensure that machine learning algorithms (Prophet, XGBoost/LightGBM, SHAP, Ridge regression) produce meaningful and explainable results:

1. **Macro Growth Trend**:
   - Represents a 35% compound volume growth over the 2-year lifecycle.
2. **Weekly Seasonality**:
   - Friday through Sunday transactions experience a +25% demand lift due to weekly enterprise batch procurements.
3. **Yearly & Holiday Seasonality**:
   - November and December experience a +35% holiday budget flush.
   - August and September reflect a +15% Q3 infrastructure procurement surge.
4. **Marketing Spend Elasticity**:
   - Exhibits classical diminishing marginal returns: Multiplier = (spend / 5000)^0.35.
5. **Price & Competitive Cross-Elasticity**:
   - Discount lift = 1.0 + (discount_pct / 100) * 1.6.
   - Competitive drag = 1.0 - (competitor_discount_pct / 100) * 0.4.

---

## 5. End-to-End Verification & Testing Guide

### Test 1: Dynamic CSV Ingestion (/ingest)
1. Open http://localhost:3000/ingest.
2. Drag and drop [retail_enterprise_business_data.csv](file:///c:/ML%20Project/retail_enterprise_business_data.csv) into the upload drop zone.
3. Observe real-time schema profiling:
   - **Timeline**: date (Daily)
   - **Target Metric**: 
et_revenue
   - **Categorical Dimensions**: sku_name, product_category, sales_channel, 
egion, customer_segment
   - **Row Count**: 1,840 rows indexed into PostgreSQL table dataset_{uuid}.

### Test 2: Active Data Observatory (/dashboard)
1. Click **View Dashboard** or navigate to http://localhost:3000/dashboard.
2. Verify all components render with 100% fidelity:
   - **Revenue Trajectory Chart**: 730-day timeline showing seasonal waves and steady growth.
   - **Top Sellers & Nodes**: Top 5 SKUs (e.g. AgileCobot Arm 600, Automated Guided Rover).
   - **Dimensional Decompositions**: Interactive tabs for sku_name, product_category, sales_channel, and 
egion.
   - **Instant What-If Lever**: Adjust the price slider (-30% to +30%) and observe instant elasticity-adjusted revenue adjustments.

### Test 3: 90-Day Prophet Forecast Twin (/forecast)
1. Navigate to http://localhost:3000/forecast.
2. Click **Train Twin** to fit Prophet + Bayesian uncertainty models on the 730 daily points.
3. Observe:
   - Projected 90-day trajectory with confidence intervals (p10 to p90).
   - Top positive and negative SHAP force drivers (e.g. Marketing Spend Momentum, Lead Time Headwinds).
   - Executive prescriptive synthesis with financial impact and implementation timeframes.

### Test 4: Conversational AI Analyst (/query)
1. Navigate to http://localhost:3000/query.
2. Test natural language business inquiries:
   - *What are our top revenue categories and what action should we take to grow enterprise sales?*
     - **Result**: Executive summary, prioritized action recommendations with impact, and a dynamic Breakdown Bar/Pie Chart.
   - *Show me the monthly revenue trend over time*
     - **Result**: Executive trajectory narrative and a dynamic Line Chart rendered with interactive Recharts tooltips.
   - *Compare marketing spend vs net revenue across regions*
     - **Result**: Scatter/Bar correlation analysis identifying channel marketing efficiency.

---
*Documentation prepared for CogniTwin AI Quality Assurance and System Validation.*
