"""Intelligence Layer REST API Routes."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.models.core import Product
from app.models.auth import User
from app.api.deps import require_viewer, require_manager
from app.services.forecasting_service import (
    get_product_forecast,
    get_stockout_prediction,
    get_reorder_recommendation,
    generate_explainability_report,
    record_prediction_log_entry,
    evaluate_prediction_accuracy,
)

router = APIRouter(prefix="/intelligence", tags=["Intelligence Layer"])


@router.get("/forecast/{product_id}")
def get_forecast_for_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    """
    Returns 7-day and 28-day moving averages, trend classification, and category fallback baseline.
    """
    try:
        forecast = get_product_forecast(db, product_id)
        # Log to PredictionLog for feedback loop
        record_prediction_log_entry(db, product_id)
        return forecast
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/stockout-risk")
def get_stockout_risk_overview(
    risk_tier: Optional[str] = Query(None, description="Filter by HIGH, MEDIUM, LOW"),
    category_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    """
    Returns days-to-stockout calculations and risk tiers (LOW, MEDIUM, HIGH) across all active products.
    """
    query = db.query(Product)
    if category_id:
        query = query.filter(Product.category_id == category_id)
    products = query.all()

    results = []
    for p in products:
        try:
            pred = get_stockout_prediction(db, p.id)
            if risk_tier and pred["risk_tier"] != risk_tier.upper():
                continue
            results.append(pred)
        except Exception as e:
            continue

    # Sort HIGH risk first, then MEDIUM, then LOW
    tier_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    results.sort(key=lambda x: (tier_order.get(x["risk_tier"], 3), x["days_remaining"]))
    return results


@router.get("/reorder-recommendations")
def get_reorder_recommendations(
    category_id: Optional[int] = Query(None),
    only_actionable: bool = Query(False, description="Only products with recommended_reorder_qty > 0"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    """
    Calculates exact smart reorder recommendations per README §7.3 verbatim, floored at 0.
    """
    query = db.query(Product)
    if category_id:
        query = query.filter(Product.category_id == category_id)
    products = query.all()

    results = []
    for p in products:
        try:
            rec = get_reorder_recommendation(db, p.id)
            if only_actionable and rec["recommended_reorder_qty"] <= 0:
                continue
            results.append(rec)
        except Exception:
            continue

    # Sort products with reorder quantity required first
    results.sort(key=lambda x: x["recommended_reorder_qty"], reverse=True)
    return results


@router.get("/explain/{product_id}")
def get_product_explainability(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    """
    Returns auditable explanation bullets generated programmatically from computed inputs.
    """
    try:
        report = generate_explainability_report(db, product_id)
        return report
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/prediction-accuracy")
def get_prediction_accuracy_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    """
    Returns feedback loop prediction accuracy metrics and audit logs.
    """
    return evaluate_prediction_accuracy(db)


@router.post("/evaluate-predictions")
def run_evaluation_job(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """
    Triggers an immediate evaluation run of PredictionLog against actual ledger outcomes.
    """
    return evaluate_prediction_accuracy(db)


@router.get("/stock-health-score")
def get_stock_health_composite(
    product_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    """
    Returns the 6-component Stock Health Composite Score (§7.6).
    """
    from app.services.anomaly_service import calculate_stock_health_score
    return calculate_stock_health_score(db, product_id)

