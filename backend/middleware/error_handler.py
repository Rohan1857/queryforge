from fastapi import Request
from fastapi.responses import JSONResponse
from loguru import logger
from pydantic import ValidationError
from slowapi.errors import RateLimitExceeded


async def validation_error_handler(_request: Request, exc: ValidationError) -> JSONResponse:
    logger.warning(f"Validation error: {exc.error_count()} errors")
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation Error",
            "detail": exc.errors(),
        },
    )


async def rate_limit_handler(_request: Request, exc: RateLimitExceeded) -> JSONResponse:
    logger.warning(f"Rate limit exceeded: {exc.detail}")
    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate Limit Exceeded",
            "detail": str(exc.detail),
        },
    )


async def generic_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception(f"Unhandled error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "detail": "An unexpected error occurred",
        },
    )
