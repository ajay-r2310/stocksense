"""Supplier Master Data Routes."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.models.core import Supplier
from app.schemas.core import SupplierCreate, SupplierRead
from app.api.deps import require_viewer, require_manager
from app.models.auth import User

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


@router.get("", response_model=List[SupplierRead])
def get_suppliers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    return db.query(Supplier).all()


@router.post("", response_model=SupplierRead)
def create_supplier(
    sup_in: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    existing = db.query(Supplier).filter(Supplier.name == sup_in.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Supplier with this name already exists")
        
    supplier = Supplier(**sup_in.dict())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier
