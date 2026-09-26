"""Stock Movement Ledger, StockByLocation Cache, and Inventory Adjustment Models."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Index, UniqueConstraint
import enum
from sqlalchemy.orm import relationship
from app.core.config import Base


class MovementType(str, enum.Enum):
    RECEIPT = "RECEIPT"
    DELIVERY = "DELIVERY"
    TRANSFER_IN = "TRANSFER_IN"
    TRANSFER_OUT = "TRANSFER_OUT"
    RETURN_IN = "RETURN_IN"
    RETURN_OUT = "RETURN_OUT"
    ADJUSTMENT = "ADJUSTMENT"


class AdjustmentStatus(str, enum.Enum):
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"


class StockMovement(Base):
    """
    Append-Only Ledger Table (Single Source of Truth).
    Every stock change in the entire system MUST write a row here.
    Quantity is signed magnitude relative to the location:
      - Positive when adding stock to location
      - Negative when removing stock from location
    Or for inter-location transfers, two rows: TRANSFER_OUT (-qty) at source, TRANSFER_IN (+qty) at destination.
    """
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    lot_id = Column(Integer, ForeignKey("lots.id"), nullable=True, index=True)
    source_location_id = Column(Integer, ForeignKey("locations.id"), nullable=True, index=True)
    destination_location_id = Column(Integer, ForeignKey("locations.id"), nullable=True, index=True)
    
    # Signed quantity: + for inbound/receipt/return_in, - for outbound/delivery/return_out
    quantity = Column(Float, nullable=False)
    
    movement_type = Column(String(50), nullable=False, index=True)  # MovementType values
    reference_id = Column(String(100), nullable=True, index=True)  # PO-123, SO-456, TR-789, ADJ-001
    reason = Column(String(255), nullable=True)
    unit_cost = Column(Float, nullable=True)  # Cost per unit for receipt valuation
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    product = relationship("Product")
    lot = relationship("Lot")
    source_location = relationship("Location", foreign_keys=[source_location_id])
    destination_location = relationship("Location", foreign_keys=[destination_location_id])
    user = relationship("User")


class StockByLocation(Base):
    """
    Derived Read-Optimization Cache.
    Represents current stock state at (product, location, lot).
    Authoritative truth is always reproducible by replaying StockMovement rows.
    """
    __tablename__ = "stock_by_locations"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)
    lot_id = Column(Integer, ForeignKey("lots.id"), nullable=True, index=True)
    
    on_hand_qty = Column(Float, default=0.0, nullable=False)
    reserved_qty = Column(Float, default=0.0, nullable=False)

    __table_args__ = (
        UniqueConstraint("product_id", "location_id", "lot_id", name="uq_product_location_lot"),
        Index("idx_stock_lookup", "product_id", "location_id"),
    )

    product = relationship("Product")
    location = relationship("Location")
    lot = relationship("Lot")

    @property
    def available_qty(self) -> float:
        return max(0.0, self.on_hand_qty - self.reserved_qty)


class InventoryAdjustment(Base):
    """
    Inventory Adjustment workflow with approval gate.
    Adjustments above threshold require manager sign-off before applying to ledger.
    """
    __tablename__ = "inventory_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)
    lot_id = Column(Integer, ForeignKey("lots.id"), nullable=True)
    recorded_qty = Column(Float, nullable=False)
    counted_qty = Column(Float, nullable=False)
    difference = Column(Float, nullable=False)  # counted_qty - recorded_qty
    reason = Column(String(255), nullable=False)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(50), default=AdjustmentStatus.PENDING_APPROVAL.value, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    product = relationship("Product")
    location = relationship("Location")
    requester = relationship("User", foreign_keys=[requested_by])
    approver = relationship("User", foreign_keys=[approved_by])
