"""Unit tests for SHAP explainer service SQL parameterization."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from sqlalchemy import text
from sqlalchemy.sql.elements import TextClause

from src.services.shap_explainer_service import ShapExplainerService
from src.domain.exceptions import ForecastNotReadyError


@pytest.fixture
def mock_uow():
    uow = MagicMock()
    uow.__aenter__ = AsyncMock(return_value=uow)
    uow.__aexit__ = AsyncMock(return_value=None)
    uow.commit = AsyncMock()
    uow.rollback = AsyncMock()
    uow.repository.execute_readonly_sql = AsyncMock(return_value=[])
    return uow


@pytest.fixture
def shap_service(mock_uow):
    forecaster = MagicMock()
    forecaster.is_trained = AsyncMock(return_value=False)
    return ShapExplainerService(
        uow=mock_uow,
        explainer_engine=MagicMock(),
        llm_client=MagicMock(),
        rag_service=MagicMock(),
        forecaster=forecaster,
    )


def _extract_call(execute_mock, index=0):
    call = execute_mock.call_args_list[index]
    statement = call.args[0]
    params = call.args[1] if len(call.args) > 1 else call.kwargs.get("params")
    return statement, params


@pytest.mark.asyncio
async def test_product_lookup_uses_bound_parameters(shap_service, mock_uow):
    malicious_id = "abc' OR '1'='1"
    with pytest.raises(ForecastNotReadyError):
        await shap_service.get_explanation(malicious_id, "2026-12-01")

    statement, params = _extract_call(mock_uow.repository.execute_readonly_sql, index=1)

    assert isinstance(statement, TextClause)
    assert params == {"pid": malicious_id}
    rendered = str(statement)
    assert ":pid" in rendered
    assert "OR '1'='1" not in rendered


@pytest.mark.asyncio
async def test_cache_lookup_uses_bound_parameters(shap_service, mock_uow):
    malicious_id = "abc' OR '1'='1"
    malicious_date = "2026-01-01'; DROP TABLE shap_cache; --"
    await shap_service._get_cached_explanation(malicious_id, malicious_date)

    statement, params = _extract_call(mock_uow.repository.execute_readonly_sql)

    assert isinstance(statement, TextClause)
    assert params == {"pid": malicious_id, "fd": malicious_date}
    rendered = str(statement)
    assert ":pid" in rendered
    assert ":fd" in rendered
    assert "DROP TABLE" not in rendered
    assert "OR '1'='1" not in rendered
