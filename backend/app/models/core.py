"""Core Master Data Models."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.config import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(String(255), nullable=True)

    products = relationship("Product", back_populates="category")


class UnitOfMeasure(Base):
    __tablename__ = "units_of_measure"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)  # e.g., Pieces, Box of 24, Kilograms
    symbol = Column(String(20), nullable=False)            # e.g., pcs, box, kg
    category = Column(String(50), nullable=True)           # e.g., Unit, Weight, Volume


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(50), unique=True, nullable=False, index=True)
    address = Column(String(255), nullable=True)

    locations = relationship("Location", back_populates="warehouse", cascade="all, delete-orphan")


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)  # e.g., RACK-A1, BIN-04, ZONE-INBOUND
    parent_location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)

    warehouse = relationship("Warehouse", back_populates="locations")
    children = relationship("Location", backref="parent", remote_side=[id])


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), unique=True, nullable=False, index=True)
    contact_info = Column(String(255), nullable=True)
    default_lead_time_days = Column(Integer, default=7, nullable=False)
    reliability_score = Column(Float, default=1.0, nullable=False)  # % delivered on-time (0.0 to 1.0 or 100)

    products = relationship("Product", back_populates="primary_supplier")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    sku = Column(String(100), unique=True, nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False, index=True)
    base_uom_id = Column(Integer, ForeignKey("units_of_measure.id"), nullable=False)
    purchase_uom_id = Column(Integer, ForeignKey("units_of_measure.id"), nullable=True)
    uom_conversion_factor = Column(Float, default=1.0, nullable=False)  # e.g., 1 purchase_uom = N base_uom
    primary_supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    reorder_level = Column(Float, default=10.0, nullable=False)
    safety_stock = Column(Float, default=5.0, nullable=False)
    average_cost = Column(Float, default=0.0, nullable=False)  # Weighted average cost
    is_lot_tracked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    category = relationship("Category", back_populates="products")
    base_uom = relationship("UnitOfMeasure", foreign_keys=[base_uom_id])
    purchase_uom = relationship("UnitOfMeasure", foreign_keys=[purchase_uom_id])
    primary_supplier = relationship("Supplier", back_populates="products")
    lots = relationship("Lot", back_populates="product", cascade="all, delete-orphan")


class Lot(Base):
    __tablename__ = "lots"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    lot_number = Column(String(100), nullable=False, index=True)
    expiry_date = Column(DateTime, nullable=True, index=True)
    received_date = Column(DateTime, default=datetime.utcnow, nullable=False)

    product = relationship("Product", back_populates="lots")
