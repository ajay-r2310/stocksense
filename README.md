# StockSense
### Predictive & Explainable Inventory Intelligence Platform

> StockSense doesn't just tell you what inventory you have. It tells you what is likely to happen next, why it will happen, and what you should do about it.

---

## Table of Contents
1. [What Changed and Why](#1-what-changed-and-why)
2. [System Overview](#2-system-overview)
3. [Data Model](#3-data-model)
4. [Core Workflows](#4-core-workflows)
5. [Roles & Permissions (RBAC)](#5-roles--permissions-rbac)
6. [Stock Ledger](#6-stock-ledger)
7. [Intelligence Layer](#7-intelligence-layer)
8. [Synthetic Data Strategy](#8-synthetic-data-strategy)
9. [Dashboard & KPIs](#9-dashboard--kpis)
10. [Warehouse Worker Mode](#10-warehouse-worker-mode)
11. [Notifications](#11-notifications)
12. [System Architecture](#12-system-architecture)
13. [Tech Stack Recommendation](#13-tech-stack-recommendation)
14. [MVP vs Innovation vs Optional](#14-mvp-vs-innovation-vs-optional)
15. [Build Sequencing (Hackathon Plan)](#15-build-sequencing-hackathon-plan)
16. [Demo Script](#16-demo-script)
17. [Competitive Positioning](#17-competitive-positioning)

---

## 1. What Changed and Why

| Problem in original draft | Fix applied |
|---|---|
| No Purchase/Sales Orders — Receipts/Deliveries came from nowhere | Added PO/SO entities that Receipts/Deliveries fulfill, supporting partial fulfillment and backorders |
| No Supplier entity, yet "Supplier Lead Time" used in formulas | Added a Supplier master table with lead time, reliability score, price history |
| "Reserved Stock" mentioned but never defined | Defined reservation lifecycle tied to SO confirmation/cancellation |
| No batch/lot or expiry tracking | Added optional Lot entity for traceability and FEFO picking |
| No returns flow | Added Return Orders (customer + supplier) as a first-class movement type |
| No inventory valuation | Added weighted-average costing on the Product model |
| No UOM conversion logic | Added UOM conversion factor field and enforced conversion at movement time |
| No concurrency handling | Specified optimistic locking / DB-transaction requirement on stock writes |
| Average-only demand forecasting is too weak to call "predictive" | Replaced with a moving-average + trend/seasonality method, explicitly labeled as a heuristic model with a stated upgrade path |
| Anomaly detection via fixed ±$\sigma$ band flags real growth | Replaced with a rolling adaptive baseline (EWMA) plus an explicit "known event" exclusion window |
| Cold-start problem for new products unaddressed | Added a category-level fallback baseline for products with insufficient history |
| "87% Shortage Probability" had false precision with no stated source | Redefined as a genuinely computed score from weighted signals, with the formula documented, or a Low/Medium/High tier — no undocumented percentages ship |
| No feedback loop for the model | Added a Prediction Log that stores forecast vs. actual, surfaced as a simple accuracy view |
| No synthetic data plan | Added Section 8 describing exactly how demo data is generated |
| No RBAC | Added a 4-role permission model |
| No approval workflow for large adjustments | Added an approval threshold + manager sign-off step |
| Barcode scanning is "optional" but Worker Mode assumes it | Worker Mode now supports manual product search as the default path; scanning is an enhancement, not a dependency |
| No notification mechanism | Added a notification service abstraction (in-app + simulated email/webhook for demo) |
| Everything scoped for one hackathon window | Added an explicit build-order in Section 15 so the ledger is solid before AI features are layered on |

---

## 2. System Overview

**Core inventory flow:**
```
Purchase Order -> Receipt -> Stock [Location] -> Sales Order -> Delivery -> Return (optional) / Adjust
                               |
                   Stock Ledger (single source of truth)
                               |
             Intelligence Layer (forecast, reorder, anomaly, explain)
                               |
                           Dashboard
```

**Core principle:** Record what happened -> understand what is happening -> predict what will happen -> recommend what to do — and be able to explain every recommendation in plain language.

---

## 3. Data Model

### 3.1 Product
- `id`: UUID / Int
- `name`: String
- `sku`: String (Unique)
- `category_id`: FK -> Category
- `base_uom_id`: FK -> UnitOfMeasure
- `purchase_uom_id`: FK -> UnitOfMeasure (nullable - for "buy in boxes, sell in units")
- `uom_conversion_factor`: Float (e.g. 1 box = 24 units)
- `reorder_level`: Float
- `safety_stock`: Float
- `average_cost`: Float (weighted-average, updated on each Receipt)
- `is_lot_tracked`: Boolean
- `created_at`, `updated_at`: Timestamp

### 3.2 Category / UnitOfMeasure
Standard lookup tables. UOM conversion is enforced at the point a movement is recorded — a Receipt in "boxes" is converted to base UOM before it touches the ledger.

### 3.3 Warehouse / Location
- **Warehouse**: `id`, `name`, `address`
- **Location**: `id`, `warehouse_id`, `name` (e.g., RACK-A4), `parent_location_id` (nullable, supports zones/aisles/bins)

### 3.4 Stock (derived, not authoritative)
- **StockByLocation**: `product_id`, `location_id`, `lot_id` (nullable), `on_hand_qty`, `reserved_qty`, `available_qty` (`= on_hand_qty - reserved_qty`).
*This table is a read-optimization cache. The Stock Ledger (Section 6) is the single source of truth; StockByLocation must always be reproducible by replaying StockMovement rows. Never let a UI screen write directly to stock quantities.*

### 3.5 Supplier
- `id`, `name`, `contact_info`, `default_lead_time_days`, `reliability_score` (computed: % of POs delivered on time, rolling 90 days)

### 3.6 Purchase Order / Sales Order
- **PurchaseOrder**: `id`, `supplier_id`, `status` (`draft`/`confirmed`/`partial`/`done`/`cancelled`), `expected_date`, `lines`: `[{product_id, ordered_qty, received_qty, unit_cost}]`
- **SalesOrder**: `id`, `customer_id`, `status` (`draft`/`confirmed`/`partial`/`done`/`cancelled`), `lines`: `[{product_id, ordered_qty, delivered_qty}]`

A Receipt is generated against a PO (or created standalone for flexibility) and increases stock + `received_qty` on the PO line. A Delivery Order is generated against a SO and decreases stock + `delivered_qty`. Confirming a SO reserves stock (`reserved_qty += ordered_qty`, capped at availability); cancelling releases it.

### 3.7 Lot / Batch (optional per product, driven by `is_lot_tracked`)
- `id`, `product_id`, `lot_number`, `expiry_date`, `received_date`
*Picking logic defaults to FEFO (first-expire-first-out) when a product is lot-tracked.*

### 3.8 Return Order
- `id`, `type` (`customer_return` / `supplier_return`), `reference_order_id` (SO or PO it relates to), `lines`: `[{product_id, qty, reason}]`, `status`

### 3.9 Stock Movement (the ledger — see Section 6)
- `id`, `product_id`, `lot_id`, `source_location_id`, `destination_location_id`, `quantity`, `movement_type` (`RECEIPT` / `DELIVERY` / `TRANSFER_IN` / `TRANSFER_OUT` / `RETURN_IN` / `RETURN_OUT` / `ADJUSTMENT`), `reference_id`, `reason`, `user_id`, `timestamp`

### 3.10 Adjustment
- **InventoryAdjustment**: `id`, `product_id`, `location_id`, `recorded_qty`, `counted_qty`, `difference`, `reason`, `requested_by`, `approved_by` (nullable until approved), `status` (`pending_approval` / `approved` / `rejected`)

### 3.11 User / Role
- **User**: `id`, `name`, `email`, `password_hash`, `role_id`, `warehouse_scope` (nullable)
- **Role**: `id`, `name` (`Admin` / `Inventory Manager` / `Warehouse Worker` / `Viewer`)

### 3.12 Prediction Log (for the feedback loop)
- `id`, `product_id`, `predicted_at`, `predicted_stockout_date`, `predicted_demand_daily`, `actual_stockout_date` (nullable, filled in later), `actual_demand_daily` (nullable, filled in later)

---

## 4. Core Workflows

### 4.1 Receipt (against PO)
1. Select PO (or create standalone receipt).
2. Confirm quantities received (partial allowed).
3. Validate -> StockMovement row created (`type=RECEIPT`, `qty=+N`).
4. PO line `received_qty` updated; PO status recalculated (`partial`/`done`).
5. Product `average_cost` recalculated (weighted average).

### 4.2 Delivery (against SO)
1. Confirm SO -> stock reserved.
2. Create Delivery Order.
3. Pick (FEFO if lot-tracked) -> Pack -> Validate.
4. StockMovement row created (`type=DELIVERY`, `qty=-N`).
5. SO line `delivered_qty` updated; `reserved_qty` released.

### 4.3 Internal Transfer
1. Source location -> Destination location, `qty`.
2. Validate source has sufficient `available_qty`.
3. Two StockMovement rows: `TRANSFER_OUT` at source, `TRANSFER_IN` at destination (same `reference_id`).

### 4.4 Return
- Customer return: Increases stock back at a location, linked to original SO.
- Supplier return: Decreases stock, linked to original PO.
- Both recorded as StockMovement with `type=RETURN_IN` / `RETURN_OUT`.

### 4.5 Adjustment (with approval)
1. Worker counts physical stock -> difference calculated.
2. If `|difference| / recorded_qty > threshold` (e.g. >10% OR >50 units):
   - `status = pending_approval` -> Inventory Manager notified.
3. Else: auto-approved.
4. On approval: StockMovement row created (`type=ADJUSTMENT`).

---

## 5. Roles & Permissions (RBAC)

| Role | Can do |
|---|---|
| **Admin** | Everything, incl. user management, warehouse/location config |
| **Inventory Manager** | Approve adjustments, view/act on all intelligence layer outputs, manage PO/SO, view all warehouses |
| **Warehouse Worker** | Receive, Move, Count, Pick within their assigned warehouse only; cannot approve their own large adjustments |
| **Viewer** | Read-only dashboard access (e.g. for stakeholders/demo judges) |

*Enforced at the API layer, not just hidden in the UI.*

---

## 6. Stock Ledger

- All writes to `StockMovement` + the `StockByLocation` cache happen inside a single DB transaction with row-level locking (`SELECT ... FOR UPDATE` or equivalent) on the affected `(product_id, location_id)` rows, to prevent two simultaneous operations from double-counting the same stock.
- Invariant: `StockByLocation.on_hand_qty` for any (product, location) must always equal the signed sum of its `StockMovement` rows.

---

## 7. Intelligence Layer

### 7.1 Demand Forecasting (feeds everything else)
- **Baseline**: 7-day and 28-day moving average of daily outbound quantity per product.
- **Trend**: compare the two averages — if 7-day average is significantly above 28-day average, flag demand as "increasing" and use the 7-day figure; otherwise use the blended average.
- **Cold start**: if a product has less than 14 days of movement history, fall back to the category-level average daily usage (computed across all products in the same category) until enough history accumulates.
- **Model Note**: Heuristic time-series model (moving-average + trend + seasonality baseline).

### 7.2 Stockout Prediction
$$\text{predicted\_days\_remaining} = \frac{\text{available\_qty}}{\text{forecasted\_daily\_demand}}$$
$$\text{predicted\_depletion\_date} = \text{today} + \text{predicted\_days\_remaining}$$

**Risk tiers:**
- $> 14 \text{ days remaining} \rightarrow \text{LOW risk}$
- $4\text{–}14 \text{ days remaining} \rightarrow \text{MEDIUM risk}$
- $< 4 \text{ days remaining} \rightarrow \text{HIGH risk}$

### 7.3 Smart Reorder Recommendation
$$\text{recommended\_reorder\_qty} = (\text{forecasted\_daily\_demand} \times \text{supplier\_lead\_time\_days}) + \text{safety\_stock} - \text{available\_qty} - \text{pending\_incoming\_qty}$$
*(where pending_incoming_qty is open PO lines not yet received)*. Never recommends a negative quantity (floor at 0).

### 7.4 Explainability
Every recommendation is generated from the same numeric inputs used in the calculation — not a separately-authored narrative.
**Shortage probability / Risk score (0–100):**
$$\text{score} = \min(100, 40 \times \text{safety\_deficit\_factor} + 30 \times \text{demand\_trend\_factor} + 20 \times \text{lead\_time\_factor} + 10 \times \text{pending\_orders\_factor})$$
Plus plain language bullet points explaining:
- Demand surge relative to 28-day average
- Current stock vs safety stock deficit
- Supplier lead time coverage
- Pending orders in transit

### 7.5 Anomaly Detection
- Maintain an exponentially weighted moving average (EWMA) and EWMA-variance of daily movement quantity per product.
- Flag a movement as anomalous if it falls outside $\text{EWMA} \pm 3 \times \text{EWMA\_stddev}$, recalculated daily.
- **Known-event exclusion**: allow a manager to tag a date range (e.g. "Diwali sale", "quarterly bulk order") so movements in that window don't get flagged and don't permanently distort the baseline.
- Output includes typical range, actual value, deviation %, and possible causes.

### 7.6 Stock Health Score
Composite, explainable score (0–100) per product built from:
- Availability (available vs reorder level)
- Demand Stability (variance of recent daily demand)
- Supplier Reliability (% on time)
- Overstock Risk (stock vs 60-day demand)
- Stockout Risk
- Recent Anomalies (flags in last 30 days)

### 7.7 Feedback Loop
Every forecast/stockout prediction logs a row to `PredictionLog`. Daily/on-demand evaluation compares `predicted_stockout_date` vs actual stockout date, and surfaces a Prediction Accuracy view.

---

## 8. Synthetic Data Strategy
- 60–90 days of daily movement rows per key demo product.
- Weekday/weekend variation (e.g. lower on weekends for B2B, higher for retail).
- A subset of "hot" products with a slow upward trend (+0.5%/day).
- One clear historical spike (e.g., festival week) to demonstrate known-event exclusion.
- One deliberate recent anomaly in the last few days left unflagged for live demo detection.
- Seed script located at `/scripts/seed_demo_data.py`.

---

## 9. Dashboard & KPIs
- **KPIs**: Total Products, Low Stock Items (`available <= reorder_level`), Out of Stock Items (`available == 0`), Pending Receipts / Deliveries, Inventory Turnover Rate, Average Days of Inventory, Prediction Accuracy.
- **Filters**: Document Type, Status, Warehouse/Location, Product Category, Risk Tier.

---

## 10. Warehouse Worker Mode
- Desktop and mobile-first responsive layout with large tap targets.
- Manual product search / quick barcode lookup.
- Fast workflows: RECEIVE, MOVE, COUNT, PICK with immediate validation.

---

## 11. Notifications
- Abstracted `NotificationService` interface:
  - In-app notification center (bell icon, alert drawer).
  - Simulated webhook / email logger.
- Triggers: Low stock crossed, stockout predicted within 48h, anomaly detected, adjustment pending approval.

---

## 12. System Architecture

```
                                  +---------------------------------------+
                                  |              STOCKSENSE               |
                                  |    Manager Dashboard & Worker Mode    |
                                  +-------------------+-------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |             FASTAPI CORE              |
                                  |   RBAC / Auth / REST API Routing      |
                                  +---------+-------------------+---------+
                                            |                   |
                     +----------------------+                   +---------------------+
                     |                                                                |
                     v                                                                v
  +-------------------------------------+                          +-------------------------------------+
  |           INVENTORY CORE            |                          |         INTELLIGENCE LAYER          |
  |  Products / Suppliers / Warehouses  |                          |  7/28-Day Moving Averages & Trends  |
  |  PO / SO / Receipts / Deliveries    |                          |  Stockout Prediction & Tiers        |
  |  Transfers / Adjustments & Approvals|                          |  Smart Reorder Calculation (Floor 0)|
  +------------------+------------------+                          |  EWMA Anomaly Detection (±3σ)       |
                     |                                             |  Stock Health & Prediction Accuracy |
                     |                                             +------------------+------------------+
                     |                                                                |
                     +----------------------+                   +---------------------+
                                            |                   |
                                            v                   v
                                  +---------------------------------------+
                                  |             STOCK LEDGER              |
                                  |  (Single Source of Truth, Append-Only)|
                                  |        apply_movement() Engine        |
                                  +-------------------+-------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |      DERIVED StockByLocation CACHE    |
                                  |       (Row-Locked in Transactions)    |
                                  +-------------------+-------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |      PostgreSQL / SQLite Database     |
                                  +---------------------------------------+
```

---

## 13. Tech Stack (Implemented)

*Note: The platform is built directly on PostgreSQL and FastAPI (Python) rather than NoSQL/Firestore, ensuring ACID guarantees, row-level locking, and native time-series numerical processing.*

- **Backend**: FastAPI (Python 3.12) — Native NumPy and Pandas processing for moving averages, EWMA variance, and time-series forecasting in the same runtime.
- **Database**: PostgreSQL (with SQLite compatibility for local dev/testing) accessed via SQLAlchemy 2.0 with explicit transaction boundaries, row-level locking (`with_for_update()`), and Alembic migrations.
- **Frontend**: React + TypeScript styled with Tailwind CSS — Responsive Manager Dashboard and touch-optimized mobile-first Warehouse Worker Mode.
- **Authentication**: JWT-based auth with role claims for the 4-role RBAC model (`Admin`, `Inventory Manager`, `Warehouse Worker`, `Viewer`).
- **Scheduled Jobs**: APScheduler for nightly EWMA baseline recomputation and prediction accuracy evaluation.
- **Notifications**: NotificationService abstraction with in-app notification center and simulated webhook/email log.

---

## 14. MVP vs Innovation vs Optional

### Must Have (Base Requirements)
- [x] Authentication + RBAC (4 roles enforced at API layer)
- [x] Product / Category / UOM management (with conversion factors)
- [x] Supplier management (lead times, reliability scores)
- [x] Warehouses & Locations
- [x] Purchase Orders -> Receipts (partial fulfillment, weighted average cost)
- [x] Sales Orders -> Delivery Orders (stock reservation on confirm, release on delivery)
- [x] Internal Transfers
- [x] Inventory Adjustments (with approval workflow threshold)
- [x] Stock Ledger (append-only, transactional, row-level locking)
- [ ] Manager Dashboard with core KPIs & Filters
- [ ] Search & Filters

### High-Priority Innovation
- [ ] Demand Forecasting (7-day/28-day moving average + trend + cold-start fallback)
- [ ] Stockout Prediction with documented risk tiers (Low/Medium/High)
- [ ] Smart Reorder Recommendation (exact documented formula, floored at 0)
- [ ] Anomaly Detection (adaptive EWMA baseline + known-event exclusion)
- [ ] Explainability Engine (numeric inputs reflected in plain language bullets)
- [ ] Prediction Log / accuracy feedback view

### Optional / Progressive Polish
- [ ] Stock Health Score (0-100 composite)
- [ ] Warehouse Worker Mode (touch-first manual search + barcode scan capability)
- [ ] Return Orders (customer/supplier)
- [ ] Lot/Batch tracking & FEFO picking
- [ ] In-App Notification Center & simulated email logger

---

## 15. Build Sequencing (Hackathon Plan)
- **Phase 1 — Foundation (Ledger-First)**: Auth/RBAC -> Products/Suppliers/Warehouses -> StockMovement + StockByLocation with transactional writes -> basic Receipt/Delivery/Transfer flows writing to ledger. *(Completed & Passing)*
- **Phase 2b — Synthetic Demo Data + Dashboard Shell**: Seed script (Section 8) -> Adjustment + approval flow -> Dashboard KPIs + filters + React/Tailwind frontend shell.
- **Phase 3 — Intelligence Layer**: Forecasting -> Stockout prediction -> Reorder recommendation -> Explainability bullets, all driven off the same ledger data.
- **Phase 4 — Differentiators**: Anomaly detection -> Prediction log/accuracy view -> Stock Health Score.
- **Phase 5 — Polish**: Worker Mode UI -> Notifications -> Return/Lots -> End-to-end demo rehearsal.

---

## 16. Demo Script
1. **Receive stock**: Show a PO turning into a Receipt, stock ledger updates live with weighted average cost calculation.
2. **Establish demand**: Point to the seeded 60–90 day history showing a believable, slightly upward trend.
3. **Trigger the manufactured anomaly**: System flags it against the adaptive EWMA baseline (not a static rule) and explains why it's unusual.
4. **Predict stockout**: Show the days-remaining calculation live, tied to the actual forecasted daily demand number on screen.
5. **Recommend reorder**: Show the formula's inputs (lead time, safety stock, pending orders) plugged into the visible number.
6. **Explain**: Bullets generated from the same inputs just shown, plus the risk tier/score.
7. **Show the accuracy view**: Review predicted stockout date vs actual outcome from historical `PredictionLog`.

---

## 17. Competitive Positioning
**Traditional System**: "What do I have? -> 148 units"  
**StockSense**: 
- "What do I have? -> 148 units"
- "What will happen? -> Stockout in 5.5 days"
- "Why? -> Demand up 22% vs trailing average, below safety stock"
- "What should I do? -> Reorder 120 units"
- "Is anything suspicious? -> Unusual spike flagged (EWMA ± 3σ), typical range shown"
- "How good are these predictions? -> Accuracy log with verifiable historical audit"
