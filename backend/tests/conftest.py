"""Pytest fixtures for StockSense backend."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.core.config import Base, get_db
from app.main import app
from app.db.init_db import init_db
from app.services.auth_service import create_access_token
from app.models.auth import User, Role
from app.models.core import Product, Category, UnitOfMeasure, Warehouse, Location, Supplier

# Use in-memory SQLite with StaticPool so all connections and threads share the same database instance
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    init_db(db)
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(db_session):
    """Helper to generate auth headers for different roles."""
    def _get_headers_for_role(role_name: str):
        user = db_session.query(User).join(Role).filter(Role.name == role_name).first()
        token = create_access_token(data={"sub": str(user.id), "role": user.role.name})
        return {"Authorization": f"Bearer {token}"}
    return _get_headers_for_role
