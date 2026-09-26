"""
StockSense Notification & Alerting Engine.

Provides in-app notification dispatching, simulated email dispatch logging,
and an alert scanning pipeline for low stock, 48h stockout horizons, EWMA anomalies,
and pending manager adjustment approvals.
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.auth import User, Role
from app.models.core import Product
from app.models.inventory import StockByLocation, InventoryAdjustment, AdjustmentStatus
from app.models.intelligence import AnomalyRecord
from app.models.notifications import Notification, SimulatedEmailLog
from app.services.forecasting_service import get_stockout_prediction


class NotificationService:
    @staticmethod
    def send_notification(
        db: Session,
        title: str,
        message: str,
        notification_type: str,
        severity: str = "INFO",
        reference_type: Optional[str] = None,
        reference_id: Optional[str] = None,
        user_id: Optional[int] = None,
        simulate_email: bool = True,
    ) -> Notification:
        """
        Creates an in-app notification row and optionally dispatches a simulated email to managers.
        """
        notif = Notification(
            title=title,
            message=message,
            notification_type=notification_type,
            severity=severity,
            reference_type=reference_type,
            reference_id=reference_id,
            user_id=user_id,
            created_at=datetime.utcnow(),
            is_read=0,
        )
        db.add(notif)

        if simulate_email:
            # Query all inventory managers and admins
            managers = (
                db.query(User)
                .join(Role)
                .filter(Role.name.in_(["Admin", "Inventory Manager"]))
                .all()
            )
            for m in managers:
                email_log = SimulatedEmailLog(
                    recipient_email=m.email,
                    recipient_name=m.name,
                    subject=f"[StockSense Alert] {title}",
                    body_text=f"Hello {m.name},\n\n{message}\n\nSeverity: {severity}\nType: {notification_type}\nTimestamp: {datetime.utcnow().isoformat()}\n\n-- StockSense Automated Dispatch",
                    trigger_event=notification_type,
                    sent_at=datetime.utcnow(),
                )
                db.add(email_log)

        db.commit()
        db.refresh(notif)
        return notif

    @staticmethod
    def scan_and_generate_system_alerts(db: Session) -> Dict[str, Any]:
        """
        Scans all 4 alert conditions:
        1. Low stock crossed (available <= reorder_level)
        2. Stockout predicted within 48h (days_remaining <= 2.0)
        3. Statistical anomalies detected
        4. Adjustment pending approval
        """
        generated = []

        # 1. Low Stock Check
        products = db.query(Product).all()
        for p in products:
            stock_records = db.query(StockByLocation).filter(StockByLocation.product_id == p.id).all()
            avail = sum(max(0, s.on_hand_qty - s.reserved_qty) for s in stock_records)
            reorder_lvl = float(p.reorder_level or 10.0)

            if avail <= reorder_lvl and avail > 0:
                # Check if recent alert already logged today
                existing = (
                    db.query(Notification)
                    .filter(
                        Notification.notification_type == "LOW_STOCK",
                        Notification.reference_id == str(p.id),
                        Notification.created_at >= datetime.utcnow() - timedelta(hours=12),
                    )
                    .first()
                )
                if not existing:
                    notif = NotificationService.send_notification(
                        db=db,
                        title=f"Low Stock Threshold Crossed: {p.name}",
                        message=f"Available stock ({avail:.1f} {p.base_uom.symbol if p.base_uom else 'units'}) has breached the configured reorder level of {reorder_lvl:.1f}.",
                        notification_type="LOW_STOCK",
                        severity="WARNING",
                        reference_type="PRODUCT",
                        reference_id=str(p.id),
                    )
                    generated.append(notif)

            # 2. Predicted Stockout within 48 hours
            try:
                pred = get_stockout_prediction(db, p.id)
                if pred["days_remaining"] <= 2.0 and pred["days_remaining"] > 0:
                    existing_so = (
                        db.query(Notification)
                        .filter(
                            Notification.notification_type == "PREDICTED_STOCKOUT",
                            Notification.reference_id == str(p.id),
                            Notification.created_at >= datetime.utcnow() - timedelta(hours=12),
                        )
                        .first()
                    )
                    if not existing_so:
                        notif = NotificationService.send_notification(
                            db=db,
                            title=f"Imminent Stockout Predicted (<48h): {p.name}",
                            message=f"Depletion projected within {pred['days_remaining']:.1f} days (Estimated: {pred['predicted_depletion_date']}). Urgent reorder required.",
                            notification_type="PREDICTED_STOCKOUT",
                            severity="CRITICAL",
                            reference_type="PRODUCT",
                            reference_id=str(p.id),
                        )
                        generated.append(notif)
            except Exception:
                pass

        # 3. Unacknowledged Anomalies Check
        anomalies = (
            db.query(AnomalyRecord)
            .filter(
                AnomalyRecord.is_acknowledged == 0,
                AnomalyRecord.detected_at >= datetime.utcnow() - timedelta(hours=24),
            )
            .all()
        )
        for a in anomalies:
            existing_anom = (
                db.query(Notification)
                .filter(
                    Notification.notification_type == "ANOMALY_DETECTED",
                    Notification.reference_id == str(a.id),
                )
                .first()
            )
            if not existing_anom:
                p = db.query(Product).filter(Product.id == a.product_id).first()
                pname = p.name if p else f"SKU #{a.product_id}"
                notif = NotificationService.send_notification(
                    db=db,
                    title=f"Statistical Anomaly Detected: {pname}",
                    message=f"Consumption surge of {a.actual_quantity:.1f} (+{a.deviation_percentage:.1f}%) exceeded EWMA ±3σ baseline. Requires manager review.",
                    notification_type="ANOMALY_DETECTED",
                    severity="WARNING",
                    reference_type="ANOMALY",
                    reference_id=str(a.id),
                )
                generated.append(notif)

        # 4. Adjustment Pending Approval Check
        pending_adjs = (
            db.query(InventoryAdjustment)
            .filter(InventoryAdjustment.status == AdjustmentStatus.PENDING_APPROVAL)
            .all()
        )
        for adj in pending_adjs:
            existing_adj = (
                db.query(Notification)
                .filter(
                    Notification.notification_type == "ADJUSTMENT_PENDING",
                    Notification.reference_id == str(adj.id),
                )
                .first()
            )
            if not existing_adj:
                p = db.query(Product).filter(Product.id == adj.product_id).first()
                pname = p.name if p else f"Product #{adj.product_id}"
                notif = NotificationService.send_notification(
                    db=db,
                    title=f"Physical Count Adjustment Pending: {pname}",
                    message=f"Cycle count adjustment difference of {adj.difference:+.1f} units submitted. Awaiting manager approval before ledger mutation.",
                    notification_type="ADJUSTMENT_PENDING",
                    severity="INFO",
                    reference_type="ADJUSTMENT",
                    reference_id=str(adj.id),
                )
                generated.append(notif)

        return {
            "status": "success",
            "new_notifications_count": len(generated),
            "timestamp": datetime.utcnow().isoformat(),
        }
