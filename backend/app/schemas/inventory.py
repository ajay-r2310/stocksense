"""Pydantic schemas for Inventory, Ledger, and Adjustments."""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.inventory import MovementType, AdjustmentStatus
from app.schemas.core import ProductRead, LocationRead, LotRead, UserRead


class MovementCreate(BaseModel):
    product_id: int
    movement_type: MovementType
    quantity: float = Field(..., gt=0, description="Positive quantity magnitude")
    source_location_id: Optional[int] = None
    destination_location_id: Optional[int] = None
    lot_id: Optional[int] = None
    reference_id: Optional[str] = None
    reason: Optional[str] = None
    unit_cost: Optional[float] = None


class MovementRead(BaseModel):
    id: int
    product_id: int
    lot_id: Optional[int] = None
    source_location_id: Optional[int] = None
    destination_location_id: Optional[int] = None
    quantity: float
    movement_type: str
    reference_id: Optional[str] = None
    reason: Optional[str] = None
    unit_cost: Optional[float] = None
    user_id: Optional[int] = None
    timestamp: datetime
    
    product: Optional[ProductRead] = None
    source_location: Optional[LocationRead] = None
    destination_location: Optional[LocationRead] = None
    lot: Optional[LotRead] = None

    class Config:
        from_attributes = True


class StockByLocationRead(BaseModel):
    id: int
    product_id: int
    location_id: int
    lot_id: Optional[int] = None
    on_hand_qty: float
    reserved_qty: float
    available_qty: float
    
    product: Optional[ProductRead] = None
    location: Optional[LocationRead] = None
    lot: Optional[LotRead] = None

    class Config:
        from_attributes = True


class InventoryAdjustmentCreate(BaseModel):
    product_id: int
    location_id: int
    lot_id: Optional[int] = None
    counted_qty: float = Field(..., ge=0)
    reason: str


class InventoryAdjustmentRead(BaseModel):
    id: int
    product_id: int
    location_id: int
    lot_id: Optional[int] = None
    recorded_qty: float
    counted_qty: float
    difference: float
    reason: str
    requested_by: int
    approved_by: Optional[int] = None
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    
    product: Optional[ProductRead] = None
    location: Optional[LocationRead] = None
    requester: Optional[UserRead] = None
    approver: Optional[UserRead] = None

    class Config:
        from_attributes = True


class InvariantCheckResult(BaseModel):
    is_valid: bool
    total_locations_checked: int
    discrepancies: List[dict] = []
