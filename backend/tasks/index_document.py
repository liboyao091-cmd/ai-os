from backend.tasks.celery_app import celery_app


@celery_app.task(name="backend.tasks.index_document.index_document_task", bind=True, max_retries=3)
def index_document_task(self, document_id: str):
    from backend.db.session import SessionLocal
    from backend.core.rag.indexer import index_document

    db = SessionLocal()
    try:
        index_document(document_id, db)
    except Exception as exc:
        db.close()
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
    finally:
        db.close()
