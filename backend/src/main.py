import time
import uuid
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from src.config import settings
from src.api.health import router as health_router
from src.api.router import api_router
from src.infrastructure.logging import setup_logging
import logging
logger = logging.getLogger(__name__)

# Initialize structured logging
setup_logging()

app = FastAPI(
    title="CogniTwin AI Phase 1",
    description="Business Intelligence and Decision Intelligence platform API",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # Parse detail if it's a dict containing type and message
    err_type = "API_ERROR"
    message = str(exc.detail)
    if isinstance(exc.detail, dict):
        err_type = exc.detail.get("type", err_type)
        message = exc.detail.get("message", message)
        
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "error": {
                "type": err_type,
                "message": message,
                "details": []
            }
        },
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "error": {
                "type": "VALIDATION_ERROR",
                "message": "Invalid request parameters",
                "details": exc.errors()
            }
        },
    )

from src.domain.exceptions import CogniTwinError, ValidationError, RateLimitError
@app.exception_handler(CogniTwinError)
async def cognitwin_exception_handler(request: Request, exc: CogniTwinError):
    status_code = 400
    err_type = "BAD_REQUEST"
    if isinstance(exc, ValidationError):
        status_code = 400
        err_type = "VALIDATION_ERROR"
    elif isinstance(exc, RateLimitError):
        status_code = 429
        err_type = "RATE_LIMIT_ERROR"
        
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "error",
            "error": {
                "type": err_type,
                "message": str(exc),
                "details": []
            }
        },
    )

@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start_time = time.time()
    
    # We bind request_id to the request state so it can be accessed if needed
    request.state.request_id = request_id
    
    response = await call_next(request)
    
    duration_ms = (time.time() - start_time) * 1000
    
    # Log request details
    logger.info(
        f"HTTP {request.method} {request.url.path} - {response.status_code}",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": round(duration_ms, 2)
        }
    )
    
    return response

# Include routers
app.include_router(health_router, prefix=settings.API_PREFIX)
app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
