"""Shared API error helpers.

Internal (unexpected) exceptions must never be echoed to clients: their string
form can contain database URLs, file paths, or library internals. Instead we
log the real exception server-side against the request id assigned by the
logging middleware and return a generic message that references that id.
"""

import logging

from fastapi import HTTPException, Request, status

logger = logging.getLogger(__name__)


def internal_error(request: Request, context: str) -> HTTPException:
    """Build a generic 500 response, logging the live exception with request id."""
    request_id = getattr(request.state, "request_id", "unknown")
    logger.exception(f"[request_id={request_id}] Unhandled error in {context}")
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={
            "type": "INTERNAL_ERROR",
            "message": f"An internal error occurred while processing the request. "
            f"If this persists, quote reference {request_id}.",
        },
    )
