"""Factor-attribution explainer service."""

import logging
import json
from dataclasses import asdict
from typing import Any, Dict, List, Optional
import asyncio
from sqlalchemy import text

from src.domain.interfaces.uow import UnitOfWork
from src.domain.interfaces.explainer_engine import ExplainerEngine
from src.domain.interfaces.llm_client import LLMClient
from src.services.rag_service import RAGService
from src.domain.entities.shap_explanation import ShapExplanationResult, ShapDriver
from src.domain.exceptions import ForecastNotReadyError

from src.domain.interfaces.forecaster import Forecaster

logger = logging.getLogger(__name__)

from src.infrastructure.ml.shap_engine import CURRENT_NOTES, METHOD_DECOMPOSITION as ATTRIBUTION_METHOD, NOTE_DECOMPOSITION as ATTRIBUTION_NOTE

def _inr(value: Optional[float], signed: bool = False) -> str:
    """Indian-style compact rupees: ₹3.6 L, ₹1.2 Cr, ₹48,500."""
    if value is None:
        return "n/a"
    sign = ("+" if value >= 0 else "−") if signed else ("−" if value < 0 else "")
    v = abs(value)
    if v >= 1e7:
        body = f"₹{v / 1e7:.2f} Cr"
    elif v >= 1e5:
        body = f"₹{v / 1e5:.2f} L"
    else:
        body = f"₹{v:,.0f}"
    return sign + body


class ShapExplainerService:
    def __init__(
        self,
        uow: UnitOfWork,
        explainer_engine: ExplainerEngine,
        llm_client: LLMClient,
        rag_service: RAGService,
        forecaster: Forecaster = None
    ):
        self.uow = uow
        self.explainer_engine = explainer_engine
        self.llm_client = llm_client
        self.rag_service = rag_service
        self.forecaster = forecaster

    async def get_explanation(self, product_id: str, forecast_date: str, dataset_id: Optional[str] = None) -> dict:
        # A cached explanation is only valid for the model that produced it, so key on the current model.
        current_model_id = None
        if self.forecaster is not None:
            info = self.forecaster.get_latest_model_info(dataset_id=dataset_id)
            candidate = info.get("model_id") if isinstance(info, dict) else None
            current_model_id = candidate if isinstance(candidate, str) else None
        cached = await self._get_cached_explanation(product_id, forecast_date, current_model_id)
        if cached:
            logger.info(f"Returning cached factor-attribution explanation for {product_id} on {forecast_date}")
            return cached

        # Not in cache, compute it
        async with self.uow as uow:
            if product_id == "aggregate":
                product_name = "Aggregate"
            else:
                try:
                    product = await uow.repository.execute_readonly_sql(
                        text("SELECT id, name FROM products WHERE CAST(id AS TEXT) = :pid"),
                        {"pid": product_id},
                    )
                    product_name = product[0]["name"] if product else product_id
                except Exception:
                    product_name = product_id

            logger.info(f"Loading forecast model for {product_id} (dataset_id={dataset_id})")
            if not self.forecaster or not await self.forecaster.is_trained(dataset_id=dataset_id):
                raise ForecastNotReadyError(f"Model not trained for {product_id}")
                
            model = getattr(self.forecaster, "model", None)
            if not model:
                raise ForecastNotReadyError(f"Model internal instance not found for {product_id}")
                
            try:
                import pandas as pd
                target_dt = pd.to_datetime(forecast_date)
                history_end = model.history['ds'].max()
                days_diff = (target_dt - history_end).days
                periods = max(30, days_diff + 5) if days_diff > 0 else 30
                # Same projected lever values as the forecast chart, so both show the same number.
                future = self.forecaster.future_frame(periods)
                df = model.predict(future)
                latest_info = self.forecaster.get_latest_model_info(dataset_id=dataset_id) or {}
                model_id = latest_info.get("model_id", "unknown")
            except Exception as e:
                raise ForecastNotReadyError(f"Failed to generate forecast df for {product_id}: {e}")

        # 2. Compute decomposition
        explanation: ShapExplanationResult = await self.explainer_engine.compute_explanation(
            model=model,
            forecast_df=df,
            target_date=forecast_date,
            product_id=product_id,
            product_name=product_name,
            inputs=future,
        )

        # 3. RAG fusion for negative drivers
        negative_context = await self._search_negative_driver_context(explanation.top_negative_drivers)
        
        # 4. LLM translate
        explanation_text = await self._translate_to_natural_language(explanation)
        explanation.explanation_text = explanation_text
        
        # Add document context for the response
        response_dict = asdict(explanation)
        response_dict["document_context"] = negative_context
        response_dict["model_id"] = model_id
        response_dict["method"] = explanation.method
        response_dict["method_note"] = explanation.method_note
        response_dict["base_value"] = (
            explanation.base_value if explanation.base_value is not None else explanation.predicted_value
        )
        all_drivers = explanation.top_positive_drivers + explanation.top_negative_drivers
        response_dict["forces"] = [
            {"feature_name": d.feature, "contribution": d.contribution, "description": d.description}
            for d in all_drivers
        ]

        # 5. Cache
        await self._cache_explanation(explanation, model_id)

        return response_dict

    @staticmethod
    def _driver_line(d: ShapDriver) -> str:
        line = f"- {d.description}: {_inr(d.contribution, signed=True)}"
        if d.value is not None and d.typical is not None:
            line += f" (now {d.value:,.2f}, usual level {d.typical:,.2f})"
        return line

    @staticmethod
    def _fallback_line(d: ShapDriver) -> str:
        amount = f"adds {_inr(d.contribution)}" if d.contribution > 0 else f"takes off {_inr(abs(d.contribution))}"
        emoji = "📈" if d.contribution > 0 else "📉"
        if d.value is not None and d.typical is not None and abs(d.value - d.typical) > 1e-9:
            side = "above" if d.value > d.typical else "below"
            return f"- {emoji} {d.description} is {side} its usual level ({d.value:,.2f} vs {d.typical:,.2f}), which {amount}"
        return f"- {emoji} {d.description} {amount}"

    async def _translate_to_natural_language(self, explanation: ShapExplanationResult) -> str:
        pos_drivers = "\n".join(self._driver_line(d) for d in explanation.top_positive_drivers) or "- none"
        neg_drivers = "\n".join(self._driver_line(d) for d in explanation.top_negative_drivers) or "- none"

        prompt = f"""
You are a business analytics expert. Explain what drives this day's sales forecast to a business owner.

FORECAST DATE: {explanation.forecast_date}
FORECAST: {_inr(explanation.predicted_value)}
UNDERLYING TREND LEVEL (before the factors below): {_inr(explanation.base_value)}

FACTORS PUSHING SALES UP (amount added to the trend level):
{pos_drivers}

FACTORS PULLING SALES DOWN (amount taken off the trend level):
{neg_drivers}

RULES:
1. Write 3-4 short bullet points, one per line. Start each with "- " then one emoji (📈 for up, 📉 for down, ⚠️ for a warning) and the sentence. Plain text only: no bold, no markdown, no labels like "up:".
2. Use the ₹ amounts given; do not invent numbers or percentages.
3. No technical jargon: no "seasonality", "trend component", "regressor", "model", "SHAP", "Prophet".
4. Levers (lines with "now" and "usual level") are measured against their usual level: a lever below its usual
   level can pull sales down even though more of it helps. Say it that way, e.g. "Ad spend is a little below its
   usual level, costing about ₹4,376", never "ad spend hurts sales".
5. Give one practical suggestion where it fits.
"""
        try:
            return await asyncio.wait_for(
                self.llm_client.generate_text(prompt=prompt),
                timeout=3.0
            )
        except Exception as e:
            logger.warning(f"LLM generate_text failed/timed out ({e}). Using fallback natural language translation.")
            lines = [self._fallback_line(d) for d in explanation.top_positive_drivers + explanation.top_negative_drivers]
            return "\n".join(lines) or "No single factor stands out for this day."

    async def _search_negative_driver_context(self, drivers: List[ShapDriver]) -> Optional[List[Dict[str, Any]]]:
        if not drivers:
            return []
            
        search_query = " ".join([d.feature for d in drivers]) + " risks issues delays problems"
        try:
            response = await self.rag_service.search_documents(query=search_query, top_k=3)
            return [
                {
                    "document_title": r.metadata.get("filename", "Unknown"),
                    "text_snippet": r.text[:200] + "...",
                    "relevance_score": r.score
                }
                for r in response.results
            ]
        except Exception as e:
            logger.error(f"Failed to search RAG context for negative drivers: {e}")
            return []

    async def _get_cached_explanation(
        self, product_id: str, forecast_date: str, model_id: Optional[str] = None
    ) -> Optional[dict]:
        sql = "SELECT * FROM shap_cache WHERE product_id = :pid AND forecast_date = :fd"
        params: Dict[str, Any] = {"pid": product_id, "fd": forecast_date}
        if model_id:
            sql += " AND model_id = :mid"
            params["mid"] = model_id
        # Rows cached before contributions were reported in ₹ carry an older note; recompute those.
        sql += " AND method_note IN (" + ", ".join(f":note{i}" for i in range(len(CURRENT_NOTES))) + ")"
        params.update({f"note{i}": note for i, note in enumerate(CURRENT_NOTES)})
        async with self.uow as uow:
            rows = await uow.repository.execute_readonly_sql(
                text(sql + " ORDER BY computed_at DESC LIMIT 1"), params
            )
            if not rows:
                return None
                
            row = rows[0]
            if row.get("predicted_value") is None:
                return None  # cached before values were stored; recompute rather than report zeros
            
            # The database might return dict objects for json columns if using asyncpg jsonb, 
            # or strings if sqlite. We handle both.
            pos = row["top_positive_drivers"] if isinstance(row["top_positive_drivers"], list) else json.loads(row["top_positive_drivers"])
            neg = row["top_negative_drivers"] if isinstance(row["top_negative_drivers"], list) else json.loads(row["top_negative_drivers"])
            
            pos_drivers = pos if isinstance(pos, list) else []
            neg_drivers = neg if isinstance(neg, list) else []
            all_drivers = pos_drivers + neg_drivers
            forces = [
                {"feature_name": d.get("feature", d.get("feature_name", "")), "contribution": d.get("contribution", 0.0), "description": d.get("description", "")}
                for d in all_drivers if isinstance(d, dict)
            ]
            return {
                "product_id": row["product_id"],
                "forecast_date": row["forecast_date"],
                "predicted_value": row["predicted_value"],
                "base_value": row["base_value"] if row.get("base_value") is not None else row["predicted_value"],
                "top_positive_drivers": pos,
                "top_negative_drivers": neg,
                "forces": forces,
                "explanation_text": row["explanation_text"],
                "model_id": row["model_id"],
                "method": row.get("method") or ATTRIBUTION_METHOD,
                "method_note": row.get("method_note") or ATTRIBUTION_NOTE,
                "document_context": []
            }

    async def _cache_explanation(self, explanation: ShapExplanationResult, model_id: str) -> None:
        async with self.uow as uow:
            import uuid
            cache_id = str(uuid.uuid4())
            pos_json = json.dumps([asdict(d) for d in explanation.top_positive_drivers])
            neg_json = json.dumps([asdict(d) for d in explanation.top_negative_drivers])
            
            try:
                from datetime import datetime, timezone
                now = datetime.now(timezone.utc)
                await uow._session.execute(
                    text("INSERT INTO shap_cache (id, product_id, product_name, model_id, forecast_date, top_positive_drivers, top_negative_drivers, explanation_text, method, method_note, predicted_value, base_value, computed_at) VALUES (:id, :pid, :pname, :mid, :fd, :pos, :neg, :txt, :method, :note, :pv, :bv, :cat)"),
                    {"id": cache_id, "pid": explanation.product_id, "pname": explanation.product_name, "mid": model_id, "fd": explanation.forecast_date, "pos": pos_json, "neg": neg_json, "txt": explanation.explanation_text, "method": explanation.method, "note": explanation.method_note, "pv": explanation.predicted_value, "bv": explanation.base_value if explanation.base_value is not None else explanation.predicted_value, "cat": now}
                )
                await uow.commit()
            except Exception as e:
                logger.error(f"Failed to cache factor-attribution explanation: {e}")
