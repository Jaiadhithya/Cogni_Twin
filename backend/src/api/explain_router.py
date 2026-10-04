"""Explain router."""

from fastapi import APIRouter, Depends, Query, HTTPException, Request, status
from typing import Optional
from datetime import datetime, timedelta

from src.api.schemas.explain import ShapExplanationResponse
from src.api.schemas.common import SuccessResponse
from src.api.errors import internal_error
from src.services.shap_explainer_service import ShapExplainerService
from src.dependencies import get_shap_explainer_service
from src.domain.exceptions import CogniTwinError, MlError

router = APIRouter(prefix="/forecast", tags=["Forecast Explainability"])

@router.get("/explain/{product_id}", response_model=SuccessResponse[ShapExplanationResponse])
async def explain_forecast(
    http_request: Request,
    product_id: str,
    forecast_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    dataset_id: Optional[str] = Query(None, description="Explain this dataset's model; defaults to the most recently trained one"),
    service: ShapExplainerService = Depends(get_shap_explainer_service),
):
    """
    Get a factor-attribution explanation for a forecast.
    """
    if not forecast_date:
        # Default to tomorrow
        forecast_date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
    try:
        result = await service.get_explanation(product_id=product_id, forecast_date=forecast_date, dataset_id=dataset_id)
        return SuccessResponse(data=result)
    except CogniTwinError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"type": type(e).__name__, "message": str(e)}
        )
    except MlError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"type": type(e).__name__, "message": str(e)}
        )
    except Exception:
        raise internal_error(http_request, "forecast/explain")
