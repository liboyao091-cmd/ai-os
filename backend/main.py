"""DS AI OS — FastAPI backend entry point."""
import logging
import logging.config
import os
import time
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()

# ─── Structured logging ────────────────────────────────────────────────────────
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

logging.config.dictConfig({
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "logging.Formatter",
            "fmt": '{"time":"%(asctime)s","level":"%(levelname)s","name":"%(name)s","msg":%(message)s}',
        },
        "plain": {
            "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "plain",
            "stream": "ext://sys.stdout",
        },
    },
    "root": {"level": LOG_LEVEL, "handlers": ["console"]},
    "loggers": {
        "uvicorn": {"propagate": True},
        "sqlalchemy.engine": {"level": "WARNING", "propagate": True},
    },
})

logger = logging.getLogger("ds_ai_os")

from backend.api import tools, knowledge, executors, orchestrators, runs, model_policies, guardrails


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info('"DS AI OS starting up"')
    if os.getenv("APP_DEBUG", "false").lower() == "true":
        try:
            from backend.db.init_db import init_db
            init_db()
            logger.info('"Database tables verified/created"')
        except Exception as exc:
            logger.warning(f'"DB init skipped: {exc}"')
    yield
    logger.info('"DS AI OS shutting down"')


app = FastAPI(
    title="DS AI OS",
    version="1.0.0",
    description="AI Workflow Platform for Data Scientists",
    lifespan=lifespan,
)

# ─── CORS ──────────────────────────────────────────────────────────────────────
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,app://").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request logging middleware ─────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    t0 = time.time()
    response = await call_next(request)
    duration = int((time.time() - t0) * 1000)
    logger.info(
        f'"method":"{request.method}","path":"{request.url.path}",'
        f'"status":{response.status_code},"duration_ms":{duration}'
    )
    return response


# ─── Global error handler ───────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f'"Unhandled exception on {request.url.path}: {exc}"', exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# ─── Routers ───────────────────────────────────────────────────────────────────
PREFIX = "/api"
app.include_router(tools.router, prefix=PREFIX)
app.include_router(knowledge.router, prefix=PREFIX)
app.include_router(executors.router, prefix=PREFIX)
app.include_router(orchestrators.router, prefix=PREFIX)
app.include_router(runs.router, prefix=PREFIX)
app.include_router(model_policies.router, prefix=PREFIX)
app.include_router(guardrails.router, prefix=PREFIX)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ds-ai-os", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
