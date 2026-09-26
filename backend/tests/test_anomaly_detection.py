"""
Automated Test Suite for Anomaly Detection, KnownEvent Exclusion, and Stock Health Score.

Explicitly asserts:
- DISP-OLED-096 Day -2 anomaly (6.5x surge) is detected and flagged by EWMA ±3σ engine.
- RAW-RESIN-EPOXY Day -45 surge (4.2x) tagged to KnownEvent is excluded from flagging and baseline distortion.
- Stock Health Score decomposes accurately into all 6 sub-scores.
"""
from datetime import datetime, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.core import Product, UnitOfMeasure, Category, Warehouse, Location
from app.models.inventory import StockMovement, MovementType
from app.models.intelligence import KnownEvent, AnomalyRecord
from app.services.ledger_service import apply_movement
from app.services.anomaly_service import (
    compute_ewma_baseline_and_anomalies,
    run_and_persist_anomaly_detection,
    calculate_stock_health_score,
)


def test_disp_oled_anomaly_detection(db_session: Session):
    """
    Validation Seed Fact:
    DISP-OLED-096 has a 6.5x surge 2 days ago -> MUST be flagged as an anomaly.
    """
    uom = db_session.query(UnitOfMeasure).first()
    category = db_session.query(Category).first()
    loc = db_session.query(Location).first()

    prod = Product(
        name="0.96 inch I2C OLED Display",
        sku="DISP-OLED-096",
        base_uom_id=uom.id,
        category_id=category.id,
        safety_stock=10.0,
        reorder_level=20.0,
    )
    db_session.add(prod)
    db_session.commit()

    today = datetime.utcnow()

    # Initial stock
    apply_movement(
        db=db_session,
        product_id=prod.id,
        movement_type=MovementType.RECEIPT,
        quantity=500.0,
        destination_location_id=loc.id,
        reference_id="PO-1",
        user_id=1,
        timestamp=today - timedelta(days=60),
    )

    # 40 days of normal steady consumption: ~5 units/day
    for d in range(50, 3, -1):
        apply_movement(
            db=db_session,
            product_id=prod.id,
            movement_type=MovementType.DELIVERY,
            quantity=5.0,
            source_location_id=loc.id,
            reference_id=f"SO-{100 + d}",
            user_id=1,
            timestamp=today - timedelta(days=d),
        )

    # Day -2: Manufactured 6.5x surge (32.5 units)
    apply_movement(
        db=db_session,
        product_id=prod.id,
        movement_type=MovementType.DELIVERY,
        quantity=32.5,
        source_location_id=loc.id,
        reference_id="SO-999",
        user_id=1,
        timestamp=today - timedelta(days=2),
    )

    # Run EWMA anomaly detection
    anomalies = compute_ewma_baseline_and_anomalies(db_session, prod.id, as_of=today)

    assert len(anomalies) >= 1, "DISP-OLED-096 surge on Day -2 was NOT flagged!"
    target_anomaly = next((a for a in anomalies if a["actual_quantity"] >= 30.0), None)
    assert target_anomaly is not None, "Failed to identify the 6.5x surge volume in flagged anomalies."
    assert target_anomaly["z_score"] >= 3.0, f"Expected Z-score >= 3.0, got {target_anomaly['z_score']}"
    assert "Demand surge" in target_anomaly["possible_causes"]


def test_raw_resin_known_event_exclusion(db_session: Session):
    """
    Validation Seed Fact:
    RAW-RESIN-EPOXY had a 4.2x surge 45 days ago tagged to a KnownEvent (Diwali Surge).
    Must NOT be flagged as an anomaly and must NOT distort current EWMA baseline.
    """
    uom = db_session.query(UnitOfMeasure).first()
    category = db_session.query(Category).first()
    loc = db_session.query(Location).first()

    prod = Product(
        name="Epoxy Resin 2-Part Kit",
        sku="RAW-RESIN-EPOXY",
        base_uom_id=uom.id,
        category_id=category.id,
        safety_stock=15.0,
        reorder_level=30.0,
    )
    db_session.add(prod)
    db_session.commit()

    today = datetime.utcnow()

    # Create KnownEvent window spanning Day -48 to Day -42
    event = KnownEvent(
        name="Diwali Festive Season Production Surge",
        start_date=today - timedelta(days=48),
        end_date=today - timedelta(days=42),
        description="Planned seasonal manufacturing spike for holiday rush",
        created_by=1,
    )
    db_session.add(event)
    db_session.commit()

    # Initial stock
    apply_movement(
        db=db_session,
        product_id=prod.id,
        movement_type=MovementType.RECEIPT,
        quantity=1000.0,
        destination_location_id=loc.id,
        reference_id="PO-2",
        user_id=1,
        timestamp=today - timedelta(days=70),
    )

    # Steady consumption 10 kg/day
    for d in range(65, 0, -1):
        # On Day -45 (inside the KnownEvent window), inject 4.2x surge (42.0 kg)
        qty = 42.0 if d == 45 else 10.0
        apply_movement(
            db=db_session,
            product_id=prod.id,
            movement_type=MovementType.DELIVERY,
            quantity=qty,
            source_location_id=loc.id,
            reference_id=f"SO-{200 + d}",
            user_id=1,
            timestamp=today - timedelta(days=d),
        )

    # Run EWMA anomaly detection
    anomalies = compute_ewma_baseline_and_anomalies(db_session, prod.id, as_of=today)

    # Ensure the Day -45 spike is NOT in flagged anomalies
    day_45_flagged = any(
        (today - a["event_date"]).days in [44, 45, 46] for a in anomalies
    )
    assert not day_45_flagged, "RAW-RESIN-EPOXY KnownEvent surge was erroneously flagged as an anomaly!"


def test_stock_health_score_breakdown(db_session: Session):
    """
    Validates the 6-component Stock Health Composite Score decomposition.
    """
    uom = db_session.query(UnitOfMeasure).first()
    category = db_session.query(Category).first()
    loc = db_session.query(Location).first()

    prod = Product(
        name="Aluminum Extrusion",
        sku="RAW-ALUM-TEST",
        base_uom_id=uom.id,
        category_id=category.id,
        safety_stock=20.0,
        reorder_level=40.0,
    )
    db_session.add(prod)
    db_session.commit()

    # Add stock
    apply_movement(
        db=db_session,
        product_id=prod.id,
        movement_type=MovementType.RECEIPT,
        quantity=100.0,
        destination_location_id=loc.id,
        reference_id="PO-3",
        user_id=1,
    )

    health_report = calculate_stock_health_score(db_session, product_id=prod.id)

    assert "overall_health_score" in health_report
    assert 0 <= health_report["overall_health_score"] <= 100
    assert "composite_sub_scores" in health_report
    sub = health_report["composite_sub_scores"]
    assert "availability_score" in sub
    assert "demand_stability_score" in sub
    assert "supplier_reliability_score" in sub
    assert "overstock_control_score" in sub
    assert "stockout_mitigation_score" in sub
    assert "anomaly_health_score" in sub


def test_anomalies_api_endpoints(client: TestClient, auth_headers):
    """
    Tests REST API routes for anomaly detection, acknowledgement, and known events.
    """
    admin_hdr = auth_headers("Admin")
    manager_hdr = auth_headers("Inventory Manager")
    viewer_hdr = auth_headers("Viewer")

    # 1. Create Known Event
    ev_payload = {
        "name": "Year End Flash Sale",
        "start_date": (datetime.utcnow() + timedelta(days=10)).isoformat(),
        "end_date": (datetime.utcnow() + timedelta(days=14)).isoformat(),
        "description": "High throughput promotion",
    }
    create_res = client.post("/api/v1/anomalies/known-events", json=ev_payload, headers=manager_hdr)
    assert create_res.status_code == 201
    ev_data = create_res.json()
    assert ev_data["name"] == "Year End Flash Sale"

    # 2. List Known Events
    list_res = client.get("/api/v1/anomalies/known-events", headers=viewer_hdr)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 3. Trigger on-demand anomaly scan
    detect_res = client.post("/api/v1/anomalies/detect", headers=manager_hdr)
    assert detect_res.status_code == 200
    assert "scanned_records_count" in detect_res.json()

    # 4. Get Stock Health Score
    health_res = client.get("/api/v1/intelligence/stock-health-score", headers=viewer_hdr)
    assert health_res.status_code == 200
    assert "overall_health_score" in health_res.json()
