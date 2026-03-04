from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://dsaios:password@localhost:5432/ds_ai_os")

engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,
    echo=os.getenv("APP_DEBUG", "false").lower() == "true",
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
