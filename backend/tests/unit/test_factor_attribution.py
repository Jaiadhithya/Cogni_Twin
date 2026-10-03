"""Attribution output must say what it is: a Prophet component decomposition."""

from unittest.mock import AsyncMock, MagicMock

import pandas as pd
import pytest

from src.infrastructure.ml.shap_engine import ShapEngine
from src.services.shap_explainer_service import ShapExplainerService, ATTRIBUTION_METHOD
from src.api.schemas.explain import ShapExplanationResponse


def _forecast_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "ds": pd.to_datetime(["2026-12-01", "2026-12-02"]),
            "yhat": [100.0, 110.0],
            "trend": [90.0, 91.0],
            "weekly": [12.0, 20.0],
            "marketing_spend": [-2.0, -1.0],
        }
    )


def _service() -> ShapExplainerService:
    uow = MagicMock()
    uow.__aenter__ = AsyncMock(return_value=uow)
    uow.__aexit__ = AsyncMock(return_value=None)
    uow.repository.execute_readonly_sql = AsyncMock(return_value=[])
    uow.commit = AsyncMock()
    uow._session.execute = AsyncMock()

    model = MagicMock()
    model.history = pd.DataFrame({"ds": pd.to_datetime(["2026-11-30"])})
    model.make_future_dataframe.return_value = pd.DataFrame({"ds": pd.to_datetime(["2026-12-01"])})
    model.predict.return_value = _forecast_df()

    forecaster = MagicMock()
    forecaster.is_trained = AsyncMock(return_value=True)
    forecaster.model = model
    forecaster._regressor_cols = []
    forecaster.get_latest_model_info.return_value = {"model_id": "m-1"}

    llm = MagicMock()
    llm.generate_text = AsyncMock(side_effect=RuntimeError("llm down"))  # forces the deterministic fallback

    rag = MagicMock()
    rag.search_documents = AsyncMock(return_value=MagicMock(results=[]))
    return ShapExplainerService(uow=uow, explainer_engine=ShapEngine(), llm_client=llm, rag_service=rag, forecaster=forecaster)


@pytest.mark.asyncio
async def test_explanation_declares_method_and_validates_against_schema():
    result = await _service().get_explanation("aggregate", "2026-12-01")

    assert result["method"] == ATTRIBUTION_METHOD == "prophet_component_decomposition"
    assert "approximate" in result["method_note"]
    assert ShapExplanationResponse(**result).method == "prophet_component_decomposition"


@pytest.mark.asyncio
async def test_human_readable_text_never_claims_shap():
    result = await _service().get_explanation("aggregate", "2026-12-01")

    visible = " ".join(
        [result["explanation_text"], result["method_note"]]
        + [d["description"] for d in result["top_positive_drivers"] + result["top_negative_drivers"]]
    ).lower()
    assert "shap" not in visible and "shapley" not in visible
