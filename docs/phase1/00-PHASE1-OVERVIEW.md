# Phase 1 — Overview and Scope Definition

> **Document Purpose**: Define exactly what Phase 1 delivers, what it excludes, and what conditions must be met for Phase 1 to be considered complete. Every other document in this specification references this document as the source of truth for scope.

---

## 1. Project Context

CogniTwin AI is an AI-powered Business Intelligence and Decision Intelligence platform for small retail businesses. The full vision spans predictive ML, explainable AI, RAG, agentic workflows, and interactive dashboards.

Phase 1 establishes the **foundational data infrastructure and delivers a working end-to-end prototype** that demonstrates the core value proposition: a business owner uploads CSV data, sees dashboards, gets sales forecasts, and can ask natural language questions about their data.

### Why Phase 1 Exists

Phase 1 exists to:

1. **Prove the end-to-end data flow** — from file upload to insight delivery — works before investing in advanced modules.
2. **Establish architectural foundations** — clean architecture, dependency injection, configuration management — that all future phases build upon.
3. **Deliver demo-ready functionality** — a working prototype that tells the "retail store owner" story with real charts, real predictions, and real natural language Q&A.
4. **Validate technology choices** — confirm that FastAPI + PostgreSQL + Prophet + Gemini + Next.js integrate cleanly before committing to the full stack.

---

## 2. Phase 1 Scope — What Is Included

### Module 1: Data Ingestion Pipeline (CSV Only)

- Upload CSV files through a web interface or API
- Validate file structure (encoding, delimiters, headers)
- Clean data (handle missing values, normalize types, trim whitespace)
- Detect schema (infer column types, map to business entities)
- Persist cleaned data into PostgreSQL
- Track upload history and data lineage

### Module 2: Structured Data Warehouse

- PostgreSQL database with normalized schema for:
  - Sales transactions
  - Products (with categories)
  - Customers
  - Inventory snapshots
  - Suppliers
- Migration system for schema versioning
- Seed data for demo/testing purposes

### Module 3: ML Forecasting Engine (Sales Forecasting Only)

- Time-series sales forecasting using Facebook Prophet
- Train on historical sales data from the warehouse
- Predict future daily/weekly/monthly sales
- Return predictions with confidence intervals
- Persist trained models to disk
- Expose predictions through API

### Module 4: LLM-Powered Natural Language Query

- Accept natural language business questions
- Convert questions to SQL using Gemini Pro
- Execute SQL against the warehouse
- Format results into natural language responses
- Return both the answer and the generated SQL for transparency

### Module 5: Dashboard Frontend

- File upload interface with drag-and-drop
- Data overview tables (sales, inventory, customers, products, suppliers)
- Sales trend charts (line charts, bar charts)
- Forecast visualization (predicted vs actual with confidence bands)
- Natural language Q&A interface (chat-style)
- Upload history and data status

### Module 6: FastAPI Backend

- RESTful API connecting all modules
- Request validation with Pydantic
- Structured error responses
- Health check endpoints
- CORS configuration for frontend
- Structured logging

### Module 7: Infrastructure

- Docker Compose for local development (PostgreSQL + Backend + Frontend)
- Environment-based configuration
- Database migration runner
- Seed data loader

---

## 3. Phase 1 Scope — What Is Explicitly Excluded

The following are **NOT part of Phase 1**. Any AI coding agent implementing Phase 1 must NOT implement these features, even partially:

| Excluded Feature | Reason for Exclusion | Phase Planned |
|---|---|---|
| PDF/DOCX/Image ingestion | Requires OCR pipeline, adds complexity | Phase 2 |
| RAG (Retrieval-Augmented Generation) | Requires vector DB (Qdrant), document chunking | Phase 2 |
| Vector database (Qdrant) | No document search in Phase 1 | Phase 2 |
| SHAP explanations | Requires classification models first | Phase 3 |
| Customer churn prediction | Classification model, not forecasting | Phase 3 |
| Anomaly detection | Isolation Forest/LOF, not core MVP | Phase 3 |
| Customer segmentation | Clustering, not core MVP | Phase 3 |
| Agentic architecture | Planner/Agent orchestration | Phase 4 |
| Multi-step reasoning | Requires agent framework | Phase 4 |
| User authentication | Single-tenant in Phase 1 | Phase 5 |
| Multi-tenancy | Single business owner in Phase 1 | Phase 5 |
| Real-time data streaming | Batch uploads only in Phase 1 | Future |
| Email/Slack notifications | No notification system | Future |
| Role-based access control | Single user in Phase 1 | Phase 5 |

> **Critical Rule**: The architecture must be **designed to accommodate** these future features (through proper abstraction and interfaces), but **no implementation code** for excluded features should exist in Phase 1.

---

## 4. Assumptions

These assumptions are made throughout this specification. If any assumption is invalid, the dependent design decisions must be re-evaluated.

| ID | Assumption | Impact if Invalid |
|---|---|---|
| A1 | The target user is a single business owner (no multi-user, no auth) | Add auth layer before deployment |
| A2 | All data arrives as CSV files with UTF-8 encoding (or detectable encoding) | Add encoding detection/conversion |
| A3 | CSV files have a header row as the first row | Add header detection logic |
| A4 | Sales data contains at minimum: date, amount, and product identifier columns | Schema mapping fails without these |
| A5 | Historical sales data spans at least 30 days for meaningful forecasts | Prophet produces unreliable results with less data |
| A6 | The Gemini API key is available and has sufficient quota | LLM Q&A module is non-functional without it |
| A7 | Docker and Docker Compose are available on the development machine | Infrastructure setup fails |
| A8 | The development machine has at least 8GB RAM and 10GB free disk | PostgreSQL + ML training may fail |
| A9 | Internet access is available for Gemini API calls and package installation | Offline mode not supported |
| A10 | All monetary values are in a single currency (no currency conversion) | Add currency normalization |

---

## 5. Constraints

| ID | Constraint | Rationale |
|---|---|---|
| C1 | Backend must use Python 3.11+ with FastAPI | Industry standard for ML-serving APIs |
| C2 | Frontend must use Next.js 14+ with TypeScript | Type safety, SSR capability, React ecosystem |
| C3 | Database must be PostgreSQL 15+ | ACID compliance, JSON support, mature ecosystem |
| C4 | ML forecasting must use Facebook Prophet | Robust time-series with minimal tuning |
| C5 | LLM must use Google Gemini Pro API | Cost-effective, good SQL generation capability |
| C6 | Maximum CSV file size: 50MB | Memory and processing time limits |
| C7 | Maximum 100,000 rows per CSV upload | Database performance and ML training limits |
| C8 | All API responses must complete within 30 seconds | User experience threshold |
| C9 | Forecast predictions limited to 90 days ahead | Prophet accuracy degrades beyond this |
| C10 | Single concurrent user (no concurrent upload handling) | Simplification for Phase 1 |

---

## 6. Success Criteria

Phase 1 is complete when ALL of the following are demonstrable:

### SC-1: Data Upload
A user can upload a sales CSV file through the web interface. The system validates the file, cleans the data, maps columns to the sales schema, and persists the data in PostgreSQL. The user sees a confirmation with row count and any warnings.

### SC-2: Data Browsing
A user can view uploaded data in tabular format on the dashboard. Sales, inventory, customer, product, and supplier data are displayed in paginated, sortable tables.

### SC-3: Sales Visualization
The dashboard displays sales trends as interactive line charts showing daily/weekly/monthly aggregations. The user can filter by date range.

### SC-4: Sales Forecasting
After uploading at least 30 days of sales data, the user can trigger a sales forecast. The system trains a Prophet model and displays predicted sales for the next 30/60/90 days with confidence intervals on a chart.

### SC-5: Natural Language Q&A
A user can type a business question like "What were the total sales last month?" in a chat interface. The system converts this to SQL, executes it, and returns a natural language answer along with the generated SQL.

### SC-6: Docker Deployment
The entire application (frontend + backend + database) starts with a single `docker-compose up` command and is usable at `http://localhost:3000`.

### SC-7: Error Resilience
Uploading a malformed CSV produces a clear, user-friendly error message — not a crash. Asking an unanswerable question returns a graceful "I cannot answer that" response — not an error.

---

## 7. Demo Scenario

This is the exact story that Phase 1 must support end-to-end:

```
1. The user opens CogniTwin AI at http://localhost:3000
2. They see a landing dashboard with an upload area
3. They drag-and-drop "sales_2024.csv" (12 months of daily sales)
4. The system shows a progress indicator
5. The system reports: "Uploaded 4,380 sales records. 12 warnings (missing values filled)."
6. The dashboard now shows:
   - A line chart of daily sales over 12 months
   - Key metrics: total revenue, average order value, top product
7. The user clicks "Forecast"
8. The system trains a model (loading indicator shown)
9. A forecast chart appears showing:
   - Historical sales (solid line)
   - Predicted sales for next 30 days (dashed line)
   - Confidence interval (shaded band)
10. The user opens the Q&A panel
11. They type: "Which month had the highest revenue?"
12. The system responds:
    "Based on your sales data, **March 2024** had the highest revenue
     at ₹4,52,000. This was 23% higher than the average monthly revenue."
    [SQL: SELECT ... FROM sales ... GROUP BY month ORDER BY total DESC LIMIT 1]
13. The user types: "What were the top 5 products by quantity sold?"
14. The system responds with a formatted list and the underlying SQL
```

---

## 8. Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | CSV column names vary across files (e.g., "Date" vs "date" vs "sale_date") | High | Medium | Implement fuzzy column matching with configurable aliases |
| R2 | Prophet training fails on insufficient data | Medium | High | Validate minimum 30 data points before training; return clear error |
| R3 | Gemini generates invalid SQL | Medium | High | Validate SQL before execution; use parameterized queries; catch DB errors |
| R4 | Gemini API rate limits or outages | Medium | Medium | Implement retry with exponential backoff; cache frequent queries |
| R5 | Large CSV uploads cause memory issues | Low | High | Stream CSV parsing; enforce 50MB/100K row limits |
| R6 | SQL injection through LLM-generated queries | Medium | Critical | Execute LLM SQL as read-only; use a restricted database role |
| R7 | Frontend-backend CORS issues | Medium | Low | Configure CORS explicitly in FastAPI |
| R8 | Docker networking issues across OS | Low | Medium | Use Docker Compose networking; document OS-specific fixes |
| R9 | Prophet model produces nonsensical forecasts | Low | Medium | Add forecast sanity checks (no negative values, reasonable bounds) |
| R10 | User uploads non-sales data to the sales endpoint | High | Medium | Validate required columns exist; provide column mapping UI |

---

## 9. Glossary

| Term | Definition |
|---|---|
| **Business Entity** | A domain concept (Sale, Product, Customer, Supplier, Inventory) that maps to a database table |
| **Column Mapping** | The process of matching CSV column names to expected database schema columns |
| **Confidence Interval** | The range within which a forecast prediction is expected to fall (default: 80%) |
| **Data Lineage** | Tracking which upload created which records, when, and any transformations applied |
| **Schema Detection** | Automatically inferring column data types (string, integer, float, date, boolean) from CSV content |
| **Seed Data** | Pre-loaded sample data that enables immediate demo functionality |
| **Warehouse** | The PostgreSQL database containing structured business data |

---

## 10. Document Index

| Document | Purpose |
|---|---|
| `00-PHASE1-OVERVIEW.md` | This document. Scope, assumptions, constraints, success criteria. |
| `01-ARCHITECTURE.md` | System architecture, technology decisions, component interactions, clean architecture layers. |
| `02-PROJECT-STRUCTURE.md` | Complete file tree, module boundaries, file responsibilities, naming conventions. |
| `03-DATABASE-SCHEMA.md` | Every table, column, type, constraint, index, migration strategy, seed data. |
| `04-API-SPECIFICATION.md` | Every endpoint, request/response schemas, status codes, error formats. |
| `05-DATA-INGESTION-ENGINE.md` | CSV pipeline: validation, cleaning, schema detection, column mapping, error handling. |
| `06-ML-FORECASTING-ENGINE.md` | Prophet model: data requirements, training pipeline, prediction API, model persistence. |
| `07-LLM-QUERY-ENGINE.md` | Gemini integration: prompt design, SQL generation, safety, response formatting. |
| `08-FRONTEND-DASHBOARD.md` | Pages, components, state management, data fetching, UI specifications. |
| `09-INFRASTRUCTURE.md` | Docker, environment variables, database initialization, deployment. |
| `10-ERROR-HANDLING-AND-LOGGING.md` | Error taxonomy, response formats, logging strategy, health checks. |
| `11-TESTING-STRATEGY.md` | Test types, test data, coverage expectations, test organization. |
| `12-IMPLEMENTATION-SEQUENCE.md` | Exact build order, dependencies, verification steps, milestones. |
| `13-DEVELOPMENT-CONVENTIONS.md` | Code style, naming, patterns, anti-patterns, commit conventions. |
