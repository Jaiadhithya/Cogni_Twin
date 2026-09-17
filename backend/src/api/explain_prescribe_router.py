"""Phase 6: Unified Explain + Prescribe endpoint."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from src.api.schemas.explain_prescribe import ExplainPrescribeResponseData
from src.api.schemas.common import SuccessResponse
from src.api.errors import internal_error
from src.services.prescriptive_service import PrescriptiveService
from src.dependencies import get_prescriptive_service
from src.domain.exceptions import MlError, CogniTwinError

router = APIRouter(prefix="/forecast", tags=["Forecast"])


@router.get("/explain-prescribe", response_model=SuccessResponse[ExplainPrescribeResponseData])
async def explain_prescribe(
    horizon_days: int = 30,
    dataset_id: str | None = None,
    http_request: Request = None,
    prescriptive_service: PrescriptiveService = Depends(get_prescriptive_service)
):
    """Get unified forecast explanation with SHAP drivers, anomaly detection, and prescriptive actions."""
    try:
        result = await prescriptive_service.get_explain_prescribe(horizon_days=horizon_days, dataset_id=dataset_id)
        return SuccessResponse(data=ExplainPrescribeResponseData(**result))
    except MlError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"type": "ML_ERROR", "message": str(e)}
        )
    except CogniTwinError:
        raise
    except Exception:
        raise internal_error(http_request, "forecast/explain-prescribe")
