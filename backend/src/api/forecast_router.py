from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from src.api.schemas.forecast import (
    ForecastTrainRequest, ForecastTrainResponseData, 
    ForecastPredictResponseData, ForecastStatusResponseData,
    SimulationRequest, SimulationResponseData, BacktestResponseData, TrainingJobData
)
from src.api.schemas.common import SuccessResponse
from src.api.errors import internal_error
from src.services.forecast_service import ForecastService
from src.dependencies import get_forecast_service, get_training_job_service
from src.services.training_job_service import TrainingJobService
from src.domain.exceptions import MlError, CogniTwinError

router = APIRouter(prefix="/forecast", tags=["Forecast"])


@router.post("/train", response_model=None, responses={
    200: {"model": SuccessResponse[ForecastTrainResponseData], "description": "wait=true: training finished"},
    202: {"model": SuccessResponse[TrainingJobData], "description": "Training job accepted"},
})
async def train_model(
    request: ForecastTrainRequest,
    http_request: Request,
    wait: bool = False,
    job_service: TrainingJobService = Depends(get_training_job_service),
):
    """Train a forecasting model for a dataset as a background job.

    Returns ``202`` with a ``job_id`` to poll at ``GET /forecast/jobs/{job_id}``. If a job for the
    same dataset is already queued or running, that job is returned instead of starting another.
    Pass ``?wait=true`` to block until it finishes and get the legacy ``200`` training response.
    """
    try:
        job, _created = await job_service.submit(request.dataset_id, request.granularity)
        if not wait:
            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content=SuccessResponse(data=TrainingJobData(**job)).model_dump(mode="json"),
            )

        job = await job_service.wait(job["job_id"])
        if job["status"] == "failed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"type": "ML_ERROR", "message": job["error"]},
            )
        if job["status"] != "succeeded":
            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content=SuccessResponse(data=TrainingJobData(**job)).model_dump(mode="json"),
            )
        return SuccessResponse(data=ForecastTrainResponseData(job_id=job["job_id"], **job["metrics"]))
    except (HTTPException, CogniTwinError):
        raise
    except Exception:
        raise internal_error(http_request, "forecast/train")


@router.get("/jobs/{job_id}", response_model=SuccessResponse[TrainingJobData])
async def get_training_job(
    job_id: str,
    job_service: TrainingJobService = Depends(get_training_job_service),
):
    """Poll a training job (queued, running, succeeded, failed)."""
    return SuccessResponse(data=TrainingJobData(**await job_service.get(job_id)))

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
    """Execute a counterfactual What-If simulation with mutated business levers and aligned lever contributions."""
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
