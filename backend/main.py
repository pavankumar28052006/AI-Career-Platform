"""FastAPI application factory with lifespan, CORS, and router registration."""

import time
import uuid
import traceback
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from core.errors import ErrorCode, ErrorDetail
from core.logging import configure_root_logger, get_logger, request_id_ctx_var
from db.neo4j_client import close_neo4j, init_neo4j
from db.redis_client import close_redis, init_redis
from routers import analysis, auth, graph, resume, skills

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan — initialise and teardown external connections."""
    settings = get_settings()
    configure_root_logger(settings.log_level)
    logger.info("Starting AI Career Platform backend", extra={"env": settings.app_env})

    # Startup
    await init_redis()
    await init_neo4j()

    # Create arq pool and attach to state
    # We parse the redis URL to configure ARQ RedisSettings if needed, or default for local.
    redis_url = settings.redis_url
    app.state.arq_pool = await create_pool(RedisSettings.from_dsn(redis_url))

    yield

    # Shutdown
    await close_neo4j()
    await close_redis()
    logger.info("Backend shutdown complete")


def create_app() -> FastAPI:
    """Construct and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="AI Career Platform API",
        description="Graph-based skill extraction, gap analysis, and career path recommendations.",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.app_env == "development" else settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(auth.router)
    app.include_router(resume.router)
    app.include_router(graph.router)
    app.include_router(analysis.router)
    app.include_router(skills.router)

    @app.middleware("http")
    async def request_metrics_middleware(request: Request, call_next):
        request_id = str(uuid.uuid4())
        token = request_id_ctx_var.set(request_id)
        start_time = time.perf_counter()
        
        try:
            response = await call_next(request)
        finally:
            process_time = time.perf_counter() - start_time
            logger.info(
                "Request processed",
                extra={
                    "path": request.url.path,
                    "method": request.method,
                    "duration_ms": round(process_time * 1000, 2)
                }
            )
            request_id_ctx_var.reset(token)
            
        return response

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {exc}\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"detail": ErrorDetail(
                code=ErrorCode.INTERNAL_SERVER_ERROR,
                message="An unexpected internal error occurred."
            ).model_dump()}
        )

    @app.get("/health", tags=["health"])
    async def health() -> dict:
        return {"status": "ok", "version": "1.0.0"}

    return app


app = create_app()
