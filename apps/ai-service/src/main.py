import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from time import perf_counter

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .db import check_connection, close_db, connect_db, ensure_collection_indexes
from .mcp_server import mcp
from .rag import router as rag_router

logger = logging.getLogger("tessera.ai.timing")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
    await connect_db()
    await ensure_collection_indexes()
    yield
    await close_db()


app = FastAPI(
    title="Tessera AI Service",
    version="0.1.0",
    description="RAG & Model Context Protocol service for Tessera.io",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_request_timing(request: Request, call_next):
    start = perf_counter()

    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (perf_counter() - start) * 1000
        logger.exception(
            "ai_service_request_failed method=%s path=%s duration_ms=%.2f",
            request.method,
            request.url.path,
            duration_ms,
        )
        raise

    duration_ms = (perf_counter() - start) * 1000
    response.headers["X-Process-Time-Ms"] = f"{duration_ms:.2f}"
    logger.info(
        "ai_service_request method=%s path=%s status_code=%s duration_ms=%.2f",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


app.include_router(rag_router)
app.mount("/mcp", mcp.sse_app())


@app.get("/health")
async def health_check() -> JSONResponse:
    """Report service health: MongoDB connectivity and model/MCP status.

    Returns 200 when the database is reachable and 503 when it is not, so
    monitoring can act on the status code as well as the JSON body.
    """
    database = await check_connection()

    models = {
        "mcp_server": settings.MCP_SERVER_NAME,
        "embedding_dimensions": settings.EMBEDDING_DIMENSIONS,
        # The embedding pipeline is still a placeholder vector (see rag.py);
        # surfaced here so operators can see it is not a real provider yet.
        "embedding_provider": "placeholder",
    }

    healthy = bool(database["connected"])
    payload = {
        "status": "ok" if healthy else "degraded",
        "database": database,
        "models": models,
    }
    return JSONResponse(status_code=200 if healthy else 503, content=payload)
