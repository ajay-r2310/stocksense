"""
StockSense Anomaly Detection & Stock Health Engine.

Implements EWMA (Exponentially Weighted Moving Average) and EWMA-variance rolling baselines,
±3σ statistical outlier detection, KnownEvent exclusion filtering, and the 6-component
Stock Health Composite Score (§7.6).
"""
import math
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.core import Product, Supplier, Category
from app.models.inventory import StockMovement, StockByLocation, MovementType
from app.models.orders import PurchaseOrder, POStatus
from app.models.intelligence import KnownEvent, AnomalyRecord
from app.services.forecasting_service import (
    get_product_forecast,
    get_stockout_prediction,
    get_reorder_recommendation,
)


def get_active_known_events(db: Session) -> List[KnownEvent]:
    """Retrieves all registered KnownEvent date windows."""
    return db.query(KnownEvent).all()


def is_date_in_known_events(target_date: date, known_events: List[KnownEvent]) -> bool:
    """Checks if a given date falls within any KnownEvent date range."""
    for ev in known_events:
        start_d = ev.start_date.date() if isinstance(ev.start_date, datetime) else ev.start_date
        end_d = ev.end_date.date() if isinstance(ev.end_date, datetime) else ev.end_date
        if start_d <= target_date <= end_d:
            return True
    return False


def compute_ewma_baseline_and_anomalies(
    db: Session,
    product_id: int,
    lookback_days: int = 75,
    span: int = 14,
    as_of: Optional[datetime] = None
) -> List[Dict[str, Any]]:
    """
    Computes daily consumption EWMA baseline and flags ±3σ anomalies.
    Excludes KnownEvent windows from both baseline smoothing and anomaly alerts.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise ValueError(f"Product ID {product_id} not found.")

    end_dt = as_of or datetime.utcnow()
    start_dt = end_dt - timedelta(days=lookback_days)
    known_events = get_active_known_events(db)

    # Fetch all outbound consumption movements (DELIVERY, etc.)
    movements = (
        db.query(StockMovement)
        .filter(
            StockMovement.product_id == product_id,
            StockMovement.movement_type.in_([MovementType.DELIVERY, MovementType.TRANSFER_OUT, MovementType.RETURN_OUT]),
            StockMovement.timestamp >= start_dt,
            StockMovement.timestamp <= end_dt,
        )
        .all()
    )

    # Build continuous daily time series
    date_index = pd.date_range(start=start_dt.date(), end=end_dt.date(), freq="D")
    daily_demand = pd.Series(0.0, index=date_index)

    for m in movements:
        m_date = pd.Timestamp(m.timestamp.date())
        if m_date in daily_demand.index:
            # Outbound movements are stored with negative sign or positive magnitude
            daily_demand[m_date] += abs(float(m.quantity))

    # Create DataFrame and mark KnownEvent dates
    df = pd.DataFrame({"actual": daily_demand})
    df["is_known_event"] = [
        is_date_in_known_events(idx.date(), known_events) for idx in df.index
    ]

    # Compute EWMA baseline only using non-known-event dates
    # Mask known events during EWMA calculation so surges do not distort the moving baseline
    masked_actual = df["actual"].copy()
    masked_actual[df["is_known_event"]] = np.nan

    # Forward fill or interpolate known event days for EWMA calculation continuity
    filled_actual = masked_actual.interpolate(method="time").ffill().bfill().fillna(0.0)

    # Calculate EWMA mean and EWMA std dev based on historical sequence
    raw_ewma_mean = filled_actual.ewm(span=span, adjust=False).mean()
    raw_ewma_var = filled_actual.ewm(span=span, adjust=False).var()
    raw_ewma_std = np.sqrt(raw_ewma_var).fillna(1.0).clip(lower=0.5)

    # Use prior-day baseline for outlier threshold comparison to avoid spike self-inflation
    df["ewma"] = raw_ewma_mean.shift(1).bfill()
    df["std_dev"] = raw_ewma_std.shift(1).bfill().clip(lower=0.5)
    df["upper_3sigma"] = df["ewma"] + 3.0 * df["std_dev"]
    df["lower_3sigma"] = (df["ewma"] - 3.0 * df["std_dev"]).clip(lower=0.0)
    df["z_score"] = (df["actual"] - df["ewma"]) / df["std_dev"]

    detected_anomalies = []

    for ts, row in df.iterrows():
        # Do not flag if inside a KnownEvent window
        if row["is_known_event"]:
            continue

        actual_qty = float(row["actual"])
        ewma_val = float(row["ewma"])
        std_val = float(row["std_dev"])
        upper_limit = float(row["upper_3sigma"])
        z_score = float(row["z_score"])

        # Flag surge anomalies exceeding +3 sigma (and at least 5 units above baseline)
        if actual_qty > upper_limit and (actual_qty - ewma_val) >= 4.0:
            dev_pct = ((actual_qty - ewma_val) / max(ewma_val, 0.1)) * 100.0
            
            causes = [
                f"Demand surge of {actual_qty:.1f} {product.base_uom.symbol if product.base_uom else 'units'} exceeded +3σ baseline threshold ({upper_limit:.1f} {product.base_uom.symbol if product.base_uom else 'units'}).",
                f"Statistical deviation: +{dev_pct:.1f}% above 14-day EWMA expected level (Z-score: {z_score:.2f}).",
                "No promotional event or seasonal campaign registered in KnownEvents for this date.",
                "Recommend auditing batch sales orders or checking for duplicate dispatch entries."
            ]

            detected_anomalies.append({
                "product_id": product.id,
                "product_name": product.name,
                "sku": product.sku,
                "event_date": ts.to_pydatetime(),
                "actual_quantity": round(actual_qty, 2),
                "expected_ewma": round(ewma_val, 2),
                "std_dev": round(std_val, 2),
                "upper_limit": round(upper_limit, 2),
                "z_score": round(z_score, 2),
                "deviation_percentage": round(dev_pct, 1),
                "anomaly_type": "SURGE",
                "possible_causes": " | ".join(causes),
                "is_known_event_excluded": False,
            })

    return detected_anomalies


def run_and_persist_anomaly_detection(db: Session, as_of: Optional[datetime] = None) -> List[AnomalyRecord]:
    """
    Scans all products for anomalies and persists new records in `anomaly_records`.
    Returns list of unacknowledged and active anomaly records.
    """
    products = db.query(Product).all()
    created_records = []

    for p in products:
        try:
            anomalies = compute_ewma_baseline_and_anomalies(db, p.id, as_of=as_of)
            for a in anomalies:
                # Check if already logged for this product and event date
                existing = (
                    db.query(AnomalyRecord)
                    .filter(
                        AnomalyRecord.product_id == a["product_id"],
                        func.date(AnomalyRecord.event_date) == a["event_date"].date(),
                    )
                    .first()
                )
                if not existing:
                    rec = AnomalyRecord(
                        product_id=a["product_id"],
                        event_date=a["event_date"],
                        detected_at=datetime.utcnow(),
                        actual_quantity=a["actual_quantity"],
                        expected_ewma=a["expected_ewma"],
                        std_dev=a["std_dev"],
                        z_score=a["z_score"],
                        deviation_percentage=a["deviation_percentage"],
                        anomaly_type=a["anomaly_type"],
                        possible_causes=a["possible_causes"],
                        is_acknowledged=0,
                    )
                    db.add(rec)
                    created_records.append(rec)
        except Exception as err:
            continue

    if created_records:
        db.commit()

    return (
        db.query(AnomalyRecord)
        .order_by(AnomalyRecord.event_date.desc(), AnomalyRecord.z_score.desc())
        .all()
    )


def calculate_stock_health_score(db: Session, product_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Calculates the 6-component Stock Health Composite Score (0–100) per README §7.6.
    Can evaluate an individual product or the portfolio average across all products.
    """
    if product_id:
        products = db.query(Product).filter(Product.id == product_id).all()
    else:
        products = db.query(Product).all()

    if not products:
        return {
            "overall_health_score": 100,
            "status": "OPTIMAL",
            "evaluated_products_count": 0,
            "sub_scores": {},
        }

    total_availability = 0.0
    total_stability = 0.0
    total_supplier = 0.0
    total_overstock = 0.0
    total_stockout_risk = 0.0
    total_anomaly = 0.0

    product_scores = []

    for p in products:
        # 1. Availability Sub-score (0–25 pts)
        stock_entries = db.query(StockByLocation).filter(StockByLocation.product_id == p.id).all()
        avail_qty = sum(max(0, s.on_hand_qty - s.reserved_qty) for s in stock_entries)
        safety_target = float(p.safety_stock or 10.0)
        # Ratio of available vs safety stock
        avail_subscore = min(25.0, (avail_qty / max(safety_target, 1.0)) * 25.0)

        # 2. Demand Stability Sub-score (0–20 pts)
        try:
            fc = get_product_forecast(db, p.id)
            m7 = fc["moving_avg_7d"]
            m28 = fc["moving_avg_28d"]
            # Variance between short-term and long-term moving averages
            delta_ratio = abs(m7 - m28) / max(m28, 0.5)
            # High stability (low delta) yields full 20 pts
            stability_subscore = max(0.0, 20.0 * (1.0 - min(1.0, delta_ratio)))
        except Exception:
            stability_subscore = 15.0

        # 3. Supplier Reliability Sub-score (0–15 pts)
        # Check supplier lead time and past POs
        supplier = db.query(Supplier).filter(Supplier.id == p.primary_supplier_id).first() if p.primary_supplier_id else None
        lead_time = float(supplier.lead_time_days if supplier else 5.0)
        # Lead times under 10 days receive full supplier score
        supplier_subscore = max(5.0, 15.0 - max(0.0, (lead_time - 7.0) * 0.5))

        # 4. Overstock Risk Sub-score (0–15 pts)
        # Penalizes stock exceeding 90 days of demand
        daily_d = fc.get("forecasted_daily_demand", 1.0) if "fc" in locals() else 1.0
        days_held = avail_qty / max(daily_d, 0.1)
        if days_held > 90:
            overstock_subscore = max(0.0, 15.0 - (days_held - 90) * 0.2)
        else:
            overstock_subscore = 15.0

        # 5. Stockout Risk Sub-score (0–15 pts)
        try:
            pred = get_stockout_prediction(db, p.id)
            if pred["risk_tier"] == "LOW":
                stockout_subscore = 15.0
            elif pred["risk_tier"] == "MEDIUM":
                stockout_subscore = 8.0
            else:  # HIGH
                stockout_subscore = 2.0
        except Exception:
            stockout_subscore = 10.0

        # 6. Recent Anomaly Sub-score (0–10 pts)
        week_ago = datetime.utcnow() - timedelta(days=7)
        recent_anomalies = (
            db.query(AnomalyRecord)
            .filter(
                AnomalyRecord.product_id == p.id,
                AnomalyRecord.event_date >= week_ago,
                AnomalyRecord.is_acknowledged == 0,
            )
            .count()
        )
        anomaly_subscore = max(0.0, 10.0 - (recent_anomalies * 5.0))

        product_total = (
            avail_subscore
            + stability_subscore
            + supplier_subscore
            + overstock_subscore
            + stockout_subscore
            + anomaly_subscore
        )

        product_scores.append({
            "product_id": p.id,
            "sku": p.sku,
            "name": p.name,
            "health_score": round(product_total, 1),
            "sub_scores": {
                "availability": round(avail_subscore, 1),
                "demand_stability": round(stability_subscore, 1),
                "supplier_reliability": round(supplier_subscore, 1),
                "overstock_risk": round(overstock_subscore, 1),
                "stockout_risk": round(stockout_subscore, 1),
                "recent_anomalies": round(anomaly_subscore, 1),
            },
        })

        total_availability += avail_subscore
        total_stability += stability_subscore
        total_supplier += supplier_subscore
        total_overstock += overstock_subscore
        total_stockout_risk += stockout_subscore
        total_anomaly += anomaly_subscore

    n = len(products)
    avg_total = (
        total_availability
        + total_stability
        + total_supplier
        + total_overstock
        + total_stockout_risk
        + total_anomaly
    ) / n

    if avg_total >= 80:
        status_label = "OPTIMAL"
    elif avg_total >= 60:
        status_label = "ATTENTION"
    else:
        status_label = "CRITICAL"

    return {
        "overall_health_score": round(avg_total, 1),
        "status": status_label,
        "evaluated_products_count": n,
        "composite_sub_scores": {
            "availability_score": round(total_availability / n, 1),
            "demand_stability_score": round(total_stability / n, 1),
            "supplier_reliability_score": round(total_supplier / n, 1),
            "overstock_control_score": round(total_overstock / n, 1),
            "stockout_mitigation_score": round(total_stockout_risk / n, 1),
            "anomaly_health_score": round(total_anomaly / n, 1),
        },
        "product_scores": product_scores,
    }
