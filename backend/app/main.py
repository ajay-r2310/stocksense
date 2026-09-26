"""StockSense Main FastAPI Application Entry Point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings, SessionLocal
from app.db.init_db import init_db
from app.api.routes import auth, products, warehouses, suppliers, inventory, orders

app = FastAPI(
    title="StockSense API",
    description="Predictive & Explainable Inventory Intelligence Platform API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development / preview
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        init_db(db)
    finally:
        db.close()


@app.get("/")
def root():
    return {
        "app": "StockSense",
        "tagline": "Predictive & Explainable Inventory Intelligence Platform",
        "status": "operational",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


# Mount API V1 Routers
api_v1_prefix = settings.API_V1_STR
app.include_router(auth.router, prefix=api_v1_prefix)
app.include_router(products.router, prefix=api_v1_prefix)
app.include_router(warehouses.router, prefix=api_v1_prefix)
app.include_router(suppliers.router, prefix=api_v1_prefix)
app.include_router(inventory.router, prefix=api_v1_prefix)
app.include_router(orders.router, prefix=api_v1_prefix)
