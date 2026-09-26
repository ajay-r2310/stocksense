"""Database configuration and session management for StockSense."""
import os
from pydantic_settings import BaseSettings
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


class Settings(BaseSettings):
    PROJECT_NAME: str = "StockSense"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "stocksense-super-secret-key-change-in-prod-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours for hackathon/demo
    
    # Default to SQLite for easy local runs, or PostgreSQL if configured
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./stocksense.db"
    )
    
    # Auto-approval threshold for inventory adjustments: relative % or absolute unit diff
    ADJUSTMENT_RELATIVE_THRESHOLD: float = 0.10  # 10%
    ADJUSTMENT_UNIT_THRESHOLD: float = 50.0       # 50 units

    class Config:
        case_sensitive = True


settings = Settings()

# Engine creation with thread safety check for sqlite
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
