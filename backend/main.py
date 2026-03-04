"""DS AI OS — FastAPI backend entry point."""
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from backend.api import tools, knowledge, executors, orchestrators, runs, model_policies, guardrails


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create tables on startup (development convenience)
    if os.getenv("APP_DEBUG", "false").lower() == "true":
        try:
            from backend.db.init_db import init_db
            init_db()
        except Exception as exc:
            print(f"[startup] DB init skipped: {exc}")
    yield


app = FastAPI(
    title="DS AI OS",
    version="1.0.0",
    description="AI Workflow Platform for Data Scientists",
    lifespan=lifespan,
)

# CORS
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,app://").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
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
    return {"status": "ok", "service": "ds-ai-os"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
