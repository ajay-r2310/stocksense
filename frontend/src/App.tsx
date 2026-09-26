import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { DashboardView } from "./views/DashboardView";
import { WorkerModeView } from "./views/WorkerModeView";
import { IntelligenceView } from "./views/IntelligenceView";
import { AnomaliesView } from "./views/AnomaliesView";
import { InventoryLedgerView } from "./views/InventoryLedgerView";
import { ProductsView } from "./views/ProductsView";
import { OrdersView } from "./views/OrdersView";
import { AdjustmentsView } from "./views/AdjustmentsView";
import { WarehousesView } from "./views/WarehousesView";
import { SuppliersView } from "./views/SuppliersView";
import { LoginView } from "./views/LoginView";
import { api } from "./services/api";
import { Product, Category, Warehouse, Location, Supplier, StockByLocation, StockMovement, PurchaseOrder, SalesOrder, InventoryAdjustment } from "./types";

const MainApp: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>("dashboard");
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null);

  // Application Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockByLocation, setStockByLocation] = useState<StockByLocation[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);

  const fetchAllData = async () => {
    if (!isAuthenticated) return;
    setIsDataLoading(true);
    try {
      const [
        prodsRes,
        catsRes,
        whsRes,
        supsRes,
        stockRes,
        movsRes,
        posRes,
        sosRes,
        adjsRes,
      ] = await Promise.all([
        api.getProducts().catch(() => []),
        api.getCategories().catch(() => []),
        api.getWarehouses().catch(() => []),
        api.getSuppliers().catch(() => []),
        api.getStockByLocation(selectedWarehouse || undefined).catch(() => []),
        api.getMovements(0, 100).catch(() => []),
        api.getPurchaseOrders().catch(() => []),
        api.getSalesOrders().catch(() => []),
        api.getAdjustments().catch(() => []),
      ]);

      setProducts(prodsRes);
      setCategories(catsRes);
      setWarehouses(whsRes);
      setSuppliers(supsRes);
      setStockByLocation(stockRes);
      setMovements(movsRes);
      setPurchaseOrders(posRes);
      setSalesOrders(sosRes);
      setAdjustments(adjsRes);

      // Fetch locations if warehouses exist
      if (whsRes.length > 0) {
        const locs = await api.getLocations(whsRes[0].id).catch(() => []);
        setLocations(locs);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllData();
    }
  }, [isAuthenticated, selectedWarehouse]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070A10] flex items-center justify-center text-slate-400 text-sm">
        Initializing StockSense Workspace...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex">
      {/* Sidebar */}
      <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          warehouses={warehouses}
          selectedWarehouse={selectedWarehouse}
          onSelectWarehouse={setSelectedWarehouse}
          onRefreshData={fetchAllData}
        />

        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
          {currentTab === "dashboard" && (
            <DashboardView
              products={products}
              stockByLocation={stockByLocation}
              purchaseOrders={purchaseOrders}
              salesOrders={salesOrders}
              movements={movements}
              adjustments={adjustments}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === "worker_mode" && (
            <WorkerModeView
              products={products}
              locations={locations}
              warehouses={warehouses}
              stockByLocation={stockByLocation}
              onRefreshData={fetchAllData}
            />
          )}

          {currentTab === "intelligence" && (
            <IntelligenceView
              products={products}
              categories={categories}
            />
          )}

          {currentTab === "anomalies" && (
            <AnomaliesView
              products={products}
            />
          )}

          {currentTab === "inventory" && (
            <InventoryLedgerView
              stockByLocation={stockByLocation}
              movements={movements}
              products={products}
            />
          )}

          {currentTab === "products" && (
            <ProductsView
              products={products}
              categories={categories}
              stockByLocation={stockByLocation}
            />
          )}

          {currentTab === "orders" && (
            <OrdersView
              purchaseOrders={purchaseOrders}
              salesOrders={salesOrders}
              locations={locations}
              onRefresh={fetchAllData}
            />
          )}

          {currentTab === "adjustments" && (
            <AdjustmentsView
              adjustments={adjustments}
              products={products}
              locations={locations}
              onRefresh={fetchAllData}
            />
          )}

          {currentTab === "warehouses" && (
            <WarehousesView warehouses={warehouses} locations={locations} />
          )}

          {currentTab === "suppliers" && <SuppliersView suppliers={suppliers} />}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
