"""Initial database setup and seeding of standard roles and default test accounts."""
from sqlalchemy.orm import Session
from app.core.config import Base, engine
from app.models.auth import Role, User
from app.models.core import UnitOfMeasure, Category, Warehouse, Location, Supplier, Product
from app.services.auth_service import get_password_hash


def init_db(db: Session):
    # Ensure all tables are created
    Base.metadata.create_all(bind=engine)

    # 1. Seed Roles
    roles_data = [
        {"name": "Admin", "description": "Full access to all system resources and user management"},
        {"name": "Inventory Manager", "description": "Can manage orders, approve adjustments, view AI intelligence"},
        {"name": "Warehouse Worker", "description": "Can receive, count, pick, and transfer stock in assigned warehouse"},
        {"name": "Viewer", "description": "Read-only access for reporting and stakeholders"},
    ]
    for r in roles_data:
        if not db.query(Role).filter(Role.name == r["name"]).first():
            db.add(Role(name=r["name"], description=r["description"]))
    db.commit()

    # 2. Seed Default Users
    admin_role = db.query(Role).filter(Role.name == "Admin").first()
    manager_role = db.query(Role).filter(Role.name == "Inventory Manager").first()
    worker_role = db.query(Role).filter(Role.name == "Warehouse Worker").first()
    viewer_role = db.query(Role).filter(Role.name == "Viewer").first()

    users_data = [
        {"name": "Admin User", "email": "admin@stocksense.io", "password": "adminpassword123", "role_id": admin_role.id},
        {"name": "Manager User", "email": "manager@stocksense.io", "password": "managerpassword123", "role_id": manager_role.id},
        {"name": "Worker User", "email": "worker@stocksense.io", "password": "workerpassword123", "role_id": worker_role.id},
        {"name": "Viewer User", "email": "viewer@stocksense.io", "password": "viewerpassword123", "role_id": viewer_role.id},
    ]

    for u in users_data:
        if not db.query(User).filter(User.email == u["email"]).first():
            db.add(User(
                name=u["name"],
                email=u["email"],
                password_hash=get_password_hash(u["password"]),
                role_id=u["role_id"]
            ))
    db.commit()

    # 3. Seed Base UOMs
    uoms_data = [
        {"name": "Pieces", "symbol": "pcs", "category": "Unit"},
        {"name": "Box of 24", "symbol": "box-24", "category": "Packaging"},
        {"name": "Carton of 100", "symbol": "ctn-100", "category": "Packaging"},
        {"name": "Kilograms", "symbol": "kg", "category": "Weight"},
    ]
    for uom in uoms_data:
        if not db.query(UnitOfMeasure).filter(UnitOfMeasure.name == uom["name"]).first():
            db.add(UnitOfMeasure(**uom))
    db.commit()

    # 4. Seed Default Categories
    categories_data = [
        {"name": "Electronics & Chips", "code": "ELEC", "description": "Microcontrollers, Sensors, and Components"},
        {"name": "Industrial Hardware", "code": "HARD", "description": "Fasteners, brackets, and structural elements"},
        {"name": "Raw Materials", "code": "RAW", "description": "Chemicals, polymers, and raw bulk metals"},
        {"name": "Consumer Goods", "code": "CONS", "description": "Finished packaged retail products"},
    ]
    for cat in categories_data:
        if not db.query(Category).filter(Category.code == cat["code"]).first():
            db.add(Category(**cat))
    db.commit()

    # 5. Seed Default Warehouse & Locations
    wh = db.query(Warehouse).filter(Warehouse.code == "WH-MAIN").first()
    if not wh:
        wh = Warehouse(name="Primary Fulfillment Center", code="WH-MAIN", address="100 Logistics Blvd, Dock 4")
        db.add(wh)
        db.commit()
        db.refresh(wh)

        locations_data = ["INBOUND-RECEIVING", "RACK-A1", "RACK-A2", "RACK-B1", "RACK-B2", "OUTBOUND-STAGING"]
        for loc_name in locations_data:
            db.add(Location(warehouse_id=wh.id, name=loc_name))
        db.commit()

    # 6. Seed Default Suppliers
    suppliers_data = [
        {"name": "Apex Micro Devices", "contact_info": "orders@apexmicro.com", "default_lead_time_days": 7, "reliability_score": 0.95},
        {"name": "Global Fastener Corp", "contact_info": "supply@globalfasteners.com", "default_lead_time_days": 12, "reliability_score": 0.88},
        {"name": "Pacific Raw Materials", "contact_info": "logistics@pacificraw.com", "default_lead_time_days": 14, "reliability_score": 0.92},
    ]
    for sup in suppliers_data:
        if not db.query(Supplier).filter(Supplier.name == sup["name"]).first():
            db.add(Supplier(**sup))
    db.commit()
