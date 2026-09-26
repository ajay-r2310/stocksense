"""Warehouse and Location API Routes."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.models.core import Warehouse, Location
from app.schemas.core import (
    WarehouseCreate, WarehouseRead,
    LocationCreate, LocationRead
)
from app.api.deps import require_viewer, require_admin, require_manager
from app.models.auth import User

router = APIRouter(prefix="/warehouses", tags=["Warehouses & Locations"])


@router.get("", response_model=List[WarehouseRead])
def get_warehouses(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    return db.query(Warehouse).all()


@router.post("", response_model=WarehouseRead)
def create_warehouse(
    wh_in: WarehouseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    existing = db.query(Warehouse).filter(
        (Warehouse.name == wh_in.name) | (Warehouse.code == wh_in.code)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Warehouse name or code already exists")
    
    wh = Warehouse(**wh_in.dict())
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return wh


@router.get("/{warehouse_id}/locations", response_model=List[LocationRead])
def get_warehouse_locations(
    warehouse_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    return db.query(Location).filter(Location.warehouse_id == warehouse_id).all()


@router.post("/{warehouse_id}/locations", response_model=LocationRead)
def create_location(
    warehouse_id: int,
    loc_in: LocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    wh = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
        
    loc = Location(
        warehouse_id=warehouse_id,
        name=loc_in.name,
        parent_location_id=loc_in.parent_location_id
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc
