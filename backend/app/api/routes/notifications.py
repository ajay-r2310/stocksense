"""Notification and Email Alerts REST API Routes."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.models.auth import User
from app.models.notifications import Notification, SimulatedEmailLog
from app.api.deps import require_viewer, require_manager
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications & Alerts"])


@router.get("")
def list_notifications(
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """Lists in-app notifications for the active user."""
    query = db.query(Notification)
    if unread_only:
        query = query.filter(Notification.is_read == 0)

    # Return newest first
    notifs = query.order_by(Notification.created_at.desc()).limit(50).all()
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "notification_type": n.notification_type,
            "severity": n.severity,
            "reference_type": n.reference_type,
            "reference_id": n.reference_id,
            "is_read": bool(n.is_read),
            "created_at": n.created_at.isoformat(),
        }
        for n in notifs
    ]


@router.post("/{notification_id}/read")
def mark_notification_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """Marks a specific notification as read."""
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")

    notif.is_read = 1
    db.commit()
    return {"status": "success", "id": notification_id, "is_read": True}


@router.post("/scan")
def trigger_alert_scan(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    """Triggers an immediate scan of low-stock, predicted stockouts, anomalies, and adjustments."""
    return NotificationService.scan_and_generate_system_alerts(db)


@router.get("/simulated-emails")
def list_simulated_emails(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    """Audits simulated outbound email dispatches sent to managers."""
    logs = db.query(SimulatedEmailLog).order_by(SimulatedEmailLog.sent_at.desc()).limit(50).all()
    return [
        {
            "id": l.id,
            "recipient_email": l.recipient_email,
            "recipient_name": l.recipient_name,
            "subject": l.subject,
            "body_text": l.body_text,
            "trigger_event": l.trigger_event,
            "sent_at": l.sent_at.isoformat(),
        }
        for l in logs
    ]
