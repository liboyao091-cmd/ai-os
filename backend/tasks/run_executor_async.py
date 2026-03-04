import uuid
from datetime import datetime, timezone
from typing import Any, Dict

from backend.tasks.celery_app import celery_app


@celery_app.task(name="backend.tasks.run_executor_async.run_executor_task", bind=True, max_retries=1)
def run_executor_task(self, executor_id: str, run_id: str, input_data: Dict[str, Any], user_id: str):
    from backend.db.session import SessionLocal
    from backend.models.executor import Executor
    from backend.models.run import ExecutionRun
    from backend.core.engine.executor_service import build_context, _dispatch_runner
    import time

    db = SessionLocal()
    try:
        ex = db.query(Executor).filter(Executor.id == uuid.UUID(executor_id)).first()
        run = db.query(ExecutionRun).filter(ExecutionRun.id == uuid.UUID(run_id)).first()
        if not ex or not run:
            return

        t0 = time.time()
        ctx = build_context(ex, db, user_id, run_id)
        result = _dispatch_runner(ex, input_data, ctx)

        run.status = "success"
        run.output = result.output
        run.steps_log = result.steps_log
        run.total_tokens = result.total_tokens
        run.duration_ms = int((time.time() - t0) * 1000)
        run.finished_at = datetime.now(timezone.utc)
        db.commit()
    except Exception as exc:
        if run:
            run.status = "failed"
            run.error_message = str(exc)
            run.finished_at = datetime.now(timezone.utc)
            db.commit()
        raise
    finally:
        db.close()
