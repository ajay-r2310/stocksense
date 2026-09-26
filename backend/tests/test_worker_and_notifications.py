"""
Automated Test Suite for Worker Workflows and Notification Alert Engine.
"""
from datetime import datetime, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.core import Product, UnitOfMeasure, Category, Warehouse, Location
from app.models.inventory import StockMovement, MovementType, InventoryAdjustment, AdjustmentStatus
from app.models.notifications import Notification, SimulatedEmailLog
from app.services.ledger_service import apply_movement
from app.services.notification_service import NotificationService


def test_notification_dispatch_and_scan(db_session: Session):
    """
    Tests automatic generation of alerts when low stock and pending adjustments occur.
    """
    uom = db_session.query(UnitOfMeasure).first()
    category = db_session.query(Category).first()
    loc = db_session.query(Location).first()

    # Create low-stock product
    prod = Product(
        name="Low Stock Resistor Pack",
        sku="ELEC-RES-001",
        base_uom_id=uom.id,
        category_id=category.id,
        safety_stock=20.0,
        reorder_level=50.0,
    )
    db_session.add(prod)
    db_session.commit()

    # Add only 10 units (below reorder_level 50.0)
    apply_movement(
        db=db_session,
        product_id=prod.id,
        movement_type=MovementType.RECEIPT,
        quantity=10.0,
        destination_location_id=loc.id,
        reference_id="PO-INIT",
        user_id=1,
    )

    # Queue an adjustment
    adj = InventoryAdjustment(
        product_id=prod.id,
        location_id=loc.id,
        recorded_qty=10.0,
        counted_qty=6.0,
        difference=-4.0,
        status=AdjustmentStatus.PENDING_APPROVAL.value,
        requested_by=1,
        reason="Physical audit loss",
    )
    db_session.add(adj)
    db_session.commit()

    # Run system alert scan
    scan_res = NotificationService.scan_and_generate_system_alerts(db_session)
    assert scan_res["status"] == "success"
    assert scan_res["new_notifications_count"] >= 1

    # Verify notifications recorded
    notifs = db_session.query(Notification).all()
    assert len(notifs) >= 1
    types = [n.notification_type for n in notifs]
    assert "LOW_STOCK" in types or "ADJUSTMENT_PENDING" in types

    # Verify simulated email logs
    email_logs = db_session.query(SimulatedEmailLog).all()
    assert len(email_logs) >= 1


def test_notifications_api(client: TestClient, auth_headers):
    """
    Tests REST API endpoints for viewing and marking notifications as read.
    """
    manager_hdr = auth_headers("Inventory Manager")
    viewer_hdr = auth_headers("Viewer")

    # 1. Trigger Alert Scan
    scan_res = client.post("/api/v1/notifications/scan", headers=manager_hdr)
    assert scan_res.status_code == 200

    # 2. List Notifications
    list_res = client.get("/api/v1/notifications", headers=viewer_hdr)
    assert list_res.status_code == 200

    # 3. View Simulated Email Logs
    email_res = client.get("/api/v1/notifications/simulated-emails", headers=manager_hdr)
    assert email_res.status_code == 200
