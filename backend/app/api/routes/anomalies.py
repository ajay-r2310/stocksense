"""Anomaly Detection and Known Events REST API Endpoints."""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.models.auth import User
from app.models.core import Product
from app.models.intelligence import KnownEvent, AnomalyRecord
from app.api.deps import require_viewer, require_manager, require_admin
from app.services.anomaly_service import (
    compute_ewma_baseline_and_anomalies,
    run_and_persist_anomaly_detection,
)

router = APIRouter(prefix="/anomalies", tags=["Anomalies & Known Events"])


class KnownEventCreate(BaseModel):
    name: str
    start_date: datetime
    end_date: datetime
    description: Optional[str] = None


@router.get("")
def list_anomalies(
    product_id: Optional[int] = Query(None),
    unacknowledged_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """Returns detected EWMA ±3σ anomalies with full explainability context."""
    query = db.query(AnomalyRecord)
    if product_id:
        query = query.filter(AnomalyRecord.product_id == product_id)
    if unacknowledged_only:
        query = query.filter(AnomalyRecord.is_acknowledged == 0)

    records = query.order_by(AnomalyRecord.event_date.desc()).all()

    results = []
    for r in records:
        prod = db.query(Product).filter(Product.id == r.product_id).first()
        results.append({
            "id": r.id,
            "product_id": r.product_id,
            "product_name": prod.name if prod else "Unknown",
            "sku": prod.sku if prod else "N/A",
            "uom": prod.uom.symbol if (prod and prod.uom) else "units",
            "event_date": r.event_date.isoformat(),
            "detected_at": r.detected_at.isoformat() if r.detected_at else None,
            "actual_quantity": r.actual_quantity,
            "expected_ewma": r.expected_ewma,
            "std_dev": r.std_dev,
            "z_score": r.z_score,
            "deviation_percentage": r.deviation_percentage,
            "anomaly_type": r.anomaly_type,
            "possible_causes": r.possible_causes.split(" | ") if r.possible_causes else [],
            "is_acknowledged": bool(r.is_acknowledged),
            "acknowledged_at": r.acknowledged_at.isoformat() if r.acknowledged_at else None,
        })
    return results


@router.post("/detect")
def trigger_anomaly_detection(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    """Triggers an on-demand statistical anomaly detection scan across all active SKUs."""
    records = run_and_persist_anomaly_detection(db)
    return {
        "status": "success",
        "scanned_records_count": len(records),
        "message": f"Statistical EWMA scan complete. {len(records)} anomalies recorded in feed.",
    }


@router.post("/{anomaly_id}/acknowledge")
def acknowledge_anomaly(
    anomaly_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    """Allows Inventory Managers to acknowledge and resolve an anomaly entry."""
    rec = db.query(AnomalyRecord).filter(AnomalyRecord.id == anomaly_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Anomaly record not found.")

    rec.is_acknowledged = 1
    rec.acknowledged_by = current_user.id
    rec.acknowledged_at = datetime.utcnow()
    db.commit()

    return {"status": "success", "message": f"Anomaly #{anomaly_id} successfully acknowledged."}


# Known Events Endpoints
@router.get("/known-events")
def list_known_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """Lists all registered Known Events (festivals, promotions, bulk dispatches)."""
    events = db.query(KnownEvent).order_by(KnownEvent.start_date.desc()).all()
    return [
        {
            "id": e.id,
            "name": e.name,
            "start_date": e.start_date.isoformat(),
            "end_date": e.end_date.isoformat(),
            "description": e.description,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]


@router.post("/known-events", status_code=status.HTTP_201_CREATED)
def create_known_event(
    event_in: KnownEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    """Registers a new Known Event window to exclude surges from EWMA baselines."""
    if event_in.end_date < event_in.start_date:
        raise HTTPException(status_code=400, detail="end_date cannot be before start_date.")

    event = KnownEvent(
        name=event_in.name,
        start_date=event_in.start_date,
        end_date=event_in.end_date,
        description=event_in.description,
        created_by=current_user.id,
        created_at=datetime.utcnow(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    return {
        "id": event.id,
        "name": event.name,
        "start_date": event.start_date.isoformat(),
        "end_date": event.end_date.isoformat(),
        "description": event.description,
    }
