"""Run this once to create all tables (alternative to alembic for dev)."""
from backend.models.base import Base
from backend.db.session import engine

# import all models so Base knows about them
import backend.models.user  # noqa
import backend.models.tool  # noqa
import backend.models.knowledge  # noqa
import backend.models.model_policy  # noqa
import backend.models.guardrail  # noqa
import backend.models.executor  # noqa
import backend.models.orchestrator  # noqa
import backend.models.run  # noqa


def init_db():
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()
    print("Database tables created.")
