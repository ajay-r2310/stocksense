"""Product, Category, and UOM API Routes."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.models.core import Product, Category, UnitOfMeasure, Lot
from app.schemas.core import (
    ProductCreate, ProductRead,
    CategoryCreate, CategoryRead,
    UnitOfMeasureCreate, UnitOfMeasureRead,
    LotCreate, LotRead
)
from app.api.deps import require_viewer, require_manager, get_current_user
from app.models.auth import User

router = APIRouter(prefix="/products", tags=["Products & Master Data"])


# --- Categories ---
@router.get("/categories", response_model=List[CategoryRead])
def get_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    return db.query(Category).all()


@router.post("/categories", response_model=CategoryRead)
def create_category(
    cat_in: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    existing = db.query(Category).filter(
        (Category.name == cat_in.name) | (Category.code == cat_in.code)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category name or code already exists")
    
    cat = Category(**cat_in.dict())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


# --- Unit of Measure ---
@router.get("/uoms", response_model=List[UnitOfMeasureRead])
def get_uoms(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    return db.query(UnitOfMeasure).all()


@router.post("/uoms", response_model=UnitOfMeasureRead)
def create_uom(
    uom_in: UnitOfMeasureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    existing = db.query(UnitOfMeasure).filter(UnitOfMeasure.name == uom_in.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Unit of Measure name already exists")
    
    uom = UnitOfMeasure(**uom_in.dict())
    db.add(uom)
    db.commit()
    db.refresh(uom)
    return uom


# --- Products ---
@router.get("", response_model=List[ProductRead])
def get_products(
    category_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    query = db.query(Product)
    if category_id:
        query = query.filter(Product.category_id == category_id)
    if search:
        query = query.filter(
            (Product.name.ilike(f"%{search}%")) | (Product.sku.ilike(f"%{search}%"))
        )
    return query.offset(skip).limit(limit).all()


@router.get("/{product_id}", response_model=ProductRead)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("", response_model=ProductRead)
def create_product(
    prod_in: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    existing = db.query(Product).filter(Product.sku == prod_in.sku).first()
    if existing:
        raise HTTPException(status_code=400, detail="Product with this SKU already exists")
    
    product = Product(**prod_in.dict())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


# --- Lots ---
@router.get("/{product_id}/lots", response_model=List[LotRead])
def get_product_lots(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer)
):
    return db.query(Lot).filter(Lot.product_id == product_id).order_by(Lot.expiry_date.asc().nullslast()).all()


@router.post("/{product_id}/lots", response_model=LotRead)
def create_product_lot(
    product_id: int,
    lot_in: LotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    lot = Lot(
        product_id=product_id,
        lot_number=lot_in.lot_number,
        expiry_date=lot_in.expiry_date
    )
    db.add(lot)
    db.commit()
    db.refresh(lot)
    return lot
