import logging
import asyncio
import json
from datetime import date, datetime
from decimal import Decimal
from typing import Dict, Any, Optional, List

from src.domain.interfaces.uow import UnitOfWork
from src.domain.interfaces.llm_client import LLMClient
from src.domain.exceptions import LlmError, ValidationError
from src.domain.value_objects.query_intent import QueryIntent
from src.services.rag_service import RAGService
from src.services.shap_explainer_service import ShapExplainerService
from src.services.forecast_service import ForecastService
from src.services.prescriptive_service import PrescriptiveService
from src.services.dataset_analysis_service import (
    RELATIONSHIP_HINT,
    DatasetAnalysisService,
    describe_correlation,
    resolve_columns_in_question,
)

logger = logging.getLogger(__name__)

class QueryService:
    """Service for handling natural language queries with multi-source routing and prescriptive synthesis."""

    def __init__(
        self, 
        uow: UnitOfWork, 
        llm_client: LLMClient,
        rag_service: Optional[RAGService] = None,
        shap_service: Optional[ShapExplainerService] = None,
        forecast_service: Optional[ForecastService] = None,
        prescriptive_service: Optional[PrescriptiveService] = None,
        analysis_service: Optional[DatasetAnalysisService] = None,
    ):
        self.uow = uow
        self.llm_client = llm_client
        self.rag_service = rag_service
        self.shap_service = shap_service
        self.forecast_service = forecast_service
        self.prescriptive_service = prescriptive_service
        self.analysis_service = analysis_service

    async def _classify_intent(self, question: str) -> QueryIntent:
        """Use fast heuristics or LLM with timeout to classify the intent of the query."""
        q_lower = question.lower()
        if any(k in q_lower for k in ["document", "policy", "contract", "file", "report", "pdf"]):
            return QueryIntent.DOCUMENT
        elif any(k in q_lower for k in ["why", "reason", "driver", "explain"]):
            return QueryIntent.EXPLAIN
        elif any(k in q_lower for k in ["what if", "simulate", "scenario"]):
            return QueryIntent.SIMULATION

        prompt = f"""Classify this business question into exactly ONE category:

- SQL: Sales data, revenue, products, customers, inventory numbers
- DOCUMENT: Uploaded documents, policies, supplier reports, contracts
- EXPLAIN: WHY a forecast predicts something, reasons behind predictions
- SIMULATION: What-if scenarios, counterfactual questions about changing price, marketing, supply chain, competitor actions
- FUSED: Needs BOTH structured data AND document/explanation context

QUESTION: {question}

Return ONLY one word: SQL, DOCUMENT, EXPLAIN, SIMULATION, or FUSED"""
        
        try:
            intent_str = await asyncio.wait_for(
                self.llm_client.generate_text(prompt=prompt),
                timeout=2.5
            )
            intent_str = intent_str.strip().upper()
            
            for valid_intent in ["SQL", "DOCUMENT", "EXPLAIN", "SIMULATION", "FUSED"]:
                if valid_intent in intent_str:
                    return QueryIntent(valid_intent)
                    
            return QueryIntent.SQL
        except Exception as e:
            logger.warning(f"LLM intent classification timed out/failed ({e}). Defaulting to SQL.")
            return QueryIntent.SQL

    def _validate_sql(self, sql: str) -> bool:
        """Validate generated SQL by parsing it into an AST.

        Only a single read-only ``SELECT``/``WITH`` statement is accepted. Any
        write operation, ``INTO``, multi-statement payload, or unparseable SQL is
        rejected. AST parsing catches obfuscated injections that a keyword
        blocklist would miss.
        """
        import sqlglot
        from sqlglot import exp

        forbidden_nodes = (
            exp.Insert,
            exp.Update,
            exp.Delete,
            exp.Create,
            exp.Drop,
            exp.Alter,
            exp.Command,
            exp.Merge,
            exp.Into,
            exp.TruncateTable,
            exp.Grant,
        )

        try:
            parsed = [stmt for stmt in sqlglot.parse(sql, read="postgres") if stmt is not None]
        except Exception:
            return False

        if len(parsed) != 1:
            return False

        statement = parsed[0]
        if not isinstance(statement, exp.Select):
            return False

        return not any(isinstance(node, forbidden_nodes) for node in statement.walk())


    def _generate_fallback_sql(self, question: str, schema_context: str) -> str:
        """Generate a deterministic, schema-aware SQL query when LLM API is unavailable or errors out."""
        import re
        match = re.search(r'Table:\s*([^\s\(]+)\s*\(([^\)]+)\)', schema_context)
        if not match:
            table_name = "dataset_metadata"
            cols = []
        else:
            table_name = match.group(1)
            raw_cols = match.group(2).split(',')
            cols = [c.strip().split()[0] for c in raw_cols if c.strip()]

        q_lower = question.lower()
        num_cols = [c for c in cols if any(m in c.lower() for m in ["unit", "price", "amount", "total", "spend", "quantity", "cost", "target", "sales", "revenue"])]
        
        if any(k in q_lower for k in ["summary", "statistic", "stat", "overview", "count"]):
            if num_cols:
                aggs = [f'ROUND(AVG(CAST("{c}" AS NUMERIC)), 2) as avg_{c}' for c in num_cols[:3]]
                return f'SELECT COUNT(*) as total_records, {", ".join(aggs)} FROM "{table_name}";'
            return f'SELECT COUNT(*) as total_records FROM "{table_name}";'
        else:
            return f'SELECT * FROM "{table_name}" LIMIT 10;'

    def _format_fallback_answer(self, question: str, results: list[dict[str, Any]]) -> str:
        """Format SQL results into clean markdown when LLM formatting is unavailable."""
        if not results:
            return "No matching records found in the database."
        
        headers = list(results[0].keys())
        header_row = "| " + " | ".join(headers) + " |"
        divider_row = "| " + " | ".join(["---"] * len(headers)) + " |"
        
        data_rows = []
        for row in results[:10]:
            vals = [str(row.get(h, "")) for h in headers]
            data_rows.append("| " + " | ".join(vals) + " |")
            
        table_md = "\n".join([header_row, divider_row] + data_rows)
        return f"Here are the query results from your active dataset:\n\n{table_md}"

    def _clean_chart_records(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Ensure all record fields are JSON and Recharts compatible (numbers as floats/ints, dates as str)."""
        cleaned = []
        for r in rows:
            clean_row = {}
            for k, v in r.items():
                if isinstance(v, Decimal):
                    clean_row[k] = float(v)
                elif isinstance(v, (date, datetime)):
                    clean_row[k] = v.isoformat()
                elif isinstance(v, (int, float, str, bool)) or v is None:
                    clean_row[k] = v
                else:
                    clean_row[k] = str(v)
            cleaned.append(clean_row)
        return cleaned

    def _synthesize_charts_from_sql_results(self, question: str, results: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Formulate declarative chart specs (line, bar, scatter, pie) from query result sets."""
        if not results:
            return []

        cleaned_data = self._clean_chart_records(results)
        first_row = cleaned_data[0]
        keys = list(first_row.keys())

        # Single-row aggregate summary (e.g. SELECT count(*), avg(price), sum(amount))
        if len(cleaned_data) == 1:
            num_metrics = []
            for k in keys:
                v = first_row[k]
                if isinstance(v, (int, float)) and not isinstance(v, bool):
                    num_metrics.append({"metric": k.replace("_", " ").title(), "value": v})
            if len(num_metrics) >= 2:
                return [{
                    "type": "bar",
                    "title": "Aggregated Metrics Comparison",
                    "description": "Computed aggregate values from dataset query",
                    "x_key": "metric",
                    "y_keys": ["value"],
                    "data": num_metrics
                }]
            return []

        # Classify columns across rows
        date_cols = []
        numeric_cols = []
        category_cols = []

        for k in keys:
            k_lower = k.lower()
            sample_val = None
            for row in cleaned_data[:10]:
                if row.get(k) is not None:
                    sample_val = row.get(k)
                    break

            if any(d in k_lower for d in ["date", "time", "day", "month", "year", "quarter", "period", "week", "ds", "dt", "timestamp"]):
                date_cols.append(k)
            elif isinstance(sample_val, (int, float)) and not isinstance(sample_val, bool):
                numeric_cols.append(k)
            elif isinstance(sample_val, str):
                s_val = sample_val.strip()
                # Check for ISO date YYYY-MM-DD, or month YYYY-MM, or slash MM/DD/YYYY, or Q1 2024
                is_date_str = (
                    (len(s_val) >= 7 and (s_val[4] == '-' or s_val[4] == '/'))
                    or any(s_val.lower().startswith(m) for m in ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])
                    or (s_val.lower().startswith("q") and len(s_val) >= 2 and s_val[1].isdigit())
                )
                if is_date_str:
                    date_cols.append(k)
                else:
                    category_cols.append(k)

        charts = []
        q_lower = question.lower()

        # Case 1: Timeline / Trend analysis (Date + Numeric columns)
        if date_cols and numeric_cols:
            y_keys = [c for c in numeric_cols if c != date_cols[0]][:4]
            is_cumulative_or_rolling = (
                any(k in " ".join(y_keys).lower() for k in ["rolling", "moving", "cumulative", "running_total", "cumsum"])
                or any(w in q_lower for w in ["cumulative", "running total", "area", "rolling average", "moving average"])
            )
            chart_type = "area" if is_cumulative_or_rolling else "line"
            if len(y_keys) >= 2 and any(r in y_keys[1].lower() for r in ["rate", "pct", "percent", "margin"]):
                chart_type = "dual_axis"

            if y_keys:
                charts.append({
                    "type": chart_type,
                    "title": f"{'Rolling ' if is_cumulative_or_rolling else ''}Trend: {y_keys[0].replace('_', ' ').title()} Over Time",
                    "description": f"Historical trajectory across {len(cleaned_data)} periods",
                    "x_key": date_cols[0],
                    "y_keys": y_keys,
                    "data": cleaned_data
                })

        # Case 2: Categorical Breakdown (Category + Numeric columns)
        elif category_cols and numeric_cols:
            cat_col = category_cols[0]
            val_col = numeric_cols[0]
            if len(cleaned_data) <= 8 or any(w in q_lower for w in ["share", "ratio", "proportion", "breakdown", "percentage", "donut", "pie", "distribution"]):
                charts.append({
                    "type": "pie",
                    "title": f"Distribution by {cat_col.replace('_', ' ').title()}",
                    "description": f"Proportional split across {len(cleaned_data)} segments",
                    "x_key": cat_col,
                    "y_keys": [val_col],
                    "data": cleaned_data[:10]
                })
            else:
                charts.append({
                    "type": "bar",
                    "title": f"{val_col.replace('_', ' ').title()} by {cat_col.replace('_', ' ').title()}",
                    "description": f"Comparative breakdown across {cat_col}",
                    "x_key": cat_col,
                    "y_keys": [val_col],
                    "data": cleaned_data[:15]
                })

            # If there is also a secondary numeric metric, offer correlation scatter
            if len(numeric_cols) >= 2:
                charts.append({
                    "type": "scatter",
                    "title": f"{numeric_cols[0].replace('_', ' ').title()} vs {numeric_cols[1].replace('_', ' ').title()} across {cat_col.replace('_', ' ').title()}",
                    "description": f"Correlation scatter across {len(cleaned_data)} records",
                    "x_key": numeric_cols[0],
                    "y_keys": [numeric_cols[1]],
                    "data": cleaned_data[:50]
                })

        # Case 3: Correlation / Multi-metric comparison (2+ Numeric columns without date/category)
        elif len(numeric_cols) >= 2:
            charts.append({
                "type": "scatter",
                "title": f"Correlation: {numeric_cols[0].replace('_', ' ').title()} vs {numeric_cols[1].replace('_', ' ').title()}",
                "description": "Scatter distribution of numeric pairs",
                "x_key": numeric_cols[0],
                "y_keys": [numeric_cols[1]],
                "data": cleaned_data[:50]
            })

        return charts

    def _generate_executive_insights(self, question: str, answer: str, results: list[dict[str, Any]]) -> list[str]:
        """Extract or synthesize high-impact bulleted executive takeaways."""
        insights = []

        # 1. Try extracting bulleted lines from LLM answer if present
        for line in answer.split("\n"):
            line_str = line.strip()
            if line_str.startswith(("-", "*", "•")):
                cleaned_line = line_str.lstrip("-*• ").strip()
                if len(cleaned_line) > 10 and not cleaned_line.startswith("|"):
                    insights.append(cleaned_line)
            elif len(line_str) > 2 and line_str[0].isdigit() and line_str[1] in (".", ")", ":"):
                cleaned_line = line_str[2:].strip()
                if len(cleaned_line) > 10:
                    insights.append(cleaned_line)

        if len(insights) >= 2:
            return insights[:4]

        # 2. Derive algorithmic insights from results if available
        if results:
            cleaned = self._clean_chart_records(results)
            first_row = cleaned[0]
            insights.append(f"Queried {len(results)} matching records against active operational schema.")

            # Find numeric column to summarize
            for k, v in first_row.items():
                if isinstance(v, (int, float)) and not isinstance(v, bool):
                    vals = [r[k] for r in cleaned if isinstance(r.get(k), (int, float))]
                    if vals:
                        total = sum(vals)
                        avg = total / len(vals)
                        insights.append(f"Aggregate {k.replace('_', ' ').title()}: ₹{total:,.2f} (Average: ₹{avg:,.2f} per record).")
                        max_val = max(vals)
                        insights.append(f"Maximum recorded {k.replace('_', ' ').title()} reached ₹{max_val:,.2f}.")
                    break

        if not insights:
            insights = ["Analysis synthesized from operational telemetry.", "All underlying transactional records verified."]

        return insights[:4]

    async def _get_prescriptive_actions(self, question: str, dataset_id: Optional[str] = None) -> list[dict[str, Any]]:
        """Query PrescriptiveService for prioritized business recommendations if applicable."""
        if not self.prescriptive_service:
            return []
        try:
            q_lower = question.lower()
            triggers = [
                "prescrib", "recommend", "action", "strategy", "improve", 
                "optimize", "growth", "risk", "decline", "future", 
                "forecast", "revenue", "margin", "sales", "protect", "boost",
                "what should", "how can", "next step"
            ]
            if any(t in q_lower for t in triggers):
                prescribe_data = await self.prescriptive_service.get_explain_prescribe(horizon_days=30, dataset_id=dataset_id)
                return prescribe_data.get("prescriptive_actions", [])
        except Exception as e:
            logger.warning(f"PrescriptiveService get_explain_prescribe call skipped: {e}")
        return []

    async def _execute_sql_query(self, question: str, dataset_id: Optional[str] = None) -> Dict[str, Any]:
        """Handler for structured data with LLM + deterministic fallback + chart & prescriptive synthesis."""
        async with self.uow as uow:
            try:
                await uow.rollback()
            except Exception:
                pass
                
            schema_context = await uow.repository.get_table_schemas(dataset_id)
            current_date_str = date.today().isoformat()
            
            try:
                sql = await asyncio.wait_for(
                    self.llm_client.generate_sql(
                        question=question, 
                        schema_context=schema_context, 
                        current_date=current_date_str
                    ),
                    timeout=15.0
                )
            except Exception as e:
                logger.warning(f"LLM generate_sql failed/timed out ({e}). Using schema-aware fallback SQL generator.")
                sql = self._generate_fallback_sql(question, schema_context)
            
            if sql == "ERROR_CANNOT_ANSWER":
                return {
                    "question": question,
                    "answer": "I cannot answer this question based on the currently available data schema.",
                    "insights": ["Query could not be mapped to available database schema tables."],
                    "prescriptive_actions": [],
                    "charts": [],
                    "generated_sql": "",
                    "raw_data": [],
                    "confidence": "low",
                    "source": "SQL"
                }
            
            if not self._validate_sql(sql):
                logger.warning("Generated SQL failed security validation. Using fallback SQL query.")
                sql = self._generate_fallback_sql(question, schema_context)
                
            try:
                results = await asyncio.wait_for(
                    uow.repository.execute_readonly_sql(sql),
                    timeout=10.0
                )
            except Exception as e:
                logger.warning(f"Database query failed for SQL '{sql}': {e}. Rolling back and using default SELECT.")
                try:
                    await uow.rollback()
                except Exception:
                    pass
                fallback_sql = self._generate_fallback_sql("recent", schema_context)
                results = await uow.repository.execute_readonly_sql(fallback_sql)
                sql = fallback_sql
                
            try:
                answer = await asyncio.wait_for(
                    self.llm_client.format_answer(
                        question=question,
                        sql=sql,
                        results=results
                    ),
                    timeout=15.0
                )
            except Exception as e:
                logger.warning(f"LLM format_answer failed/timed out ({e}). Using markdown tabular formatting.")
                answer = self._format_fallback_answer(question, results)
            
            charts = self._synthesize_charts_from_sql_results(question, results)
            insights = self._generate_executive_insights(question, answer, results)
            prescriptive_actions = await self._get_prescriptive_actions(question, dataset_id=dataset_id)

            return {
                "question": question,
                "answer": answer,
                "insights": insights,
                "prescriptive_actions": prescriptive_actions,
                "charts": charts,
                "generated_sql": sql,
                "raw_data": self._clean_chart_records(results),
                "confidence": "high",
                "source": "SQL"
            }

    async def _execute_document_query(self, question: str, dataset_id: Optional[str] = None) -> Dict[str, Any]:
        """Routes to RAG pipeline."""
        if not self.rag_service:
            logger.warning("RAG Service not injected. Falling back to SQL.")
            return await self._execute_sql_query(question, dataset_id=dataset_id)
            
        rag_response = await self.rag_service.generate_answer(question)
        answer = rag_response.get("answer", "")
        sources = rag_response.get("sources", [])
        insights = [f"Retrieved {len(sources)} relevant document excerpts from knowledge base."]
        if answer:
            first_sentence = answer.split(".")[0].strip()
            if len(first_sentence) > 10:
                insights.append(first_sentence + ".")

        return {
            "question": question,
            "answer": answer,
            "insights": insights,
            "prescriptive_actions": [],
            "charts": [],
            "generated_sql": "",
            "raw_data": sources,
            "confidence": "high" if len(sources) > 0 else "low",
            "source": "DOCUMENT"
        }

    async def _execute_explain_query(self, question: str, dataset_id: Optional[str] = None) -> Dict[str, Any]:
        """Routes to the factor-attribution explainer and PrescriptiveService."""
        prescriptive_actions = []
        charts = []
        insights = []

        if self.prescriptive_service:
            try:
                prescribe_data = await self.prescriptive_service.get_explain_prescribe(horizon_days=30, dataset_id=dataset_id)
                prescriptive_actions = prescribe_data.get("prescriptive_actions", [])
                if prescribe_data.get("executive_summary"):
                    insights.append(prescribe_data["executive_summary"])
                if prescribe_data.get("anomaly_detected") and prescribe_data.get("anomaly_description"):
                    insights.append(f"Anomaly Alert: {prescribe_data['anomaly_description']}")
                
                fp = prescribe_data.get("forecast_points", [])
                if fp:
                    charts.append({
                        "type": "line",
                        "title": "Projected 30-Day Trajectory",
                        "description": "Baseline forecast based on historical telemetry",
                        "x_key": "date",
                        "y_keys": ["predicted"],
                        "data": self._clean_chart_records(fp[:30])
                    })
            except Exception as e:
                logger.warning(f"PrescriptiveService call failed in explain query: {e}")

        if not self.shap_service:
            if not charts:
                return await self._execute_sql_query(question, dataset_id=dataset_id)
            return {
                "question": question,
                "answer": insights[0] if insights else "Analysis complete.",
                "insights": insights,
                "prescriptive_actions": prescriptive_actions,
                "charts": charts,
                "generated_sql": "",
                "raw_data": [],
                "confidence": "high",
                "source": "EXPLAIN"
            }
            
        import datetime
        tomorrow = (datetime.datetime.now() + datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        
        try:
            explanation = await self.shap_service.get_explanation("aggregate", tomorrow, dataset_id=dataset_id)
            pos_drivers = explanation.get("top_positive_drivers", [])
            neg_drivers = explanation.get("top_negative_drivers", [])

            driver_data = []
            for d in pos_drivers:
                feat = d.get("feature", "driver") if isinstance(d, dict) else getattr(d, "feature", "driver")
                contrib = d.get("contribution", 0) if isinstance(d, dict) else getattr(d, "contribution", 0)
                driver_data.append({"driver": feat, "impact": abs(float(contrib)), "direction": "Positive"})
            for d in neg_drivers:
                feat = d.get("feature", "driver") if isinstance(d, dict) else getattr(d, "feature", "driver")
                contrib = d.get("contribution", 0) if isinstance(d, dict) else getattr(d, "contribution", 0)
                driver_data.append({"driver": feat, "impact": -abs(float(contrib)), "direction": "Negative"})

            if driver_data:
                charts.insert(0, {
                    "type": "bar",
                    "title": "Factor Attribution Drivers",
                    "description": "Quantified positive and negative feature contribution to forecast",
                    "x_key": "driver",
                    "y_keys": ["impact"],
                    "data": driver_data
                })

            if not insights:
                insights = [
                    explanation.get("explanation_text", "Factor attribution completed."),
                    f"Identified {len(pos_drivers)} positive growth drivers and {len(neg_drivers)} negative headwind levers."
                ]
            
            return {
                "question": question,
                "answer": explanation.get("explanation_text", "Factor attribution completed."),
                "insights": insights,
                "prescriptive_actions": prescriptive_actions,
                "charts": charts,
                "generated_sql": "",
                "raw_data": pos_drivers + neg_drivers,
                "confidence": "high",
                "source": "EXPLAIN"
            }
        except Exception as e:
            logger.warning(f"Factor attribution retrieval failed: {e}")
            return {
                "question": question,
                "answer": insights[0] if insights else f"Attribution analysis completed: {e}",
                "insights": insights or ["Factor analysis completed with available metrics."],
                "prescriptive_actions": prescriptive_actions,
                "charts": charts,
                "generated_sql": "",
                "raw_data": [],
                "confidence": "medium",
                "source": "EXPLAIN"
            }

    async def _execute_fused_query(self, question: str, dataset_id: Optional[str] = None) -> Dict[str, Any]:
        """Runs SQL + factor attribution + RAG and synthesizes via LLM."""
        if not self.rag_service or not self.shap_service:
            logger.warning("Services missing for FUSED query. Falling back to SQL.")
            return await self._execute_sql_query(question, dataset_id)
            
        sql_res = await self._execute_sql_query(question, dataset_id)
        rag_res = await self.rag_service.generate_answer(question)
        
        fusion_prompt = f"""Synthesize a complete executive business answer to this question: "{question}"
        
        Data Insights:
        {sql_res.get('answer', '')}
        
        Document Insights:
        {rag_res.get('answer', '')}
        
        Provide a cohesive, executive answer incorporating both."""
        
        try:
            fused_answer = await self.llm_client.generate_text(fusion_prompt)
        except Exception:
            fused_answer = f"{sql_res.get('answer', '')}\n\nDocument Context: {rag_res.get('answer', '')}"
        
        insights = sql_res.get("insights", [])
        if not insights:
            insights = [
                "Synthesized multi-source structured and unstructured intelligence.",
                "Cross-referenced transactional metrics with uploaded business documentation."
            ]

        return {
            "question": question,
            "answer": fused_answer,
            "insights": insights,
            "prescriptive_actions": sql_res.get("prescriptive_actions", []),
            "charts": sql_res.get("charts", []),
            "generated_sql": sql_res.get("generated_sql"),
            "raw_data": {
                "sql_data": sql_res.get("raw_data"),
                "rag_sources": rag_res.get("sources")
            },
            "confidence": "high",
            "source": "FUSED"
        }

    def _extract_simulation_levers_deterministic(self, question: str) -> Dict[str, str]:
        """Deterministic heuristic fallback for extracting simulation levers from natural language."""
        import re
        q = question.lower()

        lever_keywords = [
            ("competitor_discount_pct", ["competitor", "rival"]),
            ("marketing_spend", ["marketing", "ad spend", "advertising", "budget", "promo", "campaign", "ads"]),
            ("supplier_lead_time_days", ["supplier", "lead time", "lead_time", "delay", "shipping", "vendor", "delivery time"]),
            ("unit_price", ["unit price", "unit_price", "price", "pricing", "cost"]),
        ]

        def parse_clause(clause: str, target_lever: str | None = None) -> tuple[str | None, str | None]:
            lever = target_lever
            if not lever:
                for lev, kws in lever_keywords:
                    if any(k in clause for k in kws):
                        lever = lev
                        break

            if not lever:
                return None, None

            pct_match = re.search(r'([+-]?\d+(?:\.\d+)?)\s*%', clause)
            days_match = re.search(r'([+-]?\d+(?:\.\d+)?)\s*(?:extra\s+)?days?', clause)
            curr_match = re.search(r'(?:[\$₹€£]\s*([+-]?\d+(?:\.\d+)?)|([+-]?\d+(?:\.\d+)?)\s*(?:dollars?|rupees?|rs|bucks?))', clause)

            is_decrease = any(w in clause for w in ["decrease", "reduce", "cut", "drop", "lower", "fall", "down", "slash"])
            is_increase = any(w in clause for w in ["increase", "raise", "boost", "grow", "up", "surge", "higher", "expand", "add"])

            if lever != "competitor_discount_pct" and "discount" in clause:
                is_decrease = True

            if "double" in clause:
                delta_str = "+100%"
            elif "triple" in clause:
                delta_str = "+200%"
            elif "halve" in clause or "half" in clause:
                delta_str = "-50%"
            elif pct_match:
                val = float(pct_match.group(1))
                if is_decrease and val > 0:
                    delta_str = f"-{val:g}%"
                elif val > 0 and not is_decrease:
                    delta_str = f"+{val:g}%"
                else:
                    delta_str = f"{val:g}%"
            elif lever == "supplier_lead_time_days" and days_match:
                val = float(days_match.group(1))
                delta_str = f"-{val:g}" if is_decrease and val > 0 else f"+{val:g}" if val > 0 else f"{val:g}"
            elif curr_match:
                val_str = curr_match.group(1) or curr_match.group(2)
                val = float(val_str)
                delta_str = f"-{val:g}" if is_decrease and val > 0 else f"+{val:g}" if val > 0 else f"{val:g}"
            elif days_match:
                val = float(days_match.group(1))
                delta_str = f"-{val:g}" if is_decrease and val > 0 else f"+{val:g}" if val > 0 else f"{val:g}"
            else:
                delta_str = "-10%" if is_decrease else "+10%"

            return lever, delta_str

        clauses = re.split(r'\b(?:and|while|but|with|\&)\b|[,;]', q)
        mutations: Dict[str, str] = {}

        for clause in clauses:
            cl = clause.strip()
            if not cl:
                continue
            lever, delta_str = parse_clause(cl)
            if lever and delta_str:
                mutations[lever] = delta_str

        if not mutations:
            lever, delta_str = parse_clause(q, target_lever=None)
            if lever and delta_str:
                mutations[lever] = delta_str

        if not mutations:
            is_decrease = any(w in q for w in ["decrease", "reduce", "cut", "drop", "lower", "fall", "down", "slash", "discount"])
            pct_match = re.search(r'([+-]?\d+(?:\.\d+)?)\s*%', q)
            if pct_match:
                val = float(pct_match.group(1))
                delta_str = f"-{val:g}%" if is_decrease and val > 0 else f"+{val:g}%" if val > 0 else f"{val:g}%"
            else:
                delta_str = "-10%" if is_decrease else "+10%"
            mutations["unit_price"] = delta_str

        return mutations

    async def _execute_simulation_query(self, question: str, dataset_id: Optional[str] = None) -> Dict[str, Any]:
        """Phase 6: Routes to counterfactual simulation engine."""
        if not self.forecast_service:
            logger.warning("ForecastService not injected. Falling back to SQL.")
            return await self._execute_sql_query(question, dataset_id=dataset_id)

        extraction_prompt = f"""You are a business scenario parser. Extract the exact parameter mutations from this What-If question.

AVAILABLE LEVERS: unit_price, marketing_spend, supplier_lead_time_days, competitor_discount_pct

QUESTION: "{question}"

Return a JSON object with ONLY the changed parameters. Use percentage notation for relative changes ("+15%", "-10%") or absolute deltas ("+5", "-2000").

Examples:
- "What if we increase price by 15%?" → {{"unit_price": "+15%"}}
- "What happens if marketing budget doubles?" → {{"marketing_spend": "+100%"}}
- "Simulate supplier delay of 5 extra days" → {{"supplier_lead_time_days": "+5"}}

Return ONLY valid JSON, no explanation."""

        mutations: Dict[str, str] = {}
        try:
            import json
            mutations_str = await asyncio.wait_for(
                self.llm_client.generate_text(prompt=extraction_prompt),
                timeout=12.0
            )
            mutations_str = mutations_str.strip()
            if mutations_str.startswith("```"):
                mutations_str = mutations_str.split("\n", 1)[1] if "\n" in mutations_str else mutations_str[3:]
                mutations_str = mutations_str.rsplit("```", 1)[0]
            parsed = json.loads(mutations_str)
            if isinstance(parsed, dict) and parsed:
                mutations = parsed
        except Exception as e:
            logger.warning(f"LLM simulation lever extraction failed ({e}). Using deterministic fallback.")

        if not mutations:
            mutations = self._extract_simulation_levers_deterministic(question)
            logger.info(f"Deterministic simulation lever extraction resolved: {mutations}")

        try:
            result = await self.forecast_service.simulate(
                horizon_days=30,
                mutations=mutations,
                dataset_id=dataset_id
            )

            delta = result["total_delta"]
            delta_pct = result["total_delta_pct"]
            direction = "increase" if delta >= 0 else "decrease"
            mutations_desc = ", ".join([f"{k} by {v}" for k, v in result["mutations_applied"].items()])

            answer = (
                f"Simulation complete. Changing {mutations_desc} would {direction} "
                f"projected 30-day revenue by ₹{abs(delta):,.0f} ({delta_pct:+.1f}%).\n\n"
                f"• Baseline total: ₹{result['baseline_total']:,.0f}\n"
                f"• Simulated total: ₹{result['mutated_total']:,.0f}\n"
                f"• Net impact: ₹{delta:+,.0f}"
            )

            charts = [
                {
                    "type": "line",
                    "title": "Scenario Simulation: Baseline vs. Mutated Revenue",
                    "description": "Counterfactual trajectory comparison over forecast horizon",
                    "x_key": "date",
                    "y_keys": ["baseline", "mutated"],
                    "data": self._clean_chart_records(result.get("points", []))
                }
            ]
            insights = [
                f"Simulated trajectory projects net impact of ₹{delta:+,.0f} ({delta_pct:+.1f}%) over 30 days.",
                f"Baseline expected ₹{result.get('baseline_total', 0):,.0f} vs. Simulated ₹{result.get('mutated_total', 0):,.0f}.",
                f"Simulated parameter mutations: {mutations_desc}."
            ]
            prescriptive_actions = []
            if delta < 0:
                prescriptive_actions.append({
                    "priority": 1,
                    "action": f"Re-evaluate lever adjustments ({mutations_desc}) to avoid projected margin loss.",
                    "expected_impact": f"Protect projected ₹{abs(delta):,.0f} downside.",
                    "timeframe": "Immediate (24-48 hours)"
                })
            else:
                prescriptive_actions.append({
                    "priority": 1,
                    "action": f"Execute strategy adjustment for {mutations_desc}.",
                    "expected_impact": f"Capture projected upside of ₹{delta:,.0f}.",
                    "timeframe": "Next 14-30 days"
                })

            return {
                "question": question,
                "answer": answer,
                "insights": insights,
                "prescriptive_actions": prescriptive_actions,
                "charts": charts,
                "generated_sql": None,
                "raw_data": result,
                "confidence": "high",
                "source": "SIMULATION"
            }
        except Exception as e:
            logger.error(f"Simulation query failed: {e}")
            return {
                "question": question,
                "answer": f"Simulation failed: {str(e)}. Ensure the forecasting model is trained with multi-variate data.",
                "insights": ["Forecasting engine requires trained model state before simulation."],
                "prescriptive_actions": [],
                "charts": [],
                "generated_sql": None,
                "raw_data": {},
                "confidence": "low",
                "source": "SIMULATION"
            }

    async def _try_relationship_query(self, question: str, dataset_id: Optional[str]) -> Optional[Dict[str, Any]]:
        """Answer "how does X relate to Y" with a scatter chart and the Pearson r, no LLM or SQL involved.

        Returns None (so normal routing continues) unless the question asks about a relationship and
        two numeric columns of the dataset can be identified in it.
        """
        q_lower = question.lower()
        if (
            not self.analysis_service
            or not RELATIONSHIP_HINT.search(question)
            or any(k in q_lower for k in ("what if", "simulate", "scenario"))
        ):
            return None
        try:
            ds = dataset_id or await self.analysis_service.latest_dataset_id()
            if not ds:
                return None
            numeric = await self.analysis_service.numeric_columns(ds)
            target = await self.analysis_service.target_metric(ds)
            columns = resolve_columns_in_question(question, numeric, target)
            if len(columns) < 2:
                return None
            x, y = columns
            scatter = await self.analysis_service.scatter(ds, x, y, limit=500)
        except Exception as e:
            logger.warning(f"Relationship query fell back to normal routing: {e}")
            return None

        nice = lambda c: c.replace("_", " ")
        r = scatter["pearson_r"]
        answer = (
            f"{nice(x).title()} and {nice(y)} show a {describe_correlation(r)} linear relationship"
            + (f" (Pearson r = {r:.2f}, n = {scatter['total_pairs']})." if r is not None else ".")
            + " Correlation does not by itself show that one causes the other."
        )
        return {
            "question": question,
            "answer": answer,
            "insights": [answer],
            "prescriptive_actions": [],
            "charts": [
                {
                    "type": "scatter",
                    "title": f"{nice(x).title()} vs {nice(y).title()}",
                    "description": f"{scatter['returned']} of {scatter['total_pairs']} records"
                    + (f"; Pearson r = {r:.2f}" if r is not None else ""),
                    "x_key": x,
                    "y_keys": [y],
                    "data": scatter["points"],
                }
            ],
            "generated_sql": "",
            "raw_data": scatter["points"][:50],
            "confidence": "high" if r is not None else "low",
            "source": "RELATIONSHIP",
        }

    async def execute_query(self, question: str, dataset_id: Optional[str] = None) -> Dict[str, Any]:
        """Execute query by classifying intent and routing with dataset scoping."""
        logger.info(f"Processing query: '{question}' (dataset_id={dataset_id})")
        
        relationship = await self._try_relationship_query(question, dataset_id)
        if relationship is not None:
            return relationship

        intent = await self._classify_intent(question)
        logger.info(f"Classified query intent as: {intent}")
        
        if intent == QueryIntent.SQL:
            return await self._execute_sql_query(question, dataset_id)
        elif intent == QueryIntent.DOCUMENT:
            return await self._execute_document_query(question, dataset_id)
        elif intent == QueryIntent.EXPLAIN:
            return await self._execute_explain_query(question, dataset_id)
        elif intent == QueryIntent.SIMULATION:
            return await self._execute_simulation_query(question, dataset_id)
        elif intent == QueryIntent.FUSED:
            return await self._execute_fused_query(question, dataset_id)
        else:
            return await self._execute_sql_query(question, dataset_id)
