"""Automated Test Suite for PO Receipts, SO Reservations & Deliveries, and Weighted Average Costing."""
import pytest
from sqlalchemy.orm import Session
from app.models.core import Product, Category, UnitOfMeasure, Warehouse, Location, Supplier
from app.models.orders import PurchaseOrder, SalesOrder, POStatus, SOStatus
from app.models.inventory import StockByLocation
from app.services.ledger_service import verify_ledger_invariant


def test_po_receipt_and_weighted_average_cost(client, auth_headers, db_session: Session):
    """
    Tests PO creation -> receipt -> inventory increase -> weighted-average cost update.
    """
    cat = db_session.query(Category).first()
    uom = db_session.query(UnitOfMeasure).first()
    wh = db_session.query(Warehouse).first()
    loc = db_session.query(Location).filter(Location.warehouse_id == wh.id).first()
    sup = db_session.query(Supplier).first()

    prod = Product(
        name="Industrial Sensor Node",
        sku="SENS-IND-01",
        category_id=cat.id,
        base_uom_id=uom.id,
        average_cost=10.0
    )
    db_session.add(prod)
    db_session.commit()
    db_session.refresh(prod)

    # 1. Create PO for 100 units @ $20.0
    po_resp = client.post("/api/v1/orders/purchase-orders", json={
        "supplier_id": sup.id,
        "warehouse_id": wh.id,
        "lines": [{"product_id": prod.id, "ordered_qty": 100.0, "unit_cost": 20.0}]
    }, headers=auth_headers("Inventory Manager"))
    assert po_resp.status_code == 200
    po_id = po_resp.json()["id"]

    # 2. Confirm PO
    client.post(f"/api/v1/orders/purchase-orders/{po_id}/confirm", headers=auth_headers("Inventory Manager"))

    # 3. Receive full 100 units
    rec_resp = client.post(
        f"/api/v1/orders/purchase-orders/{po_id}/receive?destination_location_id={loc.id}",
        json=[{"product_id": prod.id, "qty": 100.0}],
        headers=auth_headers("Warehouse Worker")
    )
    assert rec_resp.status_code == 200
    assert rec_resp.json()["status"] == POStatus.DONE.value

    # 4. Verify StockByLocation and weighted cost
    stock = db_session.query(StockByLocation).filter(
        StockByLocation.product_id == prod.id,
        StockByLocation.location_id == loc.id
    ).first()
    assert stock.on_hand_qty == 100.0

    db_session.refresh(prod)
    # New avg cost: 100 * 20 / 100 = 20.0
    assert prod.average_cost == 20.0

    # 5. Receive 100 more units @ $30.0 -> average cost should be (100*20 + 100*30)/200 = $25.0
    po2_resp = client.post("/api/v1/orders/purchase-orders", json={
        "supplier_id": sup.id,
        "warehouse_id": wh.id,
        "lines": [{"product_id": prod.id, "ordered_qty": 100.0, "unit_cost": 30.0}]
    }, headers=auth_headers("Inventory Manager"))
    po2_id = po2_resp.json()["id"]
    client.post(f"/api/v1/orders/purchase-orders/{po2_id}/confirm", headers=auth_headers("Inventory Manager"))
    client.post(
        f"/api/v1/orders/purchase-orders/{po2_id}/receive?destination_location_id={loc.id}",
        json=[{"product_id": prod.id, "qty": 100.0}],
        headers=auth_headers("Warehouse Worker")
    )

    db_session.refresh(prod)
    assert prod.average_cost == 25.0

    # 6. Verify ledger invariant
    assert verify_ledger_invariant(db_session, prod.id, loc.id) is True


def test_so_reservation_and_delivery_lifecycle(client, auth_headers, db_session: Session):
    """
    Tests SO creation -> confirmation (reserves stock) -> delivery (reduces stock, releases reservation).
    """
    cat = db_session.query(Category).first()
    uom = db_session.query(UnitOfMeasure).first()
    wh = db_session.query(Warehouse).first()
    loc = db_session.query(Location).filter(Location.warehouse_id == wh.id).first()
    sup = db_session.query(Supplier).first()

    prod = Product(
        name="Actuator Valve 12V",
        sku="ACT-VALVE-12V",
        category_id=cat.id,
        base_uom_id=uom.id
    )
    db_session.add(prod)
    db_session.commit()
    db_session.refresh(prod)

    # Initial stock: Receive 50 units
    po_resp = client.post("/api/v1/orders/purchase-orders", json={
        "supplier_id": sup.id,
        "warehouse_id": wh.id,
        "lines": [{"product_id": prod.id, "ordered_qty": 50.0, "unit_cost": 15.0}]
    }, headers=auth_headers("Inventory Manager"))
    po_id = po_resp.json()["id"]
    client.post(f"/api/v1/orders/purchase-orders/{po_id}/confirm", headers=auth_headers("Inventory Manager"))
    client.post(
        f"/api/v1/orders/purchase-orders/{po_id}/receive?destination_location_id={loc.id}",
        json=[{"product_id": prod.id, "qty": 50.0}],
        headers=auth_headers("Warehouse Worker")
    )

    # 1. Create SO for 30 units
    so_resp = client.post("/api/v1/orders/sales-orders", json={
        "customer_name": "Acme Robotics",
        "warehouse_id": wh.id,
        "lines": [{"product_id": prod.id, "ordered_qty": 30.0, "unit_price": 45.0}]
    }, headers=auth_headers("Inventory Manager"))
    assert so_resp.status_code == 200
    so_id = so_resp.json()["id"]

    # 2. Confirm SO -> Should reserve 30 units
    client.post(f"/api/v1/orders/sales-orders/{so_id}/confirm", headers=auth_headers("Inventory Manager"))

    stock = db_session.query(StockByLocation).filter(
        StockByLocation.product_id == prod.id,
        StockByLocation.location_id == loc.id
    ).first()
    assert stock.on_hand_qty == 50.0
    assert stock.reserved_qty == 30.0
    assert stock.available_qty == 20.0

    # 3. Deliver SO -> on_hand drops to 20, reserved drops to 0
    del_resp = client.post(
        f"/api/v1/orders/sales-orders/{so_id}/deliver?source_location_id={loc.id}",
        json=[{"product_id": prod.id, "qty": 30.0}],
        headers=auth_headers("Warehouse Worker")
    )
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == SOStatus.DONE.value

    db_session.refresh(stock)
    assert stock.on_hand_qty == 20.0
    assert stock.reserved_qty == 0.0
    assert stock.available_qty == 20.0

    # Invariant holds
    assert verify_ledger_invariant(db_session, prod.id, loc.id) is True
