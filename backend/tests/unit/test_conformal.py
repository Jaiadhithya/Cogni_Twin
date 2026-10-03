"""Split-conformal intervals: quantile maths, response shape and calibration caching."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.services import forecast_service as fs
from src.services.conformal import conformal_quantile, intervals_around
from src.services.forecast_service import ForecastService


def test_quantile_uses_finite_sample_index():
    errors = list(range(1, 21))  # 1..20, n = 20
    # k = ceil(21 * 0.8) = 17 -> 17th smallest
    assert conformal_quantile(errors, 0.80) == 17
    # k = ceil(21 * 0.95) = 20 -> the maximum
    assert conformal_quantile(errors, 0.95) == 20


def test_quantile_refuses_when_guarantee_impossible():
    assert conformal_quantile(list(range(1, 11)), 0.95) is None  # k = ceil(11 * .95) = 11 > 10
    assert conformal_quantile([], 0.8) is None


def test_intervals_are_floored_at_zero():
    out = intervals_around([1.0, 10.0], 3.0)
    assert out == {"lower": [0.0, 7.0], "upper": [4.0, 13.0]}


def test_intervals_not_floored_when_target_can_be_negative():
    out = intervals_around([1.0, -10.0], 3.0, nonnegative=False)
    assert out == {"lower": [-2.0, -13.0], "upper": [4.0, -7.0]}


POINTS = [
    {"date": "2026-01-01", "baseline_predicted": 100.0, "mutated_predicted": 120.0},
    {"date": "2026-01-02", "baseline_predicted": 110.0, "mutated_predicted": 90.0},
]


def test_conformal_response_shape():
    out = ForecastService._build_uncertainty(POINTS, [float(i) for i in range(1, 29)], None, None, None, horizon_days=2)
    assert out["method"] == "split_conformal" and out["calibration_points"] == 28
    assert out["dates"] == ["2026-01-01", "2026-01-02"]
    assert set(out["levels"]) == {"80", "95"}
    w80, w95 = out["levels"]["80"]["half_width"], out["levels"]["95"]["half_width"]
    assert w95 > w80 > 0
    base = out["levels"]["80"]["baseline"]
    assert base["lower"] == [round(100 - w80, 2), round(110 - w80, 2)]
    assert out["levels"]["80"]["scenario"]["upper"][0] == round(120 + w80, 2)
    assert out["levels"]["95"]["baseline"]["upper"][0] > out["levels"]["80"]["baseline"]["upper"][0]


def test_short_calibration_drops_95_and_flags_long_horizon():
    out = ForecastService._build_uncertainty(POINTS, [float(i) for i in range(1, 15)], None, None, None, horizon_days=30)
    assert set(out["levels"]) == {"80"}  # 14 errors cannot support 95%
    assert any("beyond that" in n for n in out["notes"])


def test_prophet_fallback_reports_method_and_reason():
    prophet = {"lower": [90.0, 95.0], "upper": [110.0, 120.0]}
    out = ForecastService._build_uncertainty(POINTS, None, "Only 40 days of history", prophet, prophet, horizon_days=2)
    assert out["method"] == "model_intervals" and out["calibration_points"] is None
    assert set(out["levels"]) == {"80"} and out["levels"]["80"]["baseline"] == prophet
    assert out["notes"] == ["Only 40 days of history"]


def _service(n_days: int, backtest: AsyncMock) -> ForecastService:
    forecaster = MagicMock()
    forecaster.get_latest_model_info.return_value = {"model_id": "model-xyz"}
    forecaster.backtest = backtest
    service = ForecastService(uow=MagicMock(), forecaster=forecaster)
    service._extract_series = AsyncMock(return_value=([{"date": str(i), "actual": 1.0} for i in range(n_days)], "ds"))
    return service


@pytest.mark.asyncio
async def test_calibration_runs_backtest_once_per_model():
    fs._conformal_cache.clear()
    backtest = AsyncMock(return_value={"abs_errors": [1.0] * 28})
    service = _service(90, backtest)
    first = await service._calibration_errors("ds")
    second = await service._calibration_errors("ds")
    assert first == second == ([1.0] * 28, None, True)
    assert backtest.await_count == 1
    assert backtest.await_args.kwargs["test_days"] == 28


@pytest.mark.asyncio
async def test_calibration_unavailable_for_short_history_or_backtest_failure():
    fs._conformal_cache.clear()
    short = _service(40, AsyncMock())
    errors, reason, _ = await short._calibration_errors("ds")
    assert errors is None and "40 days" in reason

    broken = _service(90, AsyncMock(side_effect=RuntimeError("boom")))
    errors, reason, _ = await broken._calibration_errors("ds")
    assert errors is None and reason == "Backtest calibration failed."


@pytest.mark.asyncio
async def test_calibration_reports_whether_history_goes_negative():
    fs._conformal_cache.clear()
    service = _service(90, AsyncMock(return_value={"abs_errors": [1.0] * 28}))
    service._extract_series = AsyncMock(
        return_value=([{"date": str(i), "actual": -5.0 if i == 3 else 1.0} for i in range(90)], "ds")
    )
    _errors, _reason, nonnegative = await service._calibration_errors("ds")
    assert nonnegative is False

    out = ForecastService._build_uncertainty(
        [{"date": "2026-01-01", "baseline_predicted": 1.0, "mutated_predicted": 2.0}],
        [5.0] * 28, None, None, None, horizon_days=1, nonnegative=False,
    )
    assert out["levels"]["80"]["baseline"]["lower"] == [-4.0]
