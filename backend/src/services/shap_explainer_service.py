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

ATTRIBUTION_METHOD = "prophet_component_decomposition"
ATTRIBUTION_NOTE = (
    "Contributions are each forecast component's share of the predicted value. "
    "With multiplicative seasonality the percentages are approximate."
)

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
        # Check cache
        cached = await self._get_cached_explanation(product_id, forecast_date)
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
                future = model.make_future_dataframe(periods=periods, freq='D')
                if hasattr(self.forecaster, '_regressor_cols') and self.forecaster._regressor_cols:
                    for col in self.forecaster._regressor_cols:
                        future[col] = self.forecaster._last_regressor_values.get(col, 0.0)
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
            product_name=product_name
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
        response_dict["method"] = ATTRIBUTION_METHOD
        response_dict["method_note"] = ATTRIBUTION_NOTE
        response_dict["base_value"] = explanation.predicted_value
        all_drivers = explanation.top_positive_drivers + explanation.top_negative_drivers
        response_dict["forces"] = [
            {"feature_name": d.feature, "contribution": d.contribution, "description": d.description}
            for d in all_drivers
        ]

        # 5. Cache
        await self._cache_explanation(explanation, model_id)

        return response_dict

    async def _translate_to_natural_language(self, explanation: ShapExplanationResult) -> str:
        pos_drivers = "\n".join([f"- {d.feature} +{d.contribution}: {d.description}" for d in explanation.top_positive_drivers])
        neg_drivers = "\n".join([f"- {d.feature} {d.contribution}: {d.description}" for d in explanation.top_negative_drivers])
        
        prompt = f"""
You are a business analytics expert. Translate these forecast feature contributions into executive bullet points.

FORECAST DATE: {explanation.forecast_date}
PREDICTED VALUE: ₹{explanation.predicted_value}

FACTORS PUSHING SALES UP:
{pos_drivers}

FACTORS PUSHING SALES DOWN:
{neg_drivers}

RULES:
1. Write 3-5 bullet points maximum.
2. No technical jargon — no "seasonality coefficient", "trend component".
3. Translation examples:
   - "weekly +0.15" → "Sales tend to be higher on this day of the week."
   - "yearly -0.08" → "This time of year typically sees a seasonal dip."
   - "trend +0.22" → "Your overall business is on an upward trajectory."
4. Use ₹ with Indian numbering. Start bullets with emoji: 📈 (positive), 📉 (negative), ⚠️ (warning).
5. Be actionable — suggest what the owner should do.
6. Do NOT mention SHAP, Prophet, or ML terminology.

EXECUTIVE SUMMARY:
"""
        try:
            return await asyncio.wait_for(
                self.llm_client.generate_text(prompt=prompt),
                timeout=3.0
            )
        except Exception as e:
            logger.warning(f"LLM generate_text failed/timed out ({e}). Using fallback natural language translation.")
            pos_str = ", ".join([f"{d.feature} (+{d.contribution}%)" for d in explanation.top_positive_drivers]) or "None"
            neg_str = ", ".join([f"{d.feature} ({d.contribution}%)" for d in explanation.top_negative_drivers]) or "None"
            return f"📈 Positive Drivers: {pos_str}\n📉 Negative Drivers: {neg_str}"

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

    async def _get_cached_explanation(self, product_id: str, forecast_date: str) -> Optional[dict]:
        async with self.uow as uow:
            rows = await uow.repository.execute_readonly_sql(
                text("SELECT * FROM shap_cache WHERE product_id = :pid AND forecast_date = :fd LIMIT 1"),
                {"pid": product_id, "fd": forecast_date},
            )
            if not rows:
                return None
                
            row = rows[0]
            
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
                "predicted_value": 0.0,
                "base_value": 0.0,
                "top_positive_drivers": pos,
                "top_negative_drivers": neg,
                "forces": forces,
                "explanation_text": row["explanation_text"],
                "model_id": row["model_id"],
                "method": ATTRIBUTION_METHOD,
                "method_note": ATTRIBUTION_NOTE,
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
                    text("INSERT INTO shap_cache (id, product_id, product_name, model_id, forecast_date, top_positive_drivers, top_negative_drivers, explanation_text, computed_at) VALUES (:id, :pid, :pname, :mid, :fd, :pos, :neg, :txt, :cat)"),
                    {"id": cache_id, "pid": explanation.product_id, "pname": explanation.product_name, "mid": model_id, "fd": explanation.forecast_date, "pos": pos_json, "neg": neg_json, "txt": explanation.explanation_text, "cat": now}
                )
                await uow.commit()
            except Exception as e:
                logger.error(f"Failed to cache factor-attribution explanation: {e}")
