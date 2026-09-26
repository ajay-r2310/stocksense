"""Prediction Log and Intelligence Layer Models."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.config import Base


class PredictionLog(Base):
    """
    Tracks predicted vs. actual stockout dates and demand metrics.
    Surfaces system prediction accuracy over time.
    """
    __tablename__ = "prediction_logs"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    predicted_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Predicted metrics
    predicted_demand_daily = Column(Float, nullable=False)
    predicted_stockout_date = Column(DateTime, nullable=True)
    predicted_days_remaining = Column(Float, nullable=True)
    risk_tier = Column(String(50), nullable=True)  # LOW, MEDIUM, HIGH
    shortage_score = Column(Float, nullable=True)  # 0 to 100
    
    # Actual outcome (filled in later by scheduled evaluation job)
    actual_stockout_date = Column(DateTime, nullable=True)
    actual_demand_daily = Column(Float, nullable=True)
    accuracy_percentage = Column(Float, nullable=True)  # Model accuracy calculation
    resolved_at = Column(DateTime, nullable=True)

    product = relationship("Product")


class KnownEvent(Base):
    """
    Known Event Windows (e.g., Festival Sale, Black Friday, Bulk Order).
    Excludes movement surges during these dates from EWMA anomaly baselines.
    """
    __tablename__ = "known_events"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    start_date = Column(DateTime, nullable=False, index=True)
    end_date = Column(DateTime, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    creator = relationship("User")


class AnomalyRecord(Base):
    """
    Detected demand or movement anomalies using EWMA ±3σ statistical bounds.
    """
    __tablename__ = "anomaly_records"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    event_date = Column(DateTime, nullable=False, index=True)
    detected_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    actual_quantity = Column(Float, nullable=False)
    expected_ewma = Column(Float, nullable=False)
    std_dev = Column(Float, nullable=False)
    z_score = Column(Float, nullable=False)
    deviation_percentage = Column(Float, nullable=False)
    anomaly_type = Column(String(50), default="SURGE")  # SURGE, DROP
    
    # Explainable contextual bullets
    possible_causes = Column(String(500), nullable=True)
    
    is_acknowledged = Column(Integer, default=0)  # 0: Unacknowledged, 1: Acknowledged
    acknowledged_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)

    product = relationship("Product")
    acknowledger = relationship("User", foreign_keys=[acknowledged_by])

