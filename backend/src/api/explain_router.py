"""Explain router."""

from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import Optional
from datetime import datetime, timedelta

from src.api.schemas.explain import ShapExplanationResponse
from src.api.schemas.common import SuccessResponse
from src.services.shap_explainer_service import ShapExplainerService
from src.dependencies import get_shap_explainer_service
from src.domain.exceptions import CogniTwinError, MlError

router = APIRouter(prefix="/forecast", tags=["Forecast Explainability"])

@router.get("/explain/{product_id}", response_model=SuccessResponse[ShapExplanationResponse])
async def explain_forecast(
    product_id: str,
    forecast_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    service: ShapExplainerService = Depends(get_shap_explainer_service),
):
    """
    Get SHAP-style explanation for a forecast.
    """
    if not forecast_date:
        # Default to tomorrow
        forecast_date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
    try:
        result = await service.get_explanation(product_id=product_id, forecast_date=forecast_date)
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"type": "UnexpectedError", "message": f"Unexpected error: {str(e)}"}
        )
