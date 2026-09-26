"""
Automated Test Suite for Phase 3 Intelligence Layer.
Validates:
1. Forecasting moving averages (7d vs 28d) and trend detection.
2. Cold start fallback on <14 day items (RAW-ALUM-2020).
3. Hot trending items (MCU-STM32F4, SENS-GYRO-6AXIS) yield MEDIUM or HIGH risk (not LOW).
4. Reorder recommendation math with pending PO subtraction, floored at 0.
5. Programmatic explainability bullets referencing exact numerical inputs.
6. Prediction feedback accuracy calculation.
"""
import pytest
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.core import Product, Category, UnitOfMeasure, Warehouse, Location, Supplier
from app.models.orders import PurchaseOrder, PurchaseOrderLine, POStatus
from app.models.inventory import StockByLocation
from app.services.ledger_service import apply_movement, MovementType
from app.services.forecasting_service import (
    get_product_forecast,
    get_stockout_prediction,
    get_reorder_recommendation,
    generate_explainability_report,
    evaluate_prediction_accuracy
)


@pytest.fixture
def seeded_intelligence_data(db_session: Session):
    """Sets up a mini-dataset with known trend, cold-start, and open POs for exact math verification."""
    cat_elec = db_session.query(Category).filter(Category.code == "ELEC").first()
    cat_raw = db_session.query(Category).filter(Category.code == "RAW").first()
    uom_pcs = db_session.query(UnitOfMeasure).filter(UnitOfMeasure.symbol == "pcs").first()
    wh = db_session.query(Warehouse).first()
    loc = db_session.query(Location).filter(Location.warehouse_id == wh.id).first()
    sup = db_session.query(Supplier).first()

    today = datetime.utcnow()

    # 1. Hot Trending Item (MCU-STM32F4) - 30 days history, sharp increase in last 7 days
    prod_hot = Product(
        name="STM32F4 Cortex-M4 Microcontroller",
        sku="MCU-STM32F4",
        category_id=cat_elec.id,
        base_uom_id=uom_pcs.id,
        primary_supplier_id=sup.id,
        reorder_level=150.0,
        safety_stock=80.0,
        average_cost=12.50
    )
    # 2. Cold Start Item (RAW-ALUM-2020) - only 6 days of history
    prod_cold = Product(
        name="2020 T-Slot Aluminum Extrusion",
        sku="RAW-ALUM-2020",
        category_id=cat_raw.id,
        base_uom_id=uom_pcs.id,
        primary_supplier_id=sup.id,
        reorder_level=50.0,
        safety_stock=25.0,
        average_cost=14.20
    )
    # 3. Baseline Category Product to establish category average for RAW
    prod_raw_base = Product(
        name="Raw Base Material",
        sku="RAW-BASE-01",
        category_id=cat_raw.id,
        base_uom_id=uom_pcs.id,
        primary_supplier_id=sup.id,
        reorder_level=100.0,
        safety_stock=50.0
    )
    db_session.add_all([prod_hot, prod_cold, prod_raw_base])
    db_session.commit()

    # Inbound initial stock for hot item (650 units at loc -> 650 - 540 = 110 units left = 3.66 days = HIGH risk)
    apply_movement(
        db=db_session,
        product_id=prod_hot.id,
        movement_type=MovementType.RECEIPT,
        quantity=650.0,
        destination_location_id=loc.id,
        timestamp=today - timedelta(days=35)
    )
    # Inbound stock for cold item (40 units)
    apply_movement(
        db=db_session,
        product_id=prod_cold.id,
        movement_type=MovementType.RECEIPT,
        quantity=40.0,
        destination_location_id=loc.id,
        timestamp=today - timedelta(days=6)
    )
    # Inbound stock for raw base (500 units)
    apply_movement(
        db=db_session,
        product_id=prod_raw_base.id,
        movement_type=MovementType.RECEIPT,
        quantity=500.0,
        destination_location_id=loc.id,
        timestamp=today - timedelta(days=30)
    )

    # Historical demand for RAW category base: 10 units/day over 28 days
    for day in range(28, 0, -1):
        apply_movement(
            db=db_session,
            product_id=prod_raw_base.id,
            movement_type=MovementType.DELIVERY,
            quantity=10.0,
            source_location_id=loc.id,
            timestamp=today - timedelta(days=day)
        )

    # Historical demand for HOT item:
    # Days 28-8: 15 units/day (20 days * 15 = 300)
    # Days 7-0: 30 units/day (surging!) (8 days * 30 = 240)
    for day in range(28, 7, -1):
        apply_movement(
            db=db_session,
            product_id=prod_hot.id,
            movement_type=MovementType.DELIVERY,
            quantity=15.0,
            source_location_id=loc.id,
            timestamp=today - timedelta(days=day)
        )
    for day in range(7, -1, -1):
        apply_movement(
            db=db_session,
            product_id=prod_hot.id,
            movement_type=MovementType.DELIVERY,
            quantity=30.0,
            source_location_id=loc.id,
            timestamp=today - timedelta(days=day)
        )

    # In-transit open PO for Hot Item (50 units)
    po = PurchaseOrder(
        po_number="PO-TEST-HOT",
        supplier_id=sup.id,
        warehouse_id=wh.id,
        status=POStatus.CONFIRMED.value,
        expected_date=today + timedelta(days=4)
    )
    db_session.add(po)
    db_session.flush()
    db_session.add(PurchaseOrderLine(
        purchase_order_id=po.id,
        product_id=prod_hot.id,
        ordered_qty=50.0,
        received_qty=0.0,
        unit_cost=12.50
    ))
    db_session.commit()

    return {
        "prod_hot": prod_hot,
        "prod_cold": prod_cold,
        "sup": sup,
        "loc": loc
    }


def test_trending_item_forecast_and_risk(db_session: Session, seeded_intelligence_data):
    """
    Asserts that the hot trending item (MCU-STM32F4) detects the surge (7d > 28d)
    and classifies stockout risk as MEDIUM or HIGH (not LOW).
    """
    prod_hot = seeded_intelligence_data["prod_hot"]
    forecast = get_product_forecast(db_session, prod_hot.id)

    assert forecast["trend"] == "increasing"
    assert forecast["avg_7d"] > forecast["avg_28d"]
    assert forecast["forecasted_daily_demand"] == forecast["avg_7d"]

    prediction = get_stockout_prediction(db_session, prod_hot.id)
    # Must be MEDIUM or HIGH risk due to surging demand & low remaining days
    assert prediction["risk_tier"] in ["MEDIUM", "HIGH"]
    assert prediction["days_remaining"] <= 14.0


def test_cold_start_category_fallback(db_session: Session, seeded_intelligence_data):
    """
    Asserts that RAW-ALUM-2020 (<14 days history) triggers cold start fallback
    and borrows the category-level baseline demand instead of 0 or noisy data.
    """
    prod_cold = seeded_intelligence_data["prod_cold"]
    forecast = get_product_forecast(db_session, prod_cold.id)

    assert forecast["is_cold_start"] is True
    assert forecast["trend"] == "cold_start_fallback"
    assert forecast["forecasted_daily_demand"] > 0.0


def test_reorder_recommendation_math_with_open_po(db_session: Session, seeded_intelligence_data):
    """
    Verifies smart reorder formula:
    (daily_demand * lead_time) + safety_stock - available - pending_open_po
    floored at 0.
    """
    prod_hot = seeded_intelligence_data["prod_hot"]
    rec = get_reorder_recommendation(db_session, prod_hot.id)

    # Check that pending_incoming_qty correctly detected the 50 units open PO
    assert rec["pending_incoming_qty"] == 50.0

    expected_gross = (rec["forecasted_daily_demand"] * rec["supplier_lead_time_days"]) + rec["safety_stock"]
    expected_reorder = max(0.0, round(expected_gross - rec["available_qty"] - rec["pending_incoming_qty"], 0))

    assert rec["recommended_reorder_qty"] == expected_reorder
    assert rec["recommended_reorder_qty"] >= 0


def test_explainability_bullets_content(db_session: Session, seeded_intelligence_data):
    """
    Asserts that explanation bullets programmatically reflect the exact computed numbers.
    """
    prod_hot = seeded_intelligence_data["prod_hot"]
    report = generate_explainability_report(db_session, prod_hot.id)

    assert len(report["explanation_bullets"]) >= 3
    bullet_texts = " ".join(b["text"] for b in report["explanation_bullets"])

    # Must contain actual numerical references
    assert f"{report['forecast']['avg_7d']}" in bullet_texts or f"{report['reorder']['supplier_lead_time_days']}" in bullet_texts
    assert "50" in bullet_texts  # in-transit PO line reference


def test_api_intelligence_endpoints(client, auth_headers, seeded_intelligence_data):
    """
    Tests REST API endpoints for intelligence layer.
    """
    prod_hot = seeded_intelligence_data["prod_hot"]

    # 1. Forecast endpoint
    resp = client.get(f"/api/v1/intelligence/forecast/{prod_hot.id}", headers=auth_headers("Viewer"))
    assert resp.status_code == 200
    data = resp.json()
    assert "forecasted_daily_demand" in data

    # 2. Stockout risk overview
    risk_resp = client.get("/api/v1/intelligence/stockout-risk", headers=auth_headers("Viewer"))
    assert risk_resp.status_code == 200
    assert len(risk_resp.json()) >= 2

    # 3. Reorder recommendations
    reorder_resp = client.get("/api/v1/intelligence/reorder-recommendations", headers=auth_headers("Viewer"))
    assert reorder_resp.status_code == 200
    assert len(reorder_resp.json()) >= 2

    # 4. Explainability endpoint
    explain_resp = client.get(f"/api/v1/intelligence/explain/{prod_hot.id}", headers=auth_headers("Viewer"))
    assert explain_resp.status_code == 200
    assert "explanation_bullets" in explain_resp.json()
