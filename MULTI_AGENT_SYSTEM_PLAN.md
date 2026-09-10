# CogniTwin AI — Decentralized 4-Agent Architecture & Enhancement Master Blueprint

**Platform**: CogniTwin AI (FastAPI + Clean DDD + Next.js 16 App Router + PostgreSQL + Qdrant + Prophet/SHAP)  
**Coordination Protocol**: Decentralized Peer-to-Peer over October Bus (october-bus MCP)  
**Status**: Ready for Agent Dispatch  

---

## 1. Multi-Agent Topology & System Architecture

The enhancement and validation of CogniTwin AI is divided into **four specialized, non-overlapping autonomous agent roles** linked through the decentralized **October Bus** message mesh and task board:

`
                  ┌─────────────────────────────────────────┐
                  │          OCTOBER BUS MESSAGE MESH       │
                  │ (Shared Backlog, P2P Messaging, Inbox) │
                  └────┬──────────┬──────────┬──────────┬───┘
                       │          │          │          │
         ┌─────────────┴──┐       │          │       ┌──┴─────────────┐
         │                │       │          │       │                │
┌────────▼─────────┐ ┌────▼───────▼──┐ ┌─────▼───────▼──┐ ┌───────────▼────┐
│  Agent 1: DATA   │ │ Agent 2: ML   │ │ Agent 3: UI/UX │ │ Agent 4: QA    │
│  Pipeline & Repo │ │ Forecast & AI │ │ Frontend Sync  │ │ Chaos Auditor  │
└──────────────────┘ └───────────────┘ └────────────────┘ └────────────────┘
`

### Communication & Handshake Protocol
- **Discovery**: Agents discover active peers using list_peers.
- **Task Claiming**: Agents claim atomic work items from the shared backlog using claim_task and mark them done using complete_task.
- **Contract Handshakes**: When an API schema or data model is updated (e.g. dataset_id binding on forecast routes), the authoring agent sends a direct durable notice to affected peers via message_peer.
- **Cross-Domain Verification**: The QA Agent independently audits completed tasks before final sign-off.

---

## 2. Role Specifications & Target Workstreams

### Role 1: Backend Data Pipeline & Repository Architect
* **Agent Identifier**: agent-backend-data
* **Domain**: Ingestion, Dynamic Schema Profiling, Data Cleaning, and PostgreSQL Repository.
* **Target Files**:
  - backend/src/services/ingestion.py
  - backend/src/services/data_cleaner.py
  - backend/src/infrastructure/database/repository.py
  - backend/src/api/ingestion_router.py
  - backend/src/api/data_router.py
* **Core Objectives**:
  1. **Dynamic Ingestion Robustness ([BACKEND-DATA-01])**:
     - Fortify date parsing to gracefully handle non-standard ISO formats, mixed delimiters (/, ., -), and epoch timestamps.
     - Ensure numerical cleaning strictly preserves signed floats, scientific notation, and financial currencies while replacing nulls.
     - Prevent synthetic column pollution under any schema variation.
  2. **Repository Schema & Dimension Resolution ([BACKEND-DATA-02])**:
     - Ensure get_summary_metrics seamlessly aggregates telemetry regardless of column naming conventions.
     - Harden get_table_schemas to expose rich column descriptions and sample distributions to Groq LLM.

---

### Role 2: Backend ML Forecasting, SHAP & AI Reasoning Architect
* **Agent Identifier**: agent-backend-ml
* **Domain**: Prophet Time-Series Modeling, Multi-Lever Simulation, SHAP Feature Attribution, Groq NL2SQL, and Document RAG.
* **Target Files**:
  - backend/src/services/forecast_service.py
  - backend/src/infrastructure/ml/prophet_forecaster.py
  - backend/src/infrastructure/ml/shap_engine.py
  - backend/src/services/shap_explainer_service.py
  - backend/src/services/prescriptive_service.py
  - backend/src/services/query_service.py
  - backend/src/infrastructure/llm/groq_client.py
  - backend/src/api/forecast_router.py
* **Core Objectives**:
  1. **Dataset-Aware Prophet Pipeline ([BACKEND-ML-01])**:
     - Update /forecast/train, /forecast/predict, /forecast/simulate, and /forecast/status to accept and bind explicit dataset_id.
     - Eliminate the hardcoded fallback to latest dataset so historical and multi-dataset forecasting is isolated and deterministic.
  2. **Multi-Lever Simulation Tensor Engine ([BACKEND-ML-02])**:
     - Expand simulate_scenario in prophet_forecaster.py to calculate compound shocks across multiple levers (price + marketing + lead time + competitor discounts).
     - Align SHAP force drivers with simulated trajectories so positive and negative economic levers are explained mathematically.
  3. **Groq NL2SQL Intelligence & Prescriptions ([BACKEND-ML-03])**:
     - Refine prompt templates in groq_client.py to support SQL window functions, moving averages, and period-over-period comparisons.
     - Deepen prescriptive_service.py to synthesize strategic action recommendations with quantified financial impact (₹ / $) and timeframe tags.

---

### Role 3: Frontend UI/UX & API Connection Engineer
* **Agent Identifier**: agent-frontend-ui
* **Domain**: Cybernetic Dark HUD UI/UX, State Management, Navigation Synchronization, Dynamic Visualizations, and API Resilience.
* **Target Files**:
  - frontend/src/app/(app)/dashboard/page.tsx
  - frontend/src/app/(app)/ingest/page.tsx
  - frontend/src/app/(app)/forecast/page.tsx
  - frontend/src/app/(app)/query/page.tsx
  - frontend/src/lib/api.ts
  - frontend/src/components/dashboard/RevenueChart.tsx
  - frontend/src/components/query/DynamicChartRenderer.tsx
  - frontend/src/components/forecast/WhatIfSimulator.tsx
* **Core Objectives**:
  1. **Unified Global Dataset Synchronization ([FRONTEND-UI-01])**:
     - Build a persistent dataset selector and synchronization context across /ingest, /dashboard, /forecast, and /query.
     - Ensure selecting or uploading a dataset on /ingest instantly updates Observatory metrics, Forecast models, and Query contexts.
  2. **Dynamic Multi-Chart Expansion ([FRONTEND-UI-02])**:
     - Upgrade DynamicChartRenderer.tsx to support Area charts, dual-axis line/bar charts, and stacked breakdowns with Recharts/Visx.
     - Add interactive hover tooltips with contextual currency and percentage formatters.
  3. **UX Resilience & Cybernetic HUD Polish ([FRONTEND-UI-03])**:
     - Add defensive error boundaries, cybernetic skeleton loaders, and toast notifications.
     - Ensure mobile and ultra-wide layouts render with zero horizontal scroll overflow and zero layout shift.

---

### Role 4: End-to-End Chaos Testing & Quality Assurance Auditor
* **Agent Identifier**: agent-qa-chaos
* **Domain**: Real-World Dataset Validation, Chaos Engineering, Failure Recovery, API Contract Testing, and User Journey Auditing.
* **Target Files**:
  - backend/tests/
  - c:/ML Project/retail_enterprise_business_data.csv
  - Integration and Chaos Test Harnesses
* **Core Objectives**:
  1. **Real-World & Dirty Dataset Chaos Auditing ([QA-CHAOS-01])**:
     - Stress-test the ingestion engine with noisy CSVs (missing cells, negative values, corrupted timestamps, high row counts).
     - Test PDF knowledge base ingestion and vector similarity search in Qdrant.
  2. **End-to-End User Flow & Contract Testing ([QA-CHAOS-02])**:
     - Build and execute automated end-to-end user journeys:
       CSV Ingestion -> Profiling -> Observatory Dashboard -> Prophet Model Fit -> Counterfactual Simulation -> Executive NL2SQL Synthesis.
     - Verify zero 500 internal server errors, graceful degradation under simulated network failure, and 100% test pass rate across pytest backend/tests.

---

## 3. Seeded October Bus Task Backlog

| Task ID | Domain Tag | Task Title | Primary Assigned Agent |
|---|---|---|---|
| task_71bc81ad... | [BACKEND-DATA-01] | Dynamic Ingestion Robustness & Dirty Data Sanitization | agent-backend-data |
| task_7ef6ed19... | [BACKEND-DATA-02] | Repository Schema & Dimension Resolution Hardening | agent-backend-data |
| task_0e4ba877... | [BACKEND-ML-01] | Dataset-Aware Prophet Forecasting Pipeline | agent-backend-ml |
| task_47ab1ef8... | [BACKEND-ML-02] | Multi-Lever Simulation Tensor Engine & SHAP Alignment | agent-backend-ml |
| task_0f548a36... | [BACKEND-ML-03] | Groq NL2SQL Intelligence & Prescriptive Synthesis | agent-backend-ml |
| task_490f9208... | [FRONTEND-UI-01] | Unified Global Dataset State & Navigation Sync | agent-frontend-ui |
| task_39529bf3... | [FRONTEND-UI-02] | Dynamic Multi-Chart Engine & Visualization Polish | agent-frontend-ui |
| task_4625ddaf... | [FRONTEND-UI-03] | UX Resilience, Error Boundaries & HUD Polish | agent-frontend-ui |
| task_b8ae4c20... | [QA-CHAOS-01] | Real-World Dataset & Document Ingestion Chaos Auditing | agent-qa-chaos |
| task_ff6e280c... | [QA-CHAOS-02] | End-to-End User Flow & API Contract Verification Suite | agent-qa-chaos |

---

## 4. Execution Workflow & Next Steps

1. **Agent Invocation**: Launch the four subagents with their domain prompts and October Bus MCP tools enabled (enable_mcp_tools=True).
2. **Backlog Ingestion**: Each agent runs list_tasks on October Bus and claims its respective high-priority work items using claim_task.
3. **P2P Collaboration**:
   - agent-backend-ml coordinates with agent-backend-data via message_peer on table schemas and column mappings.
   - agent-frontend-ui queries agent-backend-ml and agent-backend-data on API request/response payloads.
   - agent-qa-chaos validates each completed task and reports verification proofs back to the team.
4. **Final Gate**: Full regression run of backend pytest, Next.js production build, and live browser dogfooding.
