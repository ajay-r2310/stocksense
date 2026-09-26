"""Notification and Simulated Email Log Models."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.config import Base


class Notification(Base):
    """In-app alert notification record for users/managers."""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # Nullable for system-wide broadcast
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), nullable=False, index=True)  # LOW_STOCK, PREDICTED_STOCKOUT, ANOMALY_DETECTED, ADJUSTMENT_PENDING
    severity = Column(String(20), default="INFO", index=True)  # INFO, WARNING, CRITICAL
    reference_type = Column(String(50), nullable=True)  # PRODUCT, ORDER, ADJUSTMENT, ANOMALY
    reference_id = Column(String(100), nullable=True)
    is_read = Column(Integer, default=0, index=True)  # 0: Unread, 1: Read
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = relationship("User")


class SimulatedEmailLog(Base):
    """Audit log of simulated outbound email dispatches for manager alerts."""
    __tablename__ = "simulated_email_logs"

    id = Column(Integer, primary_key=True, index=True)
    recipient_email = Column(String(150), nullable=False, index=True)
    recipient_name = Column(String(100), nullable=True)
    subject = Column(String(255), nullable=False)
    body_text = Column(Text, nullable=False)
    trigger_event = Column(String(100), nullable=False)
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
