"""Prescriptive AI Service — Phase 6: SHAP + Anomaly + LLM Prescriptive Fusion."""

import json
import logging
from dataclasses import asdict
from typing import Any, Dict, List, Optional

from src.domain.interfaces.llm_client import LLMClient
from src.domain.interfaces.forecaster import Forecaster
from src.services.forecast_service import ForecastService
from src.services.shap_explainer_service import ShapExplainerService
from src.domain.exceptions import MlError, ForecastNotReadyError

logger = logging.getLogger(__name__)


class PrescriptiveService:
    """
    Orchestrates the unified Explain + Prescribe pipeline:
    1. Gets forecast from ForecastService
    2. Computes SHAP decomposition via ShapExplainerService
    3. Detects anomalies (>10% decline in 7-day rolling avg vs. trailing 30-day mean)
    4. Generates LLM-driven prescriptive actions
    5. Returns unified ExplainPrescribeResponse
    """

    ANOMALY_THRESHOLD_PCT = -10.0  # Trigger prescriptive if >10% projected decline

    def __init__(
        self,
        forecast_service: ForecastService,
        shap_service: ShapExplainerService,
        llm_client: LLMClient,
        forecaster: Forecaster,
    ):
        self.forecast_service = forecast_service
        self.shap_service = shap_service
        self.llm_client = llm_client
        self.forecaster = forecaster

    async def get_explain_prescribe(self, horizon_days: int = 30) -> Dict[str, Any]:
        """Generate the unified explain-prescribe payload."""

        # Step 1: Get forecast
        forecast_data = await self.forecast_service.get_forecast(horizon_days)
        forecast_points = forecast_data["forecast"]
        history = forecast_data["history"]

        if not forecast_points:
            raise MlError("No forecast data available.")

        # Step 2: SHAP decomposition for the first forecast date
        first_forecast_date = forecast_points[0]["date"]
        try:
            shap_data = await self.shap_service.get_explanation(
                "aggregate", first_forecast_date
            )
        except Exception as e:
            logger.warning(f"SHAP explanation unavailable: {e}")
            shap_data = {
                "top_positive_drivers": [],
                "top_negative_drivers": [],
                "explanation_text": "SHAP analysis unavailable.",
            }

        # Normalize SHAP drivers to dicts
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

        # Step 4: Generate prescriptive actions via LLM
        prescriptive_actions = []
        executive_summary = shap_data.get("explanation_text", "")

        if anomaly_detected or negative_drivers:
            prescriptive_actions = await self._generate_prescriptive_actions(
                forecast_points=forecast_points,
                positive_drivers=positive_drivers,
                negative_drivers=negative_drivers,
                anomaly_description=anomaly_description,
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
            "forecast_points": forecast_points,
            "shap_drivers": {
                "positive": positive_drivers,
                "negative": negative_drivers,
            },
            "anomaly_detected": anomaly_detected,
            "anomaly_description": anomaly_description,
            "prescriptive_actions": prescriptive_actions,
            "executive_summary": executive_summary or "No significant anomalies detected. Business metrics are within expected ranges.",
        }

    def _normalize_drivers(self, drivers: list) -> list[dict]:
        """Convert SHAP drivers to dicts if they are dataclass instances."""
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
    ) -> list[dict]:
        """Generate 3 prioritized prescriptive actions via LLM."""

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
            [f"  - {d['feature']}: +₹{abs(d['contribution']):,.0f} ({d['description']})" for d in positive_drivers]
        ) or "  None significant"

        neg_str = "\n".join(
            [f"  - {d['feature']}: -₹{abs(d['contribution']):,.0f} ({d['description']})" for d in negative_drivers]
        ) or "  None significant"

        price_str = f"₹{lever_values.get('unit_price', 0):,.0f}" if lever_values else "Unknown"
        marketing_str = f"₹{lever_values.get('marketing_spend', 0):,.0f}/day" if lever_values else "Unknown"
        lead_time_str = f"{lever_values.get('supplier_lead_time_days', 0):.0f} days" if lever_values else "Unknown"

        prompt = f"""You are a senior business strategist. Given this forecast analysis, generate exactly 3 prioritized, actionable steps.

FORECAST: Revenue projected to {direction} by {pct:.1f}% over next {len(forecast_points)} days.
{f"ANOMALY: {anomaly_description}" if anomaly_description else ""}

TOP POSITIVE DRIVERS:
{pos_str}

TOP NEGATIVE DRIVERS:
{neg_str}

CURRENT LEVER VALUES: Price={price_str}, Marketing={marketing_str}, Lead Time={lead_time_str}

RULES:
1. Each action must be concrete (name specific levers, numbers, timeframes).
2. Include expected ₹ impact in Indian numbering (Lakhs/Crores).
3. First action = highest urgency. Third = strategic/preventive.
4. Use ₹ with en-IN formatting. No technical jargon.
5. Return ONLY a valid JSON array: [{{"priority": 1, "action": "...", "expected_impact": "...", "timeframe": "..."}}]
"""

        try:
            response = await self.llm_client.generate_text(prompt=prompt)
            # Parse JSON from LLM response
            response = response.strip()
            # Handle markdown code blocks
            if response.startswith("```"):
                response = response.split("\n", 1)[1] if "\n" in response else response[3:]
                response = response.rsplit("```", 1)[0]
            actions = json.loads(response)
            if isinstance(actions, list):
                return actions[:3]
        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Failed to parse prescriptive actions from LLM: {e}")

        # Fallback prescriptive actions
        return [
            {
                "priority": 1,
                "action": "Review supply chain performance and activate backup suppliers if lead times exceed 5 days.",
                "expected_impact": "Recover potential lost revenue from stockouts.",
                "timeframe": "Immediate (24-48 hours)",
            },
            {
                "priority": 2,
                "action": "Increase targeted digital marketing spend by 20-30% during the projected dip period.",
                "expected_impact": "Offset volume decline through higher customer acquisition.",
                "timeframe": "This week",
            },
            {
                "priority": 3,
                "action": "Maintain current pricing to preserve customer retention during market uncertainty.",
                "expected_impact": "Prevent additional volume erosion from price sensitivity.",
                "timeframe": "Ongoing (2 weeks)",
            },
        ]

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
