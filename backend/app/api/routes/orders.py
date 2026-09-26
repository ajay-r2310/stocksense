"""Purchase Orders, Sales Orders, and Returns API Routes."""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.models.auth import User
from app.models.core import Product, Supplier, Warehouse, Location
from app.models.orders import (
    PurchaseOrder, PurchaseOrderLine,
    SalesOrder, SalesOrderLine,
    ReturnOrder, ReturnOrderLine,
    POStatus, SOStatus, ReturnType, ReturnStatus
)
from app.models.inventory import MovementType
from app.schemas.orders import (
    POCreate, PORead, POLineRead,
    SOCreate, SORead, SOLineRead,
    ReturnOrderCreate, ReturnOrderRead
)
from app.services.ledger_service import (
    apply_movement,
    reserve_stock,
    release_stock_reservation,
    get_or_create_stock_record
)
from app.api.deps import require_viewer, require_manager, require_worker, get_current_user

router = APIRouter(prefix="/orders", tags=["Orders & Fulfillment"])


# ==================== PURCHASE ORDERS ====================

@router.get("/purchase-orders", response_model=List[PORead])
def list_purchase_orders(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    query = db.query(PurchaseOrder).order_by(PurchaseOrder.created_at.desc())
    if status:
        query = query.filter(PurchaseOrder.status == status)
    return query.all()


@router.post("/purchase-orders", response_model=PORead)
def create_purchase_order(
    po_in: POCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    count = db.query(PurchaseOrder).count() + 1
    po_number = f"PO-{count:05d}"
    
    po = PurchaseOrder(
        po_number=po_number,
        supplier_id=po_in.supplier_id,
        warehouse_id=po_in.warehouse_id,
        expected_date=po_in.expected_date,
        created_by=current_user.id,
        status=POStatus.DRAFT.value
    )
    db.add(po)
    db.flush()

    for line in po_in.lines:
        po_line = PurchaseOrderLine(
            purchase_order_id=po.id,
            product_id=line.product_id,
            ordered_qty=line.ordered_qty,
            received_qty=0.0,
            unit_cost=line.unit_cost
        )
        db.add(po_line)

    db.commit()
    db.refresh(po)
    return po


@router.post("/purchase-orders/{po_id}/confirm", response_model=PORead)
def confirm_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.status != POStatus.DRAFT.value:
        raise HTTPException(status_code=400, detail="Only DRAFT orders can be confirmed")

    po.status = POStatus.CONFIRMED.value
    db.add(po)
    db.commit()
    db.refresh(po)
    return po


@router.post("/purchase-orders/{po_id}/receive", response_model=PORead)
def receive_purchase_order(
    po_id: int,
    destination_location_id: int,
    receipt_items: List[dict],  # [{product_id: 1, qty: 10, lot_id: optional}]
    db: Session = Depends(get_db),
    current_user: User = Depends(require_worker)
):
    """
    Receives physical stock against a PO.
    Supports partial fulfillment.
    Writes strictly to append-only StockMovement ledger via apply_movement().
    Updates product weighted-average cost.
    """
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.status not in [POStatus.CONFIRMED.value, POStatus.PARTIAL.value]:
        raise HTTPException(status_code=400, detail="PO must be confirmed or partial to receive items")

    try:
        for item in receipt_items:
            product_id = item["product_id"]
            qty = float(item["qty"])
            lot_id = item.get("lot_id")

            # Match with PO line
            line = db.query(PurchaseOrderLine).filter(
                PurchaseOrderLine.purchase_order_id == po.id,
                PurchaseOrderLine.product_id == product_id
            ).first()
            if not line:
                raise HTTPException(status_code=400, detail=f"Product {product_id} not in PO lines")

            # Apply movement via single source of truth ledger
            apply_movement(
                db=db,
                product_id=product_id,
                movement_type=MovementType.RECEIPT,
                quantity=qty,
                destination_location_id=destination_location_id,
                lot_id=lot_id,
                reference_id=po.po_number,
                unit_cost=line.unit_cost,
                user_id=current_user.id
            )

            line.received_qty += qty
            db.add(line)

        # Update PO overall status
        db.flush()
        all_lines = db.query(PurchaseOrderLine).filter(PurchaseOrderLine.purchase_order_id == po.id).all()
        is_all_done = all(l.received_qty >= l.ordered_qty for l in all_lines)
        po.status = POStatus.DONE.value if is_all_done else POStatus.PARTIAL.value
        db.add(po)
        
        db.commit()
        db.refresh(po)
        return po
    except Exception as e:
        db.rollback()
        raise e


# ==================== SALES ORDERS ====================

@router.get("/sales-orders", response_model=List[SORead])
def list_sales_orders(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    query = db.query(SalesOrder).order_by(SalesOrder.created_at.desc())
    if status:
        query = query.filter(SalesOrder.status == status)
    return query.all()


@router.post("/sales-orders", response_model=SORead)
def create_sales_order(
    so_in: SOCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    count = db.query(SalesOrder).count() + 1
    so_number = f"SO-{count:05d}"
    
    so = SalesOrder(
        so_number=so_number,
        customer_id=so_in.customer_id,
        customer_name=so_in.customer_name,
        warehouse_id=so_in.warehouse_id,
        expected_delivery_date=so_in.expected_delivery_date,
        created_by=current_user.id,
        status=SOStatus.DRAFT.value
    )
    db.add(so)
    db.flush()

    for line in so_in.lines:
        so_line = SalesOrderLine(
            sales_order_id=so.id,
            product_id=line.product_id,
            ordered_qty=line.ordered_qty,
            delivered_qty=0.0,
            unit_price=line.unit_price
        )
        db.add(so_line)

    db.commit()
    db.refresh(so)
    return so


@router.post("/sales-orders/{so_id}/confirm", response_model=SORead)
def confirm_sales_order(
    so_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """
    Confirms a Sales Order and automatically reserves available stock at warehouse locations.
    """
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so:
        raise HTTPException(status_code=404, detail="Sales order not found")
    if so.status != SOStatus.DRAFT.value:
        raise HTTPException(status_code=400, detail="Only DRAFT orders can be confirmed")

    try:
        # Reserve stock for each line
        for line in so.lines:
            # Find locations in warehouse with stock for this product
            locations = db.query(Location).filter(Location.warehouse_id == so.warehouse_id).all()
            needed = line.ordered_qty
            for loc in locations:
                if needed <= 0:
                    break
                reserved = reserve_stock(db, line.product_id, loc.id, needed)
                needed -= reserved

        so.status = SOStatus.CONFIRMED.value
        db.add(so)
        db.commit()
        db.refresh(so)
        return so
    except Exception as e:
        db.rollback()
        raise e


@router.post("/sales-orders/{so_id}/deliver", response_model=SORead)
def deliver_sales_order(
    so_id: int,
    source_location_id: int,
    delivery_items: List[dict],  # [{product_id: 1, qty: 5, lot_id: optional}]
    db: Session = Depends(get_db),
    current_user: User = Depends(require_worker)
):
    """
    Delivers items against an SO:
    - Writes DELIVERY movement to StockMovement
    - Decreases on_hand_qty and releases reserved_qty
    """
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so:
        raise HTTPException(status_code=404, detail="Sales order not found")
    if so.status not in [SOStatus.CONFIRMED.value, SOStatus.PARTIAL.value]:
        raise HTTPException(status_code=400, detail="SO must be confirmed or partial to deliver")

    try:
        for item in delivery_items:
            product_id = item["product_id"]
            qty = float(item["qty"])
            lot_id = item.get("lot_id")

            line = db.query(SalesOrderLine).filter(
                SalesOrderLine.sales_order_id == so.id,
                SalesOrderLine.product_id == product_id
            ).first()
            if not line:
                raise HTTPException(status_code=400, detail=f"Product {product_id} not in SO lines")

            # Outbound delivery movement
            apply_movement(
                db=db,
                product_id=product_id,
                movement_type=MovementType.DELIVERY,
                quantity=qty,
                source_location_id=source_location_id,
                lot_id=lot_id,
                reference_id=so.so_number,
                user_id=current_user.id
            )

            # Release reservation
            release_stock_reservation(db, product_id, source_location_id, qty, lot_id)

            line.delivered_qty += qty
            db.add(line)

        # Update SO status
        db.flush()
        all_lines = db.query(SalesOrderLine).filter(SalesOrderLine.sales_order_id == so.id).all()
        is_all_done = all(l.delivered_qty >= l.ordered_qty for l in all_lines)
        so.status = SOStatus.DONE.value if is_all_done else SOStatus.PARTIAL.value
        db.add(so)

        db.commit()
        db.refresh(so)
        return so
    except Exception as e:
        db.rollback()
        raise e


@router.post("/sales-orders/{so_id}/cancel", response_model=SORead)
def cancel_sales_order(
    so_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so:
        raise HTTPException(status_code=404, detail="Sales order not found")
    if so.status == SOStatus.DONE.value:
        raise HTTPException(status_code=400, detail="Cannot cancel completed SO")

    try:
        # Release all reserved stock
        locations = db.query(Location).filter(Location.warehouse_id == so.warehouse_id).all()
        for line in so.lines:
            unfulfilled = max(0.0, line.ordered_qty - line.delivered_qty)
            for loc in locations:
                release_stock_reservation(db, line.product_id, loc.id, unfulfilled)

        so.status = SOStatus.CANCELLED.value
        db.add(so)
        db.commit()
        db.refresh(so)
        return so
    except Exception as e:
        db.rollback()
        raise e
