"""
Stock Ledger Service.
Single Source of Truth enforcement for all inventory state transitions.
"""
from typing import Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from fastapi import HTTPException, status

from app.models.core import Product
from app.models.inventory import StockMovement, StockByLocation, MovementType


def get_or_create_stock_record(
    db: Session,
    product_id: int,
    location_id: int,
    lot_id: Optional[int] = None,
    for_update: bool = True
) -> StockByLocation:
    """
    Fetches or initializes a StockByLocation cache row.
    Uses row-level locking (SELECT ... FOR UPDATE) when for_update=True to prevent race conditions.
    """
    query = db.query(StockByLocation).filter(
        StockByLocation.product_id == product_id,
        StockByLocation.location_id == location_id,
        StockByLocation.lot_id == lot_id
    )
    if for_update:
        # with_for_update() enforces row-level locking on PostgreSQL
        # SQLite gracefully ignores row locks and uses DB-level locking
        try:
            query = query.with_for_update()
        except Exception:
            pass

    stock_record = query.first()
    if not stock_record:
        stock_record = StockByLocation(
            product_id=product_id,
            location_id=location_id,
            lot_id=lot_id,
            on_hand_qty=0.0,
            reserved_qty=0.0
        )
        db.add(stock_record)
        db.flush()
    return stock_record


def apply_movement(
    db: Session,
    product_id: int,
    movement_type: MovementType,
    quantity: float,
    source_location_id: Optional[int] = None,
    destination_location_id: Optional[int] = None,
    lot_id: Optional[int] = None,
    reference_id: Optional[str] = None,
    reason: Optional[str] = None,
    unit_cost: Optional[float] = None,
    user_id: Optional[int] = None,
    allow_negative: bool = False,
    timestamp: Optional[datetime] = None
) -> StockMovement:
    """
    The ONLY code path allowed to modify stock in StockSense.
    Applies the movement to the append-only StockMovement ledger table
    and updates the StockByLocation read cache inside a single atomic transaction.
    
    Signed Ledger Convention:
      - Inbound (RECEIPT, RETURN_IN, TRANSFER_IN): +quantity into destination_location_id
      - Outbound (DELIVERY, RETURN_OUT, TRANSFER_OUT): -quantity from source_location_id
      - ADJUSTMENT: signed quantity (+ or -) at target location
    """
    if quantity <= 0 and movement_type != MovementType.ADJUSTMENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Movement quantity must be strictly positive"
        )
        
    ts = timestamp or datetime.utcnow()
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found"
        )

    # Inbound Movement
    if movement_type in [MovementType.RECEIPT, MovementType.TRANSFER_IN, MovementType.RETURN_IN]:
        if not destination_location_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"destination_location_id required for {movement_type}"
            )
        
        target_stock = get_or_create_stock_record(
            db, product_id, destination_location_id, lot_id, for_update=True
        )
        
        # Recalculate Weighted-Average Cost on Receipt
        if movement_type == MovementType.RECEIPT and unit_cost is not None and unit_cost > 0:
            total_current_stock = db.query(func.coalesce(func.sum(StockByLocation.on_hand_qty), 0.0))\
                .filter(StockByLocation.product_id == product_id).scalar() or 0.0
            
            if total_current_stock + quantity > 0:
                new_avg_cost = (
                    (total_current_stock * product.average_cost) + (quantity * unit_cost)
                ) / (total_current_stock + quantity)
                product.average_cost = round(new_avg_cost, 4)
                db.add(product)

        target_stock.on_hand_qty += quantity
        db.add(target_stock)

        ledger_entry = StockMovement(
            product_id=product_id,
            lot_id=lot_id,
            source_location_id=source_location_id,
            destination_location_id=destination_location_id,
            quantity=quantity,  # positive signed
            movement_type=movement_type.value if hasattr(movement_type, "value") else str(movement_type),
            reference_id=reference_id,
            reason=reason,
            unit_cost=unit_cost,
            user_id=user_id,
            timestamp=ts
        )
        db.add(ledger_entry)

    # Outbound Movement
    elif movement_type in [MovementType.DELIVERY, MovementType.TRANSFER_OUT, MovementType.RETURN_OUT]:
        if not source_location_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"source_location_id required for {movement_type}"
            )
            
        target_stock = get_or_create_stock_record(
            db, product_id, source_location_id, lot_id, for_update=True
        )

        if not allow_negative and (target_stock.on_hand_qty < quantity):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient on-hand stock at location {source_location_id}. Available: {target_stock.on_hand_qty}, Requested: {quantity}"
            )

        target_stock.on_hand_qty -= quantity
        db.add(target_stock)

        ledger_entry = StockMovement(
            product_id=product_id,
            lot_id=lot_id,
            source_location_id=source_location_id,
            destination_location_id=destination_location_id,
            quantity=-abs(quantity),  # negative signed
            movement_type=movement_type.value if hasattr(movement_type, "value") else str(movement_type),
            reference_id=reference_id,
            reason=reason,
            unit_cost=unit_cost,
            user_id=user_id,
            timestamp=ts
        )
        db.add(ledger_entry)

    # Adjustment Movement
    elif movement_type == MovementType.ADJUSTMENT:
        loc_id = destination_location_id or source_location_id
        if not loc_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="location_id required for ADJUSTMENT"
            )
            
        target_stock = get_or_create_stock_record(
            db, product_id, loc_id, lot_id, for_update=True
        )

        # Quantity is the signed delta: new_counted - recorded
        new_on_hand = target_stock.on_hand_qty + quantity
        if not allow_negative and new_on_hand < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Adjustment would result in negative stock ({new_on_hand})"
            )
            
        target_stock.on_hand_qty = new_on_hand
        db.add(target_stock)

        ledger_entry = StockMovement(
            product_id=product_id,
            lot_id=lot_id,
            source_location_id=loc_id if quantity < 0 else None,
            destination_location_id=loc_id if quantity >= 0 else None,
            quantity=quantity,  # signed delta
            movement_type=MovementType.ADJUSTMENT.value,
            reference_id=reference_id,
            reason=reason or "Inventory physical count adjustment",
            unit_cost=unit_cost,
            user_id=user_id,
            timestamp=ts
        )
        db.add(ledger_entry)
        
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported movement type: {movement_type}"
        )

    db.flush()
    return ledger_entry


def reserve_stock(
    db: Session,
    product_id: int,
    location_id: int,
    quantity: float,
    lot_id: Optional[int] = None
) -> float:
    """
    Reserves stock for a confirmed Sales Order without moving physical stock.
    Returns the amount actually reserved (capped at available quantity).
    """
    target_stock = get_or_create_stock_record(db, product_id, location_id, lot_id, for_update=True)
    available = max(0.0, target_stock.on_hand_qty - target_stock.reserved_qty)
    to_reserve = min(quantity, available)
    target_stock.reserved_qty += to_reserve
    db.add(target_stock)
    db.flush()
    return to_reserve


def release_stock_reservation(
    db: Session,
    product_id: int,
    location_id: int,
    quantity: float,
    lot_id: Optional[int] = None
):
    """
    Releases reserved stock (e.g., when SO is delivered or cancelled).
    """
    target_stock = get_or_create_stock_record(db, product_id, location_id, lot_id, for_update=True)
    target_stock.reserved_qty = max(0.0, target_stock.reserved_qty - quantity)
    db.add(target_stock)
    db.flush()


def verify_ledger_invariant(
    db: Session,
    product_id: Optional[int] = None,
    location_id: Optional[int] = None
) -> bool:
    """
    Verifies that StockByLocation.on_hand_qty strictly equals
    the signed sum of StockMovement rows for every product/location.
    """
    stock_records_query = db.query(StockByLocation)
    if product_id:
        stock_records_query = stock_records_query.filter(StockByLocation.product_id == product_id)
    if location_id:
        stock_records_query = stock_records_query.filter(StockByLocation.location_id == location_id)
        
    stock_records = stock_records_query.all()
    
    for record in stock_records:
        # Sum all inbound movements to this location
        inbound_sum = db.query(func.coalesce(func.sum(StockMovement.quantity), 0.0)).filter(
            StockMovement.product_id == record.product_id,
            StockMovement.destination_location_id == record.location_id,
            StockMovement.lot_id == record.lot_id if record.lot_id is not None else True,
            StockMovement.quantity > 0
        ).scalar() or 0.0

        # Sum all outbound movements from this location
        outbound_sum = db.query(func.coalesce(func.sum(StockMovement.quantity), 0.0)).filter(
            StockMovement.product_id == record.product_id,
            StockMovement.source_location_id == record.location_id,
            StockMovement.lot_id == record.lot_id if record.lot_id is not None else True,
            StockMovement.quantity < 0
        ).scalar() or 0.0

        calculated_total = round(inbound_sum + outbound_sum, 4)
        recorded_total = round(record.on_hand_qty, 4)
        
        if calculated_total != recorded_total:
            return False
            
    return True
