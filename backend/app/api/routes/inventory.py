"""Inventory, Stock Movement Ledger, Adjustments, and Invariant Verification Routes."""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import get_db, settings
from app.models.auth import User
from app.models.core import Product, Location, Lot
from app.models.inventory import (
    StockMovement,
    StockByLocation,
    InventoryAdjustment,
    MovementType,
    AdjustmentStatus
)
from app.schemas.inventory import (
    MovementCreate, MovementRead,
    StockByLocationRead,
    InventoryAdjustmentCreate, InventoryAdjustmentRead,
    InvariantCheckResult
)
from app.services.ledger_service import (
    apply_movement,
    verify_ledger_invariant,
    get_or_create_stock_record
)
from app.api.deps import (
    require_viewer,
    require_worker,
    require_manager,
    get_current_user
)

router = APIRouter(prefix="/inventory", tags=["Inventory & Ledger"])


@router.get("/stock-by-location", response_model=List[StockByLocationRead])
def get_stock_by_location(
    product_id: Optional[int] = Query(None),
    location_id: Optional[int] = Query(None),
    warehouse_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    query = db.query(StockByLocation)
    if product_id:
        query = query.filter(StockByLocation.product_id == product_id)
    if location_id:
        query = query.filter(StockByLocation.location_id == location_id)
    if warehouse_id:
        query = query.join(Location).filter(Location.warehouse_id == warehouse_id)
    return query.all()


@router.get("/movements", response_model=List[MovementRead])
def get_movements(
    product_id: Optional[int] = Query(None),
    location_id: Optional[int] = Query(None),
    movement_type: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    query = db.query(StockMovement).order_by(StockMovement.timestamp.desc())
    if product_id:
        query = query.filter(StockMovement.product_id == product_id)
    if location_id:
        query = query.filter(
            (StockMovement.source_location_id == location_id) |
            (StockMovement.destination_location_id == location_id)
        )
    if movement_type:
        query = query.filter(StockMovement.movement_type == movement_type)
    return query.offset(skip).limit(limit).all()


@router.post("/movements", response_model=MovementRead)
def create_movement(
    movement_in: MovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_worker)
):
    """
    Executes a stock movement strictly through apply_movement()
    guaranteeing atomic ledger updates and row-level locking.
    """
    # Enforce warehouse scope for Warehouse Worker
    if current_user.role.name == "Warehouse Worker" and current_user.warehouse_scope:
        # Check source/destination locations are within worker warehouse
        if movement_in.source_location_id:
            loc = db.query(Location).filter(Location.id == movement_in.source_location_id).first()
            if not loc or loc.warehouse_id != current_user.warehouse_scope:
                raise HTTPException(
                    status_code=403,
                    detail="Workers may only operate within their assigned warehouse"
                )
        if movement_in.destination_location_id:
            loc = db.query(Location).filter(Location.id == movement_in.destination_location_id).first()
            if not loc or loc.warehouse_id != current_user.warehouse_scope:
                raise HTTPException(
                    status_code=403,
                    detail="Workers may only operate within their assigned warehouse"
                )

    try:
        # For inter-location transfers, generate paired movements
        if movement_in.movement_type == MovementType.TRANSFER_IN and movement_in.source_location_id and movement_in.destination_location_id:
            # 1. TRANSFER_OUT at source
            apply_movement(
                db=db,
                product_id=movement_in.product_id,
                movement_type=MovementType.TRANSFER_OUT,
                quantity=movement_in.quantity,
                source_location_id=movement_in.source_location_id,
                destination_location_id=movement_in.destination_location_id,
                lot_id=movement_in.lot_id,
                reference_id=movement_in.reference_id,
                reason=movement_in.reason,
                user_id=current_user.id
            )
            # 2. TRANSFER_IN at destination
            entry = apply_movement(
                db=db,
                product_id=movement_in.product_id,
                movement_type=MovementType.TRANSFER_IN,
                quantity=movement_in.quantity,
                source_location_id=movement_in.source_location_id,
                destination_location_id=movement_in.destination_location_id,
                lot_id=movement_in.lot_id,
                reference_id=movement_in.reference_id,
                reason=movement_in.reason,
                user_id=current_user.id
            )
        else:
            entry = apply_movement(
                db=db,
                product_id=movement_in.product_id,
                movement_type=movement_in.movement_type,
                quantity=movement_in.quantity,
                source_location_id=movement_in.source_location_id,
                destination_location_id=movement_in.destination_location_id,
                lot_id=movement_in.lot_id,
                reference_id=movement_in.reference_id,
                reason=movement_in.reason,
                unit_cost=movement_in.unit_cost,
                user_id=current_user.id
            )
        db.commit()
        db.refresh(entry)
        return entry
    except Exception as e:
        db.rollback()
        raise e


# --- Adjustments & Approvals ---
@router.get("/adjustments", response_model=List[InventoryAdjustmentRead])
def get_adjustments(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    query = db.query(InventoryAdjustment).order_by(InventoryAdjustment.created_at.desc())
    if status:
        query = query.filter(InventoryAdjustment.status == status)
    return query.all()


@router.post("/adjustments", response_model=InventoryAdjustmentRead)
def submit_adjustment(
    adj_in: InventoryAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_worker)
):
    """
    Submits a physical count adjustment.
    If |difference| / recorded_qty > 10% OR |difference| > 50 units:
      flags as PENDING_APPROVAL for Inventory Manager.
    Else:
      auto-approves and applies to ledger immediately.
    """
    stock_record = get_or_create_stock_record(
        db, adj_in.product_id, adj_in.location_id, adj_in.lot_id, for_update=True
    )
    recorded_qty = stock_record.on_hand_qty
    difference = adj_in.counted_qty - recorded_qty

    # Check if threshold is breached
    requires_approval = False
    abs_diff = abs(difference)
    
    if abs_diff > settings.ADJUSTMENT_UNIT_THRESHOLD:
        requires_approval = True
    elif recorded_qty > 0 and (abs_diff / recorded_qty) > settings.ADJUSTMENT_RELATIVE_THRESHOLD:
        requires_approval = True
    elif recorded_qty == 0 and abs_diff > 0:
        requires_approval = True

    # Check if user is manager/admin, they can auto-approve their own
    if current_user.role.name in ["Admin", "Inventory Manager"]:
        requires_approval = False

    adj = InventoryAdjustment(
        product_id=adj_in.product_id,
        location_id=adj_in.location_id,
        lot_id=adj_in.lot_id,
        recorded_qty=recorded_qty,
        counted_qty=adj_in.counted_qty,
        difference=difference,
        reason=adj_in.reason,
        requested_by=current_user.id,
        status=AdjustmentStatus.PENDING_APPROVAL.value if requires_approval else AdjustmentStatus.APPROVED.value,
        approved_by=current_user.id if not requires_approval else None,
        resolved_at=datetime.utcnow() if not requires_approval else None
    )
    db.add(adj)
    db.flush()

    if not requires_approval:
        # Apply immediately to stock ledger
        apply_movement(
            db=db,
            product_id=adj.product_id,
            movement_type=MovementType.ADJUSTMENT,
            quantity=difference,
            destination_location_id=adj.location_id if difference >= 0 else None,
            source_location_id=adj.location_id if difference < 0 else None,
            lot_id=adj.lot_id,
            reference_id=f"ADJ-{adj.id:04d}",
            reason=f"Count adjustment: {adj.reason}",
            user_id=current_user.id
        )

    db.commit()
    db.refresh(adj)
    return adj


@router.post("/adjustments/{adjustment_id}/approve", response_model=InventoryAdjustmentRead)
def approve_adjustment(
    adjustment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    adj = db.query(InventoryAdjustment).filter(InventoryAdjustment.id == adjustment_id).first()
    if not adj:
        raise HTTPException(status_code=404, detail="Adjustment not found")
    if adj.status != AdjustmentStatus.PENDING_APPROVAL.value:
        raise HTTPException(status_code=400, detail=f"Adjustment is already {adj.status}")

    try:
        # Apply adjustment to ledger
        apply_movement(
            db=db,
            product_id=adj.product_id,
            movement_type=MovementType.ADJUSTMENT,
            quantity=adj.difference,
            destination_location_id=adj.location_id if adj.difference >= 0 else None,
            source_location_id=adj.location_id if adj.difference < 0 else None,
            lot_id=adj.lot_id,
            reference_id=f"ADJ-{adj.id:04d}",
            reason=f"Approved adjustment: {adj.reason}",
            user_id=current_user.id
        )
        adj.status = AdjustmentStatus.APPROVED.value
        adj.approved_by = current_user.id
        adj.resolved_at = datetime.utcnow()
        db.add(adj)
        db.commit()
        db.refresh(adj)
        return adj
    except Exception as e:
        db.rollback()
        raise e


@router.post("/adjustments/{adjustment_id}/reject", response_model=InventoryAdjustmentRead)
def reject_adjustment(
    adjustment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    adj = db.query(InventoryAdjustment).filter(InventoryAdjustment.id == adjustment_id).first()
    if not adj:
        raise HTTPException(status_code=404, detail="Adjustment not found")
    if adj.status != AdjustmentStatus.PENDING_APPROVAL.value:
        raise HTTPException(status_code=400, detail=f"Adjustment is already {adj.status}")

    adj.status = AdjustmentStatus.REJECTED.value
    adj.approved_by = current_user.id
    adj.resolved_at = datetime.utcnow()
    db.add(adj)
    db.commit()
    db.refresh(adj)
    return adj


@router.get("/invariant-check", response_model=InvariantCheckResult)
def check_invariant(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    """
    Automated verification of the fundamental ledger invariant:
    StockByLocation.on_hand_qty == signed sum(StockMovement rows)
    """
    stock_records = db.query(StockByLocation).all()
    discrepancies = []
    
    for record in stock_records:
        # Sum inbound
        inbound = db.query(func.coalesce(func.sum(StockMovement.quantity), 0.0)).filter(
            StockMovement.product_id == record.product_id,
            StockMovement.destination_location_id == record.location_id,
            StockMovement.lot_id == record.lot_id if record.lot_id is not None else True,
            StockMovement.quantity > 0
        ).scalar() or 0.0
        
        # Sum outbound
        outbound = db.query(func.coalesce(func.sum(StockMovement.quantity), 0.0)).filter(
            StockMovement.product_id == record.product_id,
            StockMovement.source_location_id == record.location_id,
            StockMovement.lot_id == record.lot_id if record.lot_id is not None else True,
            StockMovement.quantity < 0
        ).scalar() or 0.0
        
        calculated = round(inbound + outbound, 4)
        recorded = round(record.on_hand_qty, 4)
        
        if calculated != recorded:
            discrepancies.append({
                "product_id": record.product_id,
                "location_id": record.location_id,
                "lot_id": record.lot_id,
                "recorded_on_hand": recorded,
                "calculated_from_ledger": calculated,
                "discrepancy": round(recorded - calculated, 4)
            })

    return {
        "is_valid": len(discrepancies) == 0,
        "total_locations_checked": len(stock_records),
        "discrepancies": discrepancies
    }
