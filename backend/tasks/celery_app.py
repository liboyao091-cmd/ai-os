import os
from celery import Celery

BROKER = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")

celery_app = Celery("ds_ai_os", broker=BROKER, backend=BACKEND)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "backend.tasks.index_document.index_document_task": {"queue": "indexing"},
        "backend.tasks.run_executor_async.run_executor_task": {"queue": "execution"},
    },
)
