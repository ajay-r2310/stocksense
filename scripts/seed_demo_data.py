"""
StockSense Idempotent Demo Data Seeder.
Generates 75 days of realistic time-series inventory ledger transactions per README §8.
"""
import os
import sys
import random
import math
from datetime import datetime, timedelta, timezone

# Ensure project backend root is in sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from sqlalchemy.orm import Session
from app.core.config import SessionLocal, Base, engine
from app.db.init_db import init_db
from app.models.auth import Role, User
from app.models.core import Category, UnitOfMeasure, Warehouse, Location, Supplier, Product, Lot
from app.models.orders import PurchaseOrder, PurchaseOrderLine, SalesOrder, SalesOrderLine, POStatus, SOStatus
from app.models.inventory import StockMovement, StockByLocation, InventoryAdjustment, MovementType
from app.models.intelligence import KnownEvent, PredictionLog
from app.services.ledger_service import apply_movement, verify_ledger_invariant, reserve_stock, release_stock_reservation


def clean_existing_data(db: Session):
    """Safely cleans transaction and demo entities for idempotent re-runs."""
    print("Clearing existing transaction and demo data...")
    db.query(PredictionLog).delete()
    db.query(KnownEvent).delete()
    db.query(InventoryAdjustment).delete()
    db.query(StockMovement).delete()
    db.query(StockByLocation).delete()
    db.query(SalesOrderLine).delete()
    db.query(SalesOrder).delete()
    db.query(PurchaseOrderLine).delete()
    db.query(PurchaseOrder).delete()
    db.query(Lot).delete()
    db.query(Product).delete()
    db.commit()
    print("Cleaned tables successfully.")


def seed_demo_data():
    db = SessionLocal()
    try:
        # 1. Initialize master schema & baseline roles
        init_db(db)
        clean_existing_data(db)

        admin = db.query(User).filter(User.email == "admin@stocksense.io").first()
        manager = db.query(User).filter(User.email == "manager@stocksense.io").first()
        worker = db.query(User).filter(User.email == "worker@stocksense.io").first()

        # 2. Setup Warehouses and Locations
        wh_main = db.query(Warehouse).filter(Warehouse.code == "WH-MAIN").first()
        wh_west = db.query(Warehouse).filter(Warehouse.code == "WH-WEST").first()
        if not wh_west:
            wh_west = Warehouse(
                name="West Coast Regional Hub",
                code="WH-WEST",
                address="500 Pacific Coast Hwy, Building B"
            )
            db.add(wh_west)
            db.commit()
            db.refresh(wh_west)

            for loc_name in ["INBOUND-RECEIVING", "RACK-W1", "RACK-W2", "OUTBOUND-STAGING"]:
                db.add(Location(warehouse_id=wh_west.id, name=loc_name))
            db.commit()

        loc_main_a1 = db.query(Location).filter(Location.warehouse_id == wh_main.id, Location.name == "RACK-A1").first()
        loc_main_a2 = db.query(Location).filter(Location.warehouse_id == wh_main.id, Location.name == "RACK-A2").first()
        loc_main_b1 = db.query(Location).filter(Location.warehouse_id == wh_main.id, Location.name == "RACK-B1").first()
        loc_west_w1 = db.query(Location).filter(Location.warehouse_id == wh_west.id, Location.name == "RACK-W1").first()

        # 3. Setup Categories & UOMs
        cat_elec = db.query(Category).filter(Category.code == "ELEC").first()
        cat_hard = db.query(Category).filter(Category.code == "HARD").first()
        cat_raw = db.query(Category).filter(Category.code == "RAW").first()
        cat_cons = db.query(Category).filter(Category.code == "CONS").first()

        uom_pcs = db.query(UnitOfMeasure).filter(UnitOfMeasure.symbol == "pcs").first()
        uom_box = db.query(UnitOfMeasure).filter(UnitOfMeasure.symbol == "box-24").first()
        uom_kg = db.query(UnitOfMeasure).filter(UnitOfMeasure.symbol == "kg").first()

        # 4. Suppliers
        sup_apex = db.query(Supplier).filter(Supplier.name == "Apex Micro Devices").first()
        sup_global = db.query(Supplier).filter(Supplier.name == "Global Fastener Corp").first()
        sup_pacific = db.query(Supplier).filter(Supplier.name == "Pacific Raw Materials").first()

        # 5. Seed 10 Curated Products
        products_def = [
            {
                "sku": "MCU-STM32F4",
                "name": "STM32F4 Cortex-M4 Microcontroller",
                "category": cat_elec,
                "base_uom": uom_pcs,
                "supplier": sup_apex,
                "reorder_level": 150.0,
                "safety_stock": 80.0,
                "average_cost": 12.50,
                "is_hot_trend": True,       # +0.5%/day drift
                "base_daily_demand": 25.0,
                "pattern": "b2b",
                "primary_loc": loc_main_a1
            },
            {
                "sku": "WIFI-ESP32S3",
                "name": "ESP32-S3 Dual-Core Wi-Fi/BLE Module",
                "category": cat_elec,
                "base_uom": uom_pcs,
                "supplier": sup_apex,
                "reorder_level": 200.0,
                "safety_stock": 100.0,
                "average_cost": 4.80,
                "is_hot_trend": False,
                "base_daily_demand": 35.0,
                "pattern": "b2b",
                "primary_loc": loc_main_a1
            },
            {
                "sku": "SENS-GYRO-6AXIS",
                "name": "6-Axis MEMS IMU Sensor Module",
                "category": cat_elec,
                "base_uom": uom_pcs,
                "supplier": sup_apex,
                "reorder_level": 80.0,
                "safety_stock": 40.0,
                "average_cost": 8.20,
                "is_hot_trend": True,       # +0.5%/day drift
                "base_daily_demand": 15.0,
                "pattern": "b2b",
                "primary_loc": loc_main_a2
            },
            {
                "sku": "BOLT-TITANIUM-M4",
                "name": "M4 x 16mm Aerospace Titanium Bolts",
                "category": cat_hard,
                "base_uom": uom_pcs,
                "supplier": sup_global,
                "reorder_level": 400.0,
                "safety_stock": 200.0,
                "average_cost": 0.85,
                "is_hot_trend": False,
                "base_daily_demand": 60.0,
                "pattern": "b2b",
                "primary_loc": loc_main_b1
            },
            {
                "sku": "BRKT-STEEL-L90",
                "name": "Heavy Duty 90° Structural Steel Bracket",
                "category": cat_hard,
                "base_uom": uom_pcs,
                "supplier": sup_global,
                "reorder_level": 120.0,
                "safety_stock": 60.0,
                "average_cost": 3.40,
                "is_hot_trend": False,
                "base_daily_demand": 18.0,
                "pattern": "b2b",
                "primary_loc": loc_west_w1
            },
            {
                "sku": "DISP-OLED-096",
                "name": "0.96 inch I2C OLED Display Module",
                "category": cat_elec,
                "base_uom": uom_pcs,
                "supplier": sup_apex,
                "reorder_level": 100.0,
                "safety_stock": 50.0,
                "average_cost": 3.90,
                "is_hot_trend": False,
                "has_recent_anomaly": True, # Manufactured anomaly 2 days ago!
                "base_daily_demand": 20.0,
                "pattern": "b2b",
                "primary_loc": loc_main_a2
            },
            {
                "sku": "RAW-RESIN-EPOXY",
                "name": "Industrial High-Temp Epoxy Resin 5kg",
                "category": cat_raw,
                "base_uom": uom_kg,
                "supplier": sup_pacific,
                "reorder_level": 60.0,
                "safety_stock": 30.0,
                "average_cost": 45.00,
                "is_hot_trend": False,
                "has_historical_spike": True, # Spike 45 days ago tagged in KnownEvent
                "base_daily_demand": 8.0,
                "pattern": "b2b",
                "primary_loc": loc_main_b1
            },
            {
                "sku": "RAW-ALUM-2020",
                "name": "2020 T-Slot Aluminum Extrusion 1m",
                "category": cat_raw,
                "base_uom": uom_pcs,
                "supplier": sup_pacific,
                "reorder_level": 50.0,
                "safety_stock": 25.0,
                "average_cost": 14.20,
                "is_cold_start": True,      # Cold start: only 8 days of history!
                "base_daily_demand": 6.0,
                "pattern": "b2b",
                "primary_loc": loc_west_w1
            },
            {
                "sku": "CONS-PLUG-IOT",
                "name": "Smart WiFi Energy Monitoring Plug 16A",
                "category": cat_cons,
                "base_uom": uom_pcs,
                "supplier": sup_apex,
                "reorder_level": 180.0,
                "safety_stock": 90.0,
                "average_cost": 11.00,
                "is_hot_trend": False,
                "base_daily_demand": 28.0,
                "pattern": "retail",        # Retail pattern (peak on weekends)
                "primary_loc": loc_main_a1
            },
            {
                "sku": "CONS-CABLE-BRAIDED",
                "name": "Braided 100W USB-C PD Cable 2m",
                "category": cat_cons,
                "base_uom": uom_pcs,
                "supplier": sup_apex,
                "reorder_level": 300.0,
                "safety_stock": 150.0,
                "average_cost": 2.20,
                "is_hot_trend": False,
                "base_daily_demand": 45.0,
                "pattern": "retail",
                "primary_loc": loc_west_w1
            },
        ]

        created_products = {}
        for pdef in products_def:
            p = Product(
                sku=pdef["sku"],
                name=pdef["name"],
                category_id=pdef["category"].id,
                base_uom_id=pdef["base_uom"].id,
                primary_supplier_id=pdef["supplier"].id,
                reorder_level=pdef["reorder_level"],
                safety_stock=pdef["safety_stock"],
                average_cost=pdef["average_cost"],
                is_lot_tracked=True if pdef["sku"] == "RAW-RESIN-EPOXY" else False
            )
            db.add(p)
            db.flush()
            created_products[pdef["sku"]] = (p, pdef)

        db.commit()

        # 6. Create Historical Known Event Window (Festival Spike 45 days ago)
        today = datetime.utcnow()
        festival_start = today - timedelta(days=48)
        festival_end = today - timedelta(days=43)
        known_event = KnownEvent(
            name="Diwali Industrial Bulk Demand Surge",
            start_date=festival_start,
            end_date=festival_end,
            description="Pre-scheduled annual production festival order volume",
            created_by=manager.id
        )
        db.add(known_event)
        db.commit()

        # 7. Generate 75 Days of Realistic Daily Transaction Flow
        print("Generating 75-day realistic transaction ledger...")
        random.seed(42)  # Deterministic seed for repeatable demo data

        total_days = 75
        for sku, (prod, pdef) in created_products.items():
            loc = pdef["primary_loc"]
            is_cold_start = pdef.get("is_cold_start", False)
            start_day_offset = 8 if is_cold_start else total_days

            # A. Initial Warehouse Inbound Stocking (75 days ago or 8 days ago)
            init_date = today - timedelta(days=start_day_offset)
            initial_stock_qty = pdef["base_daily_demand"] * 35.0  # ~35 days of stock
            
            # Record initial PO and Receipt
            po = PurchaseOrder(
                po_number=f"PO-INIT-{prod.id:03d}",
                supplier_id=prod.primary_supplier_id,
                warehouse_id=loc.warehouse_id,
                status=POStatus.DONE.value,
                expected_date=init_date,
                created_by=manager.id,
                created_at=init_date
            )
            db.add(po)
            db.flush()
            
            po_line = PurchaseOrderLine(
                purchase_order_id=po.id,
                product_id=prod.id,
                ordered_qty=initial_stock_qty,
                received_qty=initial_stock_qty,
                unit_cost=prod.average_cost
            )
            db.add(po_line)
            db.flush()

            apply_movement(
                db=db,
                product_id=prod.id,
                movement_type=MovementType.RECEIPT,
                quantity=initial_stock_qty,
                destination_location_id=loc.id,
                reference_id=po.po_number,
                reason="Initial inventory warehouse staging",
                unit_cost=prod.average_cost,
                user_id=manager.id,
                timestamp=init_date
            )

            # B. Daily Outbound Demands & Periodic Restocking Over Time
            cumulative_sold = 0
            for day_idx in range(start_day_offset - 1, -1, -1):
                cur_date = today - timedelta(days=day_idx)
                weekday = cur_date.weekday()  # 0=Mon, 5=Sat, 6=Sun

                # Multipliers:
                # 1. Day-of-week variation
                if pdef["pattern"] == "b2b":
                    day_mult = 0.35 if weekday in [5, 6] else 1.25
                else:  # retail
                    day_mult = 1.60 if weekday in [5, 6] else 0.75

                # 2. Upward drift for hot trending items (+0.5% per day elapsed)
                trend_mult = 1.0
                if pdef.get("is_hot_trend"):
                    elapsed_days = (total_days - day_idx)
                    trend_mult = 1.0 + (0.0065 * elapsed_days)  # +0.65%/day

                # 3. Seasonal spike (45 days ago)
                spike_mult = 1.0
                if pdef.get("has_historical_spike") and (festival_start <= cur_date <= festival_end):
                    spike_mult = 4.2

                # 4. Deliberate Recent Live Demo Anomaly (2 days ago)
                anomaly_mult = 1.0
                if pdef.get("has_recent_anomaly") and day_idx == 2:
                    anomaly_mult = 6.5  # Huge spike of ~130 units on day -2

                # Compute target daily demand with Gaussian noise
                base_demand = pdef["base_daily_demand"] * day_mult * trend_mult * spike_mult * anomaly_mult
                noise = random.gauss(1.0, 0.12)
                daily_qty = max(1.0, round(base_demand * noise, 1))

                # Check current on-hand stock at location
                stock_rec = db.query(StockByLocation).filter(
                    StockByLocation.product_id == prod.id,
                    StockByLocation.location_id == loc.id
                ).first()
                current_on_hand = stock_rec.on_hand_qty if stock_rec else 0.0

                # Periodic replenishment PO if stock is below safety threshold
                if current_on_hand < (prod.reorder_level + daily_qty * 3):
                    replenish_qty = pdef["base_daily_demand"] * 25.0
                    po_rep = PurchaseOrder(
                        po_number=f"PO-REP-{prod.id:03d}-{day_idx:02d}",
                        supplier_id=prod.primary_supplier_id,
                        warehouse_id=loc.warehouse_id,
                        status=POStatus.DONE.value,
                        expected_date=cur_date,
                        created_by=manager.id,
                        created_at=cur_date
                    )
                    db.add(po_rep)
                    db.flush()
                    db.add(PurchaseOrderLine(
                        purchase_order_id=po_rep.id,
                        product_id=prod.id,
                        ordered_qty=replenish_qty,
                        received_qty=replenish_qty,
                        unit_cost=prod.average_cost
                    ))
                    apply_movement(
                        db=db,
                        product_id=prod.id,
                        movement_type=MovementType.RECEIPT,
                        quantity=replenish_qty,
                        destination_location_id=loc.id,
                        reference_id=po_rep.po_number,
                        unit_cost=prod.average_cost,
                        user_id=worker.id,
                        timestamp=cur_date
                    )
                    current_on_hand += replenish_qty

                # Apply daily outbound Delivery movement (capped to prevent negative stock)
                deliver_qty = min(daily_qty, max(0.0, current_on_hand - 2.0))
                if deliver_qty > 0:
                    so = SalesOrder(
                        so_number=f"SO-{prod.id:03d}-{day_idx:03d}",
                        customer_name="Commercial Client" if pdef["pattern"] == "b2b" else "Direct Retail Orders",
                        warehouse_id=loc.warehouse_id,
                        status=SOStatus.DONE.value,
                        created_by=manager.id,
                        created_at=cur_date
                    )
                    db.add(so)
                    db.flush()
                    db.add(SalesOrderLine(
                        sales_order_id=so.id,
                        product_id=prod.id,
                        ordered_qty=deliver_qty,
                        delivered_qty=deliver_qty,
                        unit_price=round(prod.average_cost * 1.6, 2)
                    ))
                    apply_movement(
                        db=db,
                        product_id=prod.id,
                        movement_type=MovementType.DELIVERY,
                        quantity=deliver_qty,
                        source_location_id=loc.id,
                        reference_id=so.so_number,
                        reason="Customer order fulfillment",
                        user_id=worker.id,
                        timestamp=cur_date
                    )
                    cumulative_sold += deliver_qty

            db.commit()

        # 8. Seed Open Purchase Orders (in transit) for realistic reorder calculations
        print("Seeding active in-transit Purchase Orders...")
        open_po_items = [
            (created_products["MCU-STM32F4"][0], loc_main_a1, 120.0),
            (created_products["SENS-GYRO-6AXIS"][0], loc_main_a2, 60.0),
        ]
        for prod, loc, qty in open_po_items:
            po_open = PurchaseOrder(
                po_number=f"PO-TRANSIT-{prod.id:03d}",
                supplier_id=prod.primary_supplier_id,
                warehouse_id=loc.warehouse_id,
                status=POStatus.CONFIRMED.value,
                expected_date=today + timedelta(days=4),
                created_by=manager.id,
                created_at=today - timedelta(days=2)
            )
            db.add(po_open)
            db.flush()
            db.add(PurchaseOrderLine(
                purchase_order_id=po_open.id,
                product_id=prod.id,
                ordered_qty=qty,
                received_qty=0.0,
                unit_cost=prod.average_cost
            ))
        db.commit()

        # 9. Seed Pending Inventory Adjustment for Approval Queue demo
        print("Seeding pending adjustment queue item...")
        oled_prod, _ = created_products["DISP-OLED-096"]
        stock_oled = db.query(StockByLocation).filter(
            StockByLocation.product_id == oled_prod.id,
            StockByLocation.location_id == loc_main_a2.id
        ).first()
        recorded_oled = stock_oled.on_hand_qty if stock_oled else 50.0
        counted_oled = recorded_oled + 85.0  # Large discrepancy (> threshold)

        adj_pending = InventoryAdjustment(
            product_id=oled_prod.id,
            location_id=loc_main_a2.id,
            recorded_qty=recorded_oled,
            counted_qty=counted_oled,
            difference=85.0,
            reason="Unregistered supplier sample carton discovered on shelf top",
            requested_by=worker.id,
            status="pending_approval",
            created_at=today - timedelta(hours=3)
        )
        db.add(adj_pending)
        db.commit()

        # 10. CRITICAL INVARIANT CHECK
        print("Validating global Stock Ledger Invariant across all seeded products & locations...")
        is_valid = verify_ledger_invariant(db)
        if not is_valid:
            raise RuntimeError("CRITICAL ERROR: Ledger invariant failed after demo data seeding!")
        
        movements_count = db.query(StockMovement).count()
        stocks_count = db.query(StockByLocation).count()
        po_count = db.query(PurchaseOrder).count()
        so_count = db.query(SalesOrder).count()

        print("==========================================================")
        print(" DEMO SEEDING COMPLETED SUCCESSFULLY!")
        print(f"  - Products Seeded: {len(created_products)}")
        print(f"  - Total Ledger Movements: {movements_count}")
        print(f"  - StockByLocation Cache Rows: {stocks_count}")
        print(f"  - Purchase Orders: {po_count}")
        print(f"  - Sales Orders: {so_count}")
        print(f"  - Ledger Invariant Check: PASSED (100% Invariant Compliant)")
        print("==========================================================")

    except Exception as e:
        db.rollback()
        print(f"Error seeding demo data: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
