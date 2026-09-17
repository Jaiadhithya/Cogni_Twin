from fastapi import APIRouter, Depends, HTTPException, Request, status
from src.api.schemas.query import QueryRequest, QueryResponseData
from src.api.schemas.common import SuccessResponse

from src.services.query_service import QueryService
from src.dependencies import get_query_service
from src.domain.exceptions import LlmError, ValidationError, CogniTwinError, RateLimitError
from src.infrastructure.rate_limiter import query_rate_limiter

router = APIRouter(prefix="/query", tags=["Query"])


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("", response_model=SuccessResponse[QueryResponseData])
async def execute_query(
    request: QueryRequest,
    raw_request: Request,
    query_service: QueryService = Depends(get_query_service),
):
    """
    Execute a natural language query against the warehouse data.
    """
    query_rate_limiter.check(f"query:{_client_key(raw_request)}")
    try:
        result = await query_service.execute_query(request.question, dataset_id=request.dataset_id)
        return SuccessResponse(data=QueryResponseData(**result))
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"type": "VALIDATION_ERROR", "message": str(e)}
        )
    except LlmError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"type": "LLM_ERROR", "message": str(e)}
        )
    except CogniTwinError:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"type": "INTERNAL_ERROR", "message": str(e)}
        )
