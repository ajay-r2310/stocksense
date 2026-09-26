"""Automated Test Suite for RBAC Permissions and Authentication."""
import pytest
from fastapi.testclient import TestClient


def test_auth_login_successful(client: TestClient):
    """Verifies that each seeded user can log in and receives a valid JWT token with role claims."""
    credentials = [
        ("admin@stocksense.io", "adminpassword123", "Admin"),
        ("manager@stocksense.io", "managerpassword123", "Inventory Manager"),
        ("worker@stocksense.io", "workerpassword123", "Warehouse Worker"),
        ("viewer@stocksense.io", "viewerpassword123", "Viewer"),
    ]
    for email, password, expected_role in credentials:
        resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["role"]["name"] == expected_role


def test_auth_login_invalid_password(client: TestClient):
    resp = client.post("/api/v1/auth/login", json={"email": "admin@stocksense.io", "password": "wrongpassword"})
    assert resp.status_code == 401


def test_rbac_warehouse_creation_admin_only(client: TestClient, auth_headers):
    """Admin can create warehouse; Manager, Worker, and Viewer are blocked with 403."""
    wh_payload = {"name": "Secondary Logistics Hub", "code": "WH-SEC", "address": "400 Harbor Way"}

    # Viewer fails
    resp = client.post("/api/v1/warehouses", json=wh_payload, headers=auth_headers("Viewer"))
    assert resp.status_code == 403

    # Worker fails
    resp = client.post("/api/v1/warehouses", json=wh_payload, headers=auth_headers("Warehouse Worker"))
    assert resp.status_code == 403

    # Manager fails
    resp = client.post("/api/v1/warehouses", json=wh_payload, headers=auth_headers("Inventory Manager"))
    assert resp.status_code == 403

    # Admin succeeds
    resp = client.post("/api/v1/warehouses", json=wh_payload, headers=auth_headers("Admin"))
    assert resp.status_code == 200
    assert resp.json()["code"] == "WH-SEC"


def test_rbac_adjustment_approval_manager_only(client: TestClient, auth_headers, db_session):
    """Worker cannot approve adjustments; Manager and Admin can."""
    from app.models.core import Product, Category, UnitOfMeasure, Location
    from app.models.inventory import InventoryAdjustment, AdjustmentStatus

    cat = db_session.query(Category).first()
    uom = db_session.query(UnitOfMeasure).first()
    loc = db_session.query(Location).first()
    prod = Product(name="Test Item", sku="SKU-TEST-001", category_id=cat.id, base_uom_id=uom.id)
    db_session.add(prod)
    db_session.commit()

    # Create a pending adjustment (large difference > threshold)
    adj_resp = client.post("/api/v1/inventory/adjustments", json={
        "product_id": prod.id,
        "location_id": loc.id,
        "counted_qty": 100.0,
        "reason": "Found pallet in corner"
    }, headers=auth_headers("Warehouse Worker"))
    assert adj_resp.status_code == 200
    adj_id = adj_resp.json()["id"]
    assert adj_resp.json()["status"] == AdjustmentStatus.PENDING_APPROVAL.value

    # Worker attempts approval -> 403 Forbidden
    worker_approve = client.post(f"/api/v1/inventory/adjustments/{adj_id}/approve", headers=auth_headers("Warehouse Worker"))
    assert worker_approve.status_code == 403

    # Manager approves -> 200 OK
    manager_approve = client.post(f"/api/v1/inventory/adjustments/{adj_id}/approve", headers=auth_headers("Inventory Manager"))
    assert manager_approve.status_code == 200
    assert manager_approve.json()["status"] == AdjustmentStatus.APPROVED.value
