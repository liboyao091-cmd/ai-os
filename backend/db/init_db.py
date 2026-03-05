"""Initialize database: extensions first, then all tables."""
from sqlalchemy import text

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


def init_extensions(conn):
    """Enable required PostgreSQL extensions before creating tables."""
    conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    conn.commit()


def init_db():
    with engine.begin() as conn:
        init_extensions(conn)
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()
    print("Database tables created.")
