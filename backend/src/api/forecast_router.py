from fastapi import APIRouter, Depends, HTTPException, Request, status
from src.api.schemas.forecast import (
    ForecastTrainRequest, ForecastTrainResponseData, 
    ForecastPredictResponseData, ForecastStatusResponseData,
    SimulationRequest, SimulationResponseData, BacktestResponseData
)
from src.api.schemas.common import SuccessResponse
from src.api.errors import internal_error
from src.services.forecast_service import ForecastService
from src.dependencies import get_forecast_service
from src.domain.exceptions import MlError, CogniTwinError

router = APIRouter(prefix="/forecast", tags=["Forecast"])


@router.post("/train", response_model=SuccessResponse[ForecastTrainResponseData])
async def train_model(
    request: ForecastTrainRequest,
    http_request: Request,
    forecast_service: ForecastService = Depends(get_forecast_service)
):
    """Train a forecasting model on the uploaded sales data, scoped to dataset_id."""
    try:
        result = await forecast_service.train_model(
            granularity=request.granularity,
            dataset_id=request.dataset_id
        )
        return SuccessResponse(data=ForecastTrainResponseData(**result))
    except MlError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"type": "ML_ERROR", "message": str(e)}
        )
    except CogniTwinError:
        raise
    except Exception:
        raise internal_error(http_request, "forecast/train")

@router.get("/predict", response_model=SuccessResponse[ForecastPredictResponseData])
async def predict(
    horizon_days: int = 30,
    dataset_id: str | None = None,
    http_request: Request = None,
    forecast_service: ForecastService = Depends(get_forecast_service)
):
    """Generate sales forecasts using the trained model for a specific dataset."""
    try:
        result = await forecast_service.get_forecast(
            horizon_days=horizon_days,
            dataset_id=dataset_id
        )
        return SuccessResponse(data=ForecastPredictResponseData(**result))
    except MlError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"type": "ML_ERROR", "message": str(e)}
        )
    except CogniTwinError:
        raise
    except Exception:
        raise internal_error(http_request, "forecast/predict")

@router.get("/status", response_model=SuccessResponse[ForecastStatusResponseData])
async def get_status(
    dataset_id: str | None = None,
    http_request: Request = None,
    forecast_service: ForecastService = Depends(get_forecast_service)
):
    """Get the status of the forecasting model, optionally scoped to a dataset."""
    try:
        result = await forecast_service.get_status(dataset_id=dataset_id)
        return SuccessResponse(data=ForecastStatusResponseData(**result))
    except Exception:
        raise internal_error(http_request, "forecast/status")


@router.get("/backtest", response_model=SuccessResponse[BacktestResponseData])
async def backtest(
    test_days: int = 14,
    dataset_id: str | None = None,
    http_request: Request = None,
    forecast_service: ForecastService = Depends(get_forecast_service)
):
    """Score the forecasting model on a held-out tail window (MAE/MAPE/RMSE)."""
    try:
        result = await forecast_service.backtest(test_days=test_days, dataset_id=dataset_id)
        return SuccessResponse(data=BacktestResponseData(**result))
    except MlError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"type": "ML_ERROR", "message": str(e)}
        )
    except CogniTwinError:
        raise
    except Exception:
        raise internal_error(http_request, "forecast/backtest")


@router.post("/simulate", response_model=SuccessResponse[SimulationResponseData])
async def simulate_scenario(
    request: SimulationRequest,
    http_request: Request,
    forecast_service: ForecastService = Depends(get_forecast_service)
):
    """Execute a counterfactual What-If simulation with mutated business levers and aligned SHAP forces."""
    try:
        result = await forecast_service.simulate(
            horizon_days=request.horizon_days,
            mutations=request.mutations,
            dataset_id=request.dataset_id
        )
        return SuccessResponse(data=SimulationResponseData(**result))
    except MlError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"type": "ML_ERROR", "message": str(e)}
        )
    except CogniTwinError:
        raise
    except Exception:
        raise internal_error(http_request, "forecast/simulate")
