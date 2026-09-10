from fastapi import APIRouter, Depends, HTTPException, status
from src.api.schemas.forecast import (
    ForecastTrainRequest, ForecastTrainResponseData, 
    ForecastPredictResponseData, ForecastStatusResponseData,
    SimulationRequest, SimulationResponseData
)
from src.api.schemas.common import SuccessResponse
from src.services.forecast_service import ForecastService
from src.dependencies import get_forecast_service
from src.domain.exceptions import MlError, CogniTwinError

router = APIRouter(prefix="/forecast", tags=["Forecast"])


@router.post("/train", response_model=SuccessResponse[ForecastTrainResponseData])
async def train_model(
    request: ForecastTrainRequest,
    forecast_service: ForecastService = Depends(get_forecast_service)
):
    """Train a forecasting model on the uploaded sales data."""
    try:
        result = await forecast_service.train_model(granularity=request.granularity)
        return SuccessResponse(data=ForecastTrainResponseData(**result))
    except MlError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"type": "ML_ERROR", "message": str(e)}
        )
    except CogniTwinError:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"type": "INTERNAL_ERROR", "message": str(e)}
        )

@router.get("/predict", response_model=SuccessResponse[ForecastPredictResponseData])
async def predict(
    horizon_days: int = 30,
    forecast_service: ForecastService = Depends(get_forecast_service)
):
    """Generate sales forecasts using the trained model."""
    try:
        result = await forecast_service.get_forecast(horizon_days=horizon_days)
        return SuccessResponse(data=ForecastPredictResponseData(**result))
    except MlError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"type": "ML_ERROR", "message": str(e)}
        )
    except CogniTwinError:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"type": "INTERNAL_ERROR", "message": str(e)}
        )

@router.get("/status", response_model=SuccessResponse[ForecastStatusResponseData])
async def get_status(
    forecast_service: ForecastService = Depends(get_forecast_service)
):
    """Get the status of the current forecasting model."""
    try:
        result = await forecast_service.get_status()
        return SuccessResponse(data=ForecastStatusResponseData(**result))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"type": "INTERNAL_ERROR", "message": str(e)}
        )


@router.post("/simulate", response_model=SuccessResponse[SimulationResponseData])
async def simulate_scenario(
    request: SimulationRequest,
    forecast_service: ForecastService = Depends(get_forecast_service)
):
    """Phase 6: Execute a counterfactual What-If simulation with mutated business levers."""
    try:
        result = await forecast_service.simulate(
            horizon_days=request.horizon_days,
            mutations=request.mutations
        )
        return SuccessResponse(data=SimulationResponseData(**result))
    except MlError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"type": "ML_ERROR", "message": str(e)}
        )
    except CogniTwinError:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"type": "INTERNAL_ERROR", "message": str(e)}
        )
