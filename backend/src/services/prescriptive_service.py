"""Prescriptive AI Service — Phase 6: Factor Attribution + Anomaly + LLM Prescriptive Fusion."""

import asyncio
import json
import logging
from dataclasses import asdict
from typing import Any, Dict, List, Optional

from src.domain.interfaces.llm_client import LLMClient
from src.domain.interfaces.forecaster import Forecaster
from src.services.forecast_service import ForecastService
from src.services.shap_explainer_service import ShapExplainerService
from src.services.rag_service import RAGService
from src.domain.exceptions import MlError, ForecastNotReadyError

logger = logging.getLogger(__name__)


class PrescriptiveService:
    """
    Orchestrates the unified Explain + Prescribe pipeline:
    1. Gets forecast from ForecastService
    2. Computes factor attribution via ShapExplainerService
    3. Detects anomalies (>10% decline in 7-day rolling avg vs. trailing 30-day mean)
    4. Generates LLM-driven prescriptive actions
    5. Returns unified ExplainPrescribeResponse
    """

    ANOMALY_THRESHOLD_PCT = -10.0  # Trigger prescriptive if >10% projected decline
    ROOT_CAUSE_TIMEOUT_SECONDS = 3.0
    ROOT_CAUSE_DOCUMENTS = 3

    def __init__(
        self,
        forecast_service: ForecastService,
        shap_service: ShapExplainerService,
        llm_client: LLMClient,
        forecaster: Forecaster,
        rag_service: Optional[RAGService] = None,
    ):
        self.rag_service = rag_service
        self.forecast_service = forecast_service
        self.shap_service = shap_service
        self.llm_client = llm_client
        self.forecaster = forecaster

    async def get_explain_prescribe(self, horizon_days: int = 30, dataset_id: Optional[str] = None) -> Dict[str, Any]:
        """Generate the unified explain-prescribe payload for a given dataset."""

        # Step 1: Get forecast
        forecast_data = await self.forecast_service.get_forecast(horizon_days=horizon_days, dataset_id=dataset_id)
        forecast_points = forecast_data["forecast"]
        history = forecast_data["history"]

        if not forecast_points:
            raise MlError("No forecast data available.")

        # Step 2: Factor attribution for the first forecast date
        first_forecast_date = forecast_points[0]["date"]
        try:
            shap_data = await self.shap_service.get_explanation(
                "aggregate", first_forecast_date, dataset_id=dataset_id
            )
        except Exception as e:
            logger.warning(f"Factor attribution unavailable: {e}")
            shap_data = {
                "top_positive_drivers": [],
                "top_negative_drivers": [],
                "explanation_text": "Factor attribution unavailable.",
            }

        # Normalize attribution drivers to dicts
        positive_drivers = self._normalize_drivers(
            shap_data.get("top_positive_drivers", [])
        )
        negative_drivers = self._normalize_drivers(
            shap_data.get("top_negative_drivers", [])
        )

        # Step 3: Anomaly detection
        anomaly_detected, anomaly_description = self._detect_anomaly(
            history, forecast_points
        )

        # Step 3b: root-cause notes for the anomaly (attribution + related documents)
        anomaly_root_cause = None
        if anomaly_detected:
            anomaly_root_cause = await self._build_root_cause(forecast_points, anomaly_description, dataset_id)

        # Step 4: Generate prescriptive actions via LLM
        prescriptive_actions = []
        executive_summary = shap_data.get("explanation_text", "")

        if anomaly_detected or negative_drivers:
            prescriptive_actions = await self._generate_prescriptive_actions(
                forecast_points=forecast_points,
                positive_drivers=positive_drivers,
                negative_drivers=negative_drivers,
                anomaly_description=anomaly_description,
                dataset_id=dataset_id,
            )

            executive_summary = await self._generate_executive_summary(
                forecast_points=forecast_points,
                positive_drivers=positive_drivers,
                negative_drivers=negative_drivers,
                anomaly_detected=anomaly_detected,
                anomaly_description=anomaly_description,
                prescriptive_actions=prescriptive_actions,
            )

        return {
            "dataset_id": dataset_id,
            "forecast_points": forecast_points,
            "shap_drivers": {
                "positive": positive_drivers,
                "negative": negative_drivers,
            },
            "anomaly_detected": anomaly_detected,
            "anomaly_description": anomaly_description,
            "anomaly_root_cause": anomaly_root_cause,
            "prescriptive_actions": prescriptive_actions,
            "executive_summary": executive_summary or "No significant anomalies detected. Business metrics are within expected ranges.",
        }

    async def _build_root_cause(
        self,
        forecast_points: list[dict],
        anomaly_description: Optional[str],
        dataset_id: Optional[str],
    ) -> dict[str, Any]:
        """Likely drivers and related documents for an anomaly; every item is something actually returned.

        Drivers come from the factor attribution for the anomaly window's lowest forecast day, documents
        from a semantic search seeded with the anomaly and its negative drivers. The LLM may phrase a
        summary but must cite only those items; otherwise a deterministic listing is returned instead.
        """
        window = forecast_points[:7]
        trough = min(window, key=lambda p: p["predicted"]) if window else forecast_points[0]
        trough_date = trough["date"]

        drivers: list[dict[str, Any]] = []
        method: Optional[str] = None
        try:
            attribution = await self.shap_service.get_explanation("aggregate", trough_date, dataset_id=dataset_id)
            method = attribution.get("method")
            for direction, key in (("negative", "top_negative_drivers"), ("positive", "top_positive_drivers")):
                for d in self._normalize_drivers(attribution.get(key, [])):
                    drivers.append(
                        {
                            "feature": d["feature"],
                            "contribution": d["contribution"],
                            "description": d.get("description", ""),
                            "direction": direction,
                        }
                    )
        except Exception as e:
            logger.warning(f"Root-cause attribution unavailable: {e}")

        documents: list[dict[str, Any]] = []
        if self.rag_service is not None:
            negative = [d["feature"].replace("_", " ") for d in drivers if d["direction"] == "negative"]
            query = " ".join([anomaly_description or "projected decline in demand", *negative, "risks delays issues"])
            try:
                found = await self.rag_service.search_documents(query, top_k=self.ROOT_CAUSE_DOCUMENTS)
                for r in found.results:
                    documents.append(
                        {
                            "document_id": r.document_id,
                            "document_title": r.metadata.get("filename", "Unknown"),
                            "text_snippet": r.text[:200],
                            "relevance_score": r.score,
                        }
                    )
            except Exception as e:
                logger.warning(f"Root-cause document search failed: {e}")

        summary, source = await self._root_cause_summary(anomaly_description, drivers, documents)
        return {
            "attribution_date": trough_date,
            "method": method,
            "drivers": drivers,
            "documents": documents,
            "summary": summary,
            "summary_source": source,
        }

    @staticmethod
    def _deterministic_root_cause(drivers: list[dict], documents: list[dict]) -> str:
        parts = []
        if drivers:
            parts.append("Likely drivers: " + ", ".join(f"{d['feature']} ({d['contribution']:+.1f}%)" for d in drivers) + ".")
        if documents:
            parts.append("Related documents: " + ", ".join(d["document_title"] for d in documents) + ".")
        return " ".join(parts) or "No drivers or related documents were found for this anomaly."

    async def _root_cause_summary(
        self, anomaly_description: Optional[str], drivers: list[dict], documents: list[dict]
    ) -> tuple[str, str]:
        fallback = self._deterministic_root_cause(drivers, documents)
        if not drivers and not documents:
            return fallback, "deterministic"

        driver_lines = "\n".join(f"- {d['feature']} ({d['contribution']:+.1f}% of forecast): {d['description']}" for d in drivers) or "- none"
        doc_lines = "\n".join(f"- {d['document_title']}: {d['text_snippet']}" for d in documents) or "- none"
        prompt = f"""Explain in 2 sentences what likely caused this forecast anomaly. Use ONLY the drivers and documents listed; do not mention anything else.

ANOMALY: {anomaly_description or "projected decline"}

DRIVERS:
{driver_lines}

DOCUMENTS:
{doc_lines}

Return ONLY JSON: {{"summary": "...", "cited_drivers": ["<driver name from the list>"], "cited_documents": ["<document title from the list>"]}}"""
        try:
            raw = await asyncio.wait_for(self.llm_client.generate_text(prompt=prompt), timeout=self.ROOT_CAUSE_TIMEOUT_SECONDS)
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
                raw = raw.rsplit("```", 1)[0]
            payload = json.loads(raw)
            cited_drivers = payload.get("cited_drivers", [])
            cited_documents = payload.get("cited_documents", [])
            text = payload.get("summary")
            allowed_drivers = {d["feature"] for d in drivers}
            allowed_documents = {d["document_title"] for d in documents}
            if (
                isinstance(text, str)
                and text.strip()
                and isinstance(cited_drivers, list)
                and isinstance(cited_documents, list)
                and set(cited_drivers) <= allowed_drivers
                and set(cited_documents) <= allowed_documents
            ):
                return text.strip(), "llm"
            logger.warning("Root-cause summary cited items that were not returned; using the deterministic listing.")
        except Exception as e:
            logger.warning(f"Root-cause summary LLM failed/timed out ({e}); using the deterministic listing.")
        return fallback, "deterministic"

    def _normalize_drivers(self, drivers: list) -> list[dict]:
        """Convert attribution drivers to dicts if they are dataclass instances."""
        normalized = []
        for d in drivers:
            if isinstance(d, dict):
                normalized.append(d)
            elif hasattr(d, "__dict__"):
                normalized.append(asdict(d) if hasattr(d, "__dataclass_fields__") else d.__dict__)
            else:
                normalized.append(d)
        return normalized

    def _detect_anomaly(
        self,
        history: list[dict],
        forecast_points: list[dict],
    ) -> tuple[bool, Optional[str]]:
        """
        Detect anomaly: compare 7-day forecast rolling average against
        the trailing 30-day historical mean. Trigger if decline > threshold.
        """
        if len(history) < 7 or len(forecast_points) < 7:
            return False, None

        # Trailing 30-day historical mean
        recent_history = history[-30:]
        hist_values = [h.get("actual", h.get("revenue", 0)) for h in recent_history]
        hist_mean = sum(hist_values) / len(hist_values) if hist_values else 0

        if hist_mean <= 0:
            return False, None

        # 7-day forecast mean
        forecast_7d = forecast_points[:7]
        forecast_values = [f["predicted"] for f in forecast_7d]
        forecast_mean = sum(forecast_values) / len(forecast_values)

        # Calculate percentage change
        pct_change = ((forecast_mean - hist_mean) / hist_mean) * 100

        if pct_change <= self.ANOMALY_THRESHOLD_PCT:
            description = (
                f"Revenue is projected to decline {abs(pct_change):.1f}% over the next 7 days "
                f"(₹{forecast_mean:,.0f}/day avg vs. trailing 30-day avg of ₹{hist_mean:,.0f}/day)."
            )
            return True, description

        return False, None

    async def _generate_prescriptive_actions(
        self,
        forecast_points: list[dict],
        positive_drivers: list[dict],
        negative_drivers: list[dict],
        anomaly_description: Optional[str],
        dataset_id: Optional[str] = None,
    ) -> list[dict]:
        """Generate 3 prioritized prescriptive actions with quantified financial impact and timeframe tags."""

        # Get current lever values from forecaster
        lever_values = {}
        if hasattr(self.forecaster, '_last_regressor_values'):
            lever_values = self.forecaster._last_regressor_values

        # Calculate forecast direction
        if len(forecast_points) >= 7:
            first_7d = sum(f["predicted"] for f in forecast_points[:7]) / 7
            last_7d = sum(f["predicted"] for f in forecast_points[-7:]) / 7
            direction = "decline" if last_7d < first_7d else "grow"
            pct = abs((last_7d - first_7d) / first_7d * 100) if first_7d > 0 else 0
        else:
            direction = "remain stable"
            pct = 0

        pos_str = "\n".join(
            [f"  - {d['feature']}: +{abs(d['contribution']):.1f}% of the forecast ({d['description']})" for d in positive_drivers]
        ) or "  None significant"

        neg_str = "\n".join(
            [f"  - {d['feature']}: -{abs(d['contribution']):.1f}% of the forecast ({d['description']})" for d in negative_drivers]
        ) or "  None significant"

        price_str = f"₹{lever_values.get('unit_price', 0):,.0f}" if lever_values else "Unknown"
        marketing_str = f"₹{lever_values.get('marketing_spend', 0):,.0f}/day" if lever_values else "Unknown"
        lead_time_str = f"{lever_values.get('supplier_lead_time_days', 0):.0f} days" if lever_values else "Unknown"

        prompt = f"""You are a senior business strategist and ML economist. Given this forecast analysis, generate exactly 3 prioritized, highly actionable recommendations.

FORECAST: Revenue projected to {direction} by {pct:.1f}% over next {len(forecast_points)} days.
{f"ANOMALY: {anomaly_description}" if anomaly_description else ""}

TOP POSITIVE DRIVERS:
{pos_str}

TOP NEGATIVE DRIVERS:
{neg_str}

CURRENT LEVER VALUES: Price={price_str}, Marketing={marketing_str}, Lead Time={lead_time_str}

CRITICAL RULES:
1. Each action must be concrete, referencing exact operational levers, numerical targets, and timeframes.
2. Quantify financial impact in INR (₹) and specify exact timeframe tags: 'immediate' (24-48h), 'short_term' (1-2 weeks), 'medium_term' (30-60 days).
3. First action = highest urgency. Third = strategic/preventive.
4. Return ONLY valid JSON array of objects with schema:
[
  {{
    "priority": 1,
    "action": "Concrete operational action statement",
    "expected_impact": "₹3.5 Lakhs revenue protection",
    "financial_impact": {{
      "amount": 350000,
      "currency": "INR",
      "metric": "revenue"
    }},
    "timeframe": "Immediate (24-48 hours)",
    "timeframe_tag": "immediate",
    "confidence": 0.90,
    "rationale": "Why this action mitigates the identified negative driver"
  }}
]
"""

        try:
            response = await self.llm_client.generate_text(prompt=prompt)
            response = response.strip()
            if response.startswith("```"):
                response = response.split("\n", 1)[1] if "\n" in response else response[3:]
                response = response.rsplit("```", 1)[0]
            actions = json.loads(response)
            if isinstance(actions, list) and actions:
                # Sanitize and ensure structured fields exist
                sanitized = []
                for idx, a in enumerate(actions[:3], start=1):
                    timeframe = a.get("timeframe", "Short-term (1-2 weeks)")
                    tf_lower = timeframe.lower()
                    tag = a.get("timeframe_tag") or ("immediate" if "immediate" in tf_lower or "24" in tf_lower or "48" in tf_lower else "short_term" if "week" in tf_lower else "medium_term")
                    # Do not invent a financial figure the LLM did not provide.
                    fin = a.get("financial_impact") or {
                        "amount": None,
                        "currency": "INR",
                        "metric": "revenue",
                    }
                    sanitized.append({
                        "priority": a.get("priority", idx),
                        "action": a.get("action", "Execute operational adjustment"),
                        "expected_impact": a.get("expected_impact", "Positive ROI impact"),
                        "financial_impact": fin,
                        "timeframe": timeframe,
                        "timeframe_tag": tag,
                        "confidence": a.get("confidence", 0.85),
                        "rationale": a.get("rationale", "Mitigates forecast downside based on factor attribution.")
                    })
                return sanitized
        except Exception as e:
            # Do NOT fabricate actions. Report the failure and fall through to
            # an empty list so the UI can show an explicit "unavailable" state
            # instead of hardcoded advice presented as analysis.
            logger.warning(
                "Prescriptive actions unavailable: LLM generation failed (%s: %s). "
                "Returning no actions rather than fabricated fallbacks.",
                type(e).__name__, e,
            )

        # Reached when the LLM was unavailable, returned unparseable output, or
        # produced no actionable items.
        return []

    async def _generate_executive_summary(
        self,
        forecast_points: list[dict],
        positive_drivers: list[dict],
        negative_drivers: list[dict],
        anomaly_detected: bool,
        anomaly_description: Optional[str],
        prescriptive_actions: list[dict],
    ) -> str:
        """Generate a concise executive summary combining all insights."""

        actions_str = "\n".join(
            [f"  {a['priority']}. {a['action']} ({a['timeframe']})" for a in prescriptive_actions]
        )

        pos_str = ", ".join([d["feature"].replace("_", " ") for d in positive_drivers]) or "None"
        neg_str = ", ".join([d["feature"].replace("_", " ") for d in negative_drivers]) or "None"

        prompt = f"""Write a 3-sentence executive summary for a business owner. Be direct, no jargon.

{"⚠️ ANOMALY DETECTED: " + anomaly_description if anomaly_detected else "✅ No critical anomalies detected."}
Positive factors: {pos_str}
Negative factors: {neg_str}
Recommended actions:
{actions_str}

RULES:
- Use emoji: 📈 📉 ⚠️ ✅
- Use ₹ with Indian numbering.
- Maximum 3 sentences.
- Start with the most important insight.
"""

        try:
            return await self.llm_client.generate_text(prompt=prompt)
        except Exception as e:
            logger.error(f"Failed to generate executive summary: {e}")
            if anomaly_detected:
                return f"⚠️ {anomaly_description} Immediate action recommended."
            return "✅ Business metrics are within expected ranges. No immediate action required."
