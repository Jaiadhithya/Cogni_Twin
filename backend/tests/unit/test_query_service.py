import pytest
from unittest.mock import AsyncMock, MagicMock
from decimal import Decimal
from src.services.query_service import QueryService
from src.domain.value_objects.query_intent import QueryIntent

@pytest.fixture
def mock_uow():
    uow = MagicMock()
    uow.__aenter__ = AsyncMock(return_value=uow)
    uow.__aexit__ = AsyncMock(return_value=None)
    uow.rollback = AsyncMock()
    uow.repository.get_table_schemas = AsyncMock(return_value="Table: sales (sale_date DATE, total_amount NUMERIC)")
    uow.repository.execute_readonly_sql = AsyncMock(return_value=[
        {"sale_date": "2026-01-01", "total_amount": Decimal("1500.50")},
        {"sale_date": "2026-01-02", "total_amount": Decimal("2300.00")},
    ])
    return uow

@pytest.fixture
def mock_llm():
    llm = MagicMock()
    llm.generate_sql = AsyncMock(return_value="SELECT sale_date, total_amount FROM sales LIMIT 20;")
    llm.format_answer = AsyncMock(return_value="Sales trended upward from ₹1,500.50 to ₹2,300.00.\n- Strongest growth observed on Jan 2.\n- Total volume exceeded targets.")
    llm.generate_text = AsyncMock(return_value="SQL")
    return llm

@pytest.fixture
def mock_prescriptive():
    service = MagicMock()
    service.get_explain_prescribe = AsyncMock(return_value={
        "forecast_points": [{"date": "2026-02-01", "predicted": 50000}],
        "prescriptive_actions": [
            {"priority": 1, "action": "Increase marketing spend", "expected_impact": "₹5 Lakh", "timeframe": "7 days"}
        ],
        "executive_summary": "Stable trajectory projected.",
        "anomaly_detected": False,
        "anomaly_description": None
    })
    return service

@pytest.mark.asyncio
async def test_query_service_synthesizes_charts_and_insights(mock_uow, mock_llm, mock_prescriptive):
    qs = QueryService(
        uow=mock_uow,
        llm_client=mock_llm,
        prescriptive_service=mock_prescriptive
    )

    result = await qs.execute_query("Show daily sales trend", dataset_id="test-dataset-id")

    assert result["question"] == "Show daily sales trend"
    assert "insights" in result
    assert len(result["insights"]) >= 1
    assert "charts" in result
    assert len(result["charts"]) == 1
    assert result["charts"][0]["type"] == "line"
    assert result["charts"][0]["x_key"] == "sale_date"
    assert result["charts"][0]["y_keys"] == ["total_amount"]
    # Check data serialization (Decimals converted to floats)
    assert isinstance(result["charts"][0]["data"][0]["total_amount"], float)

@pytest.mark.asyncio
async def test_query_service_prescriptive_actions_trigger(mock_uow, mock_llm, mock_prescriptive):
    qs = QueryService(
        uow=mock_uow,
        llm_client=mock_llm,
        prescriptive_service=mock_prescriptive
    )

    result = await qs.execute_query("How can we improve revenue and take strategic action?")

    assert len(result["prescriptive_actions"]) >= 1
    assert result["prescriptive_actions"][0]["action"] == "Increase marketing spend"

@pytest.mark.asyncio
async def test_query_service_categorical_chart_generation(mock_uow, mock_llm):
    mock_uow.repository.execute_readonly_sql = AsyncMock(return_value=[
        {"category": "Electronics", "revenue": 10000},
        {"category": "Clothing", "revenue": 8000},
        {"category": "Groceries", "revenue": 5000},
    ])
    qs = QueryService(uow=mock_uow, llm_client=mock_llm)
    
    charts = qs._synthesize_charts_from_sql_results("Category breakdown", [
        {"category": "Electronics", "revenue": 10000},
        {"category": "Clothing", "revenue": 8000},
        {"category": "Groceries", "revenue": 5000},
    ])
    assert len(charts) == 1
    assert charts[0]["type"] == "pie"
    assert charts[0]["x_key"] == "category"
    assert charts[0]["y_keys"] == ["revenue"]

@pytest.mark.asyncio
async def test_query_service_scatter_chart_generation(mock_uow, mock_llm):
    qs = QueryService(uow=mock_uow, llm_client=mock_llm)
    
    charts = qs._synthesize_charts_from_sql_results("Price vs demand", [
        {"price": 10.0, "demand": 100},
        {"price": 15.0, "demand": 80},
    ])
    assert len(charts) == 1
    assert charts[0]["type"] == "scatter"
    assert charts[0]["x_key"] == "price"
    assert charts[0]["y_keys"] == ["demand"]

@pytest.mark.asyncio
async def test_query_service_chart_generation_with_leading_nulls(mock_uow, mock_llm):
    qs = QueryService(uow=mock_uow, llm_client=mock_llm)

    # First row has None for price, but second row has valid number
    charts = qs._synthesize_charts_from_sql_results("Price vs demand with nulls", [
        {"price": None, "demand": 100},
        {"price": 12.5, "demand": 80},
    ])
    assert len(charts) == 1
    assert charts[0]["type"] == "scatter"
    assert charts[0]["x_key"] == "price"
    assert charts[0]["y_keys"] == ["demand"]

@pytest.mark.asyncio
async def test_query_service_single_row_aggregate_chart(mock_uow, mock_llm):
    qs = QueryService(uow=mock_uow, llm_client=mock_llm)

    # Single-row multi-metric aggregate query result
    charts = qs._synthesize_charts_from_sql_results("Summary stats", [
        {"total_revenue": 50000.0, "avg_order_value": 1500.0, "total_orders": 35}
    ])
    assert len(charts) == 1
    assert charts[0]["type"] == "bar"
    assert charts[0]["x_key"] == "metric"
    assert charts[0]["y_keys"] == ["value"]
    assert len(charts[0]["data"]) == 3

@pytest.mark.asyncio
async def test_query_service_empty_results_no_charts(mock_uow, mock_llm):
    qs = QueryService(uow=mock_uow, llm_client=mock_llm)
    charts = qs._synthesize_charts_from_sql_results("Empty query", [])
    assert charts == []

@pytest.mark.asyncio
async def test_deterministic_lever_extraction(mock_uow, mock_llm):
    qs = QueryService(uow=mock_uow, llm_client=mock_llm)

    assert qs._extract_simulation_levers_deterministic("What if we increase price by 15%?") == {"unit_price": "+15%"}
    assert qs._extract_simulation_levers_deterministic("What if price drops by 10%?") == {"unit_price": "-10%"}
    assert qs._extract_simulation_levers_deterministic("What happens if marketing budget doubles?") == {"marketing_spend": "+100%"}
    assert qs._extract_simulation_levers_deterministic("Simulate supplier delay of 5 extra days") == {"supplier_lead_time_days": "+5"}
    assert qs._extract_simulation_levers_deterministic("What if competitor discount is 8%?") == {"competitor_discount_pct": "+8%"}
    assert qs._extract_simulation_levers_deterministic("What if we increase unit price by 15% and cut marketing spend by 10%?") == {
        "unit_price": "+15%",
        "marketing_spend": "-10%"
    }
    assert qs._extract_simulation_levers_deterministic("Simulate supplier delay of 5 extra days and cut price by 5%") == {
        "supplier_lead_time_days": "+5",
        "unit_price": "-5%"
    }
    assert qs._extract_simulation_levers_deterministic("What if price drops by ₹5?") == {"unit_price": "-5"}
    assert qs._extract_simulation_levers_deterministic("Raise price a bit and cut ad budget") == {
        "unit_price": "+10%",
        "marketing_spend": "-10%"
    }

@pytest.mark.asyncio
async def test_simulation_query_llm_failure_deterministic_fallback(mock_uow, mock_llm):
    mock_llm.generate_text = AsyncMock(side_effect=Exception("LLM API Timeout"))
    mock_forecast = MagicMock()
    mock_forecast.simulate = AsyncMock(return_value={
        "total_delta": 25000.0,
        "total_delta_pct": 5.2,
        "baseline_total": 480000.0,
        "mutated_total": 505000.0,
        "mutations_applied": {"unit_price": "+15%"},
        "points": [{"date": "2026-02-01", "baseline": 15000.0, "mutated": 16000.0}]
    })

    qs = QueryService(
        uow=mock_uow,
        llm_client=mock_llm,
        forecast_service=mock_forecast
    )

    result = await qs._execute_simulation_query("What if we increase price by 15%?")
    assert result["confidence"] == "high"
    assert "Simulation complete" in result["answer"]
    assert mock_forecast.simulate.called
    assert mock_forecast.simulate.call_args[1]["mutations"] == {"unit_price": "+15%"}


