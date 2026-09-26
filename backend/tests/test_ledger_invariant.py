"""
Automated Test for Fundamental Stock Ledger Invariant.
Asserts: For any (product_id, location_id), StockByLocation.on_hand_qty
strictly equals the signed sum of all corresponding StockMovement rows.
"""
import pytest
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.core import Product, Location, Warehouse, Category, UnitOfMeasure
from app.models.inventory import StockMovement, StockByLocation, MovementType
from app.services.ledger_service import apply_movement, verify_ledger_invariant


def test_stock_ledger_invariant_fundamental(db_session: Session):
    """
    Asserts that across multiple movements (Receipt, Delivery, Transfer, Adjustment),
    StockByLocation.on_hand_qty strictly matches sum(StockMovement) rows.
    """
    # 1. Setup Test Master Data
    cat = db_session.query(Category).first()
    uom = db_session.query(UnitOfMeasure).first()
    wh = db_session.query(Warehouse).first()
    loc_a = db_session.query(Location).filter(Location.name == "RACK-A1").first()
    loc_b = db_session.query(Location).filter(Location.name == "RACK-A2").first()

    product1 = Product(
        name="STM32 Microcontroller",
        sku="MCU-STM32F4",
        category_id=cat.id,
        base_uom_id=uom.id,
        reorder_level=20.0,
        safety_stock=10.0,
        average_cost=15.0
    )
    product2 = Product(
        name="M4 Titanium Bolt",
        sku="BOLT-TITANIUM-M4",
        category_id=cat.id,
        base_uom_id=uom.id,
        reorder_level=100.0,
        safety_stock=50.0,
        average_cost=0.5
    )
    db_session.add_all([product1, product2])
    db_session.commit()
    db_session.refresh(product1)
    db_session.refresh(product2)

    # 2. Inbound Receipt: +100 units of Product 1 at Loc A
    apply_movement(
        db=db_session,
        product_id=product1.id,
        movement_type=MovementType.RECEIPT,
        quantity=100.0,
        destination_location_id=loc_a.id,
        reference_id="PO-0001",
        unit_cost=15.0
    )
    db_session.commit()
    assert verify_ledger_invariant(db_session, product1.id, loc_a.id) is True

    # 3. Inbound Receipt: +50 units of Product 1 at Loc A
    apply_movement(
        db=db_session,
        product_id=product1.id,
        movement_type=MovementType.RECEIPT,
        quantity=50.0,
        destination_location_id=loc_a.id,
        reference_id="PO-0002",
        unit_cost=16.0
    )
    db_session.commit()
    assert verify_ledger_invariant(db_session, product1.id, loc_a.id) is True

    # 4. Outbound Delivery: -30 units of Product 1 from Loc A
    apply_movement(
        db=db_session,
        product_id=product1.id,
        movement_type=MovementType.DELIVERY,
        quantity=30.0,
        source_location_id=loc_a.id,
        reference_id="SO-0001"
    )
    db_session.commit()
    assert verify_ledger_invariant(db_session, product1.id, loc_a.id) is True

    # 5. Internal Transfer: Move 25 units of Product 1 from Loc A to Loc B
    apply_movement(
        db=db_session,
        product_id=product1.id,
        movement_type=MovementType.TRANSFER_OUT,
        quantity=25.0,
        source_location_id=loc_a.id,
        destination_location_id=loc_b.id,
        reference_id="TR-0001"
    )
    apply_movement(
        db=db_session,
        product_id=product1.id,
        movement_type=MovementType.TRANSFER_IN,
        quantity=25.0,
        source_location_id=loc_a.id,
        destination_location_id=loc_b.id,
        reference_id="TR-0001"
    )
    db_session.commit()
    assert verify_ledger_invariant(db_session, product1.id, loc_a.id) is True
    assert verify_ledger_invariant(db_session, product1.id, loc_b.id) is True

    # 6. Physical Count Adjustment: +5 discrepancy found at Loc B
    apply_movement(
        db=db_session,
        product_id=product1.id,
        movement_type=MovementType.ADJUSTMENT,
        quantity=5.0,
        destination_location_id=loc_b.id,
        reference_id="ADJ-0001",
        reason="Found extra box during cycle count"
    )
    db_session.commit()
    assert verify_ledger_invariant(db_session, product1.id, loc_b.id) is True

    # 7. Operate on Product 2 simultaneously
    apply_movement(
        db=db_session,
        product_id=product2.id,
        movement_type=MovementType.RECEIPT,
        quantity=500.0,
        destination_location_id=loc_b.id,
        reference_id="PO-0003",
        unit_cost=0.5
    )
    apply_movement(
        db=db_session,
        product_id=product2.id,
        movement_type=MovementType.DELIVERY,
        quantity=120.0,
        source_location_id=loc_b.id,
        reference_id="SO-0002"
    )
    db_session.commit()

    # 8. Assert global invariant across ALL products and locations
    assert verify_ledger_invariant(db_session) is True

    # Check exact numerical values
    stock_p1_loc_a = db_session.query(StockByLocation).filter(
        StockByLocation.product_id == product1.id,
        StockByLocation.location_id == loc_a.id
    ).first()
    # Loc A: 100 + 50 - 30 - 25 = 95
    assert stock_p1_loc_a.on_hand_qty == 95.0

    stock_p1_loc_b = db_session.query(StockByLocation).filter(
        StockByLocation.product_id == product1.id,
        StockByLocation.location_id == loc_b.id
    ).first()
    # Loc B: 25 + 5 = 30
    assert stock_p1_loc_b.on_hand_qty == 30.0

    stock_p2_loc_b = db_session.query(StockByLocation).filter(
        StockByLocation.product_id == product2.id,
        StockByLocation.location_id == loc_b.id
    ).first()
    # Product 2 at Loc B: 500 - 120 = 380
    assert stock_p2_loc_b.on_hand_qty == 380.0
