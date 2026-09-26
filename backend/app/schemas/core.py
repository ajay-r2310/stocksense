"""Pydantic schemas for authentication and core entities."""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    user: "UserRead"


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role_id: int
    warehouse_scope: Optional[int] = None


class UserCreate(UserBase):
    password: str


class RoleRead(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class UserRead(UserBase):
    id: int
    created_at: datetime
    role: Optional[RoleRead] = None

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: str
    password: str


# Core Entities Schemas
class CategoryBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    pass


class CategoryRead(CategoryBase):
    id: int

    class Config:
        from_attributes = True


class UnitOfMeasureBase(BaseModel):
    name: str
    symbol: str
    category: Optional[str] = None


class UnitOfMeasureCreate(UnitOfMeasureBase):
    pass


class UnitOfMeasureRead(UnitOfMeasureBase):
    id: int

    class Config:
        from_attributes = True


class WarehouseBase(BaseModel):
    name: str
    code: str
    address: Optional[str] = None


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseRead(WarehouseBase):
    id: int

    class Config:
        from_attributes = True


class LocationBase(BaseModel):
    warehouse_id: int
    name: str
    parent_location_id: Optional[int] = None


class LocationCreate(LocationBase):
    pass


class LocationRead(LocationBase):
    id: int

    class Config:
        from_attributes = True


class SupplierBase(BaseModel):
    name: str
    contact_info: Optional[str] = None
    default_lead_time_days: int = 7
    reliability_score: float = 1.0


class SupplierCreate(SupplierBase):
    pass


class SupplierRead(SupplierBase):
    id: int

    class Config:
        from_attributes = True


class LotBase(BaseModel):
    product_id: int
    lot_number: str
    expiry_date: Optional[datetime] = None


class LotCreate(LotBase):
    pass


class LotRead(LotBase):
    id: int
    received_date: datetime

    class Config:
        from_attributes = True


class ProductBase(BaseModel):
    name: str
    sku: str
    category_id: int
    base_uom_id: int
    purchase_uom_id: Optional[int] = None
    uom_conversion_factor: float = 1.0
    primary_supplier_id: Optional[int] = None
    reorder_level: float = 10.0
    safety_stock: float = 5.0
    average_cost: float = 0.0
    is_lot_tracked: bool = False


class ProductCreate(ProductBase):
    pass


class ProductRead(ProductBase):
    id: int
    created_at: datetime
    updated_at: datetime
    category: Optional[CategoryRead] = None
    base_uom: Optional[UnitOfMeasureRead] = None
    purchase_uom: Optional[UnitOfMeasureRead] = None
    primary_supplier: Optional[SupplierRead] = None

    class Config:
        from_attributes = True
