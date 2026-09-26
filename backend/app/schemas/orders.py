"""Pydantic schemas for Orders (PO, SO, Returns)."""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.orders import POStatus, SOStatus, ReturnType, ReturnStatus
from app.schemas.core import ProductRead, SupplierRead, WarehouseRead, LocationRead


class POLineCreate(BaseModel):
    product_id: int
    ordered_qty: float = Field(..., gt=0)
    unit_cost: float = Field(..., ge=0)


class POLineRead(BaseModel):
    id: int
    purchase_order_id: int
    product_id: int
    ordered_qty: float
    received_qty: float
    unit_cost: float
    product: Optional[ProductRead] = None

    class Config:
        from_attributes = True


class POCreate(BaseModel):
    supplier_id: int
    warehouse_id: int
    expected_date: Optional[datetime] = None
    lines: List[POLineCreate]


class PORead(BaseModel):
    id: int
    po_number: str
    supplier_id: int
    warehouse_id: int
    status: str
    expected_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    supplier: Optional[SupplierRead] = None
    warehouse: Optional[WarehouseRead] = None
    lines: List[POLineRead] = []

    class Config:
        from_attributes = True


class SOLineCreate(BaseModel):
    product_id: int
    ordered_qty: float = Field(..., gt=0)
    unit_price: float = Field(..., ge=0)


class SOLineRead(BaseModel):
    id: int
    sales_order_id: int
    product_id: int
    ordered_qty: float
    delivered_qty: float
    unit_price: float
    product: Optional[ProductRead] = None

    class Config:
        from_attributes = True


class SOCreate(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str
    warehouse_id: int
    expected_delivery_date: Optional[datetime] = None
    lines: List[SOLineCreate]


class SORead(BaseModel):
    id: int
    so_number: str
    customer_id: Optional[str] = None
    customer_name: str
    warehouse_id: int
    status: str
    expected_delivery_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    warehouse: Optional[WarehouseRead] = None
    lines: List[SOLineRead] = []

    class Config:
        from_attributes = True


class ReturnLineCreate(BaseModel):
    product_id: int
    qty: float = Field(..., gt=0)
    reason: Optional[str] = None


class ReturnLineRead(BaseModel):
    id: int
    return_order_id: int
    product_id: int
    qty: float
    reason: Optional[str] = None
    product: Optional[ProductRead] = None

    class Config:
        from_attributes = True


class ReturnOrderCreate(BaseModel):
    type: ReturnType
    reference_order_id: Optional[str] = None
    warehouse_id: int
    lines: List[ReturnLineCreate]


class ReturnOrderRead(BaseModel):
    id: int
    return_number: str
    type: str
    reference_order_id: Optional[str] = None
    warehouse_id: int
    status: str
    created_at: datetime
    lines: List[ReturnLineRead] = []

    class Config:
        from_attributes = True
