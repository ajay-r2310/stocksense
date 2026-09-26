import React from "react";
import {
  Package,
  AlertTriangle,
  XCircle,
  Truck,
  TrendingUp,
  DollarSign,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Product, StockByLocation, PurchaseOrder, SalesOrder, StockMovement, InventoryAdjustment } from "../types";

interface DashboardViewProps {
  products: Product[];
  stockByLocation: StockByLocation[];
  purchaseOrders: PurchaseOrder[];
  salesOrders: SalesOrder[];
  movements: StockMovement[];
  adjustments: InventoryAdjustment[];
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  products,
  stockByLocation,
  purchaseOrders,
  salesOrders,
  movements,
  adjustments,
  onNavigate,
}) => {
  // Aggregate stock across locations per product
  const productStockMap = new Map<number, { onHand: number; reserved: number; available: number }>();
  for (const s of stockByLocation) {
    const curr = productStockMap.get(s.product_id) || { onHand: 0, reserved: 0, available: 0 };
    curr.onHand += s.on_hand_qty;
    curr.reserved += s.reserved_qty;
    curr.available += s.available_qty;
    productStockMap.set(s.product_id, curr);
  }

  // KPIs
  const totalProducts = products.length;
  let outOfStockCount = 0;
  let lowStockCount = 0;
  let totalInventoryValuation = 0;

  for (const p of products) {
    const stock = productStockMap.get(p.id) || { onHand: 0, reserved: 0, available: 0 };
    if (stock.available <= 0) {
      outOfStockCount++;
    } else if (stock.available <= p.reorder_level) {
      lowStockCount++;
    }
    totalInventoryValuation += stock.onHand * (p.average_cost || 0);
  }

  const pendingPOs = purchaseOrders.filter((po) => po.status === "confirmed" || po.status === "partial").length;
  const pendingSOs = salesOrders.filter((so) => so.status === "confirmed" || so.status === "partial").length;
  const pendingAdjustments = adjustments.filter((a) => a.status === "pending_approval").length;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex items-center justify-between bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> Operational Overview
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Inventory Operations & Intelligence Center
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Real-time ledger-backed tracking, automated stock reservation, and predictive reorder intelligence.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingAdjustments > 0 && (
            <button
              onClick={() => onNavigate("adjustments")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/20 transition-all shadow-lg shadow-amber-500/10"
            >
              <ShieldAlert className="w-4 h-4" />
              {pendingAdjustments} Adjustment{pendingAdjustments > 1 ? "s" : ""} Pending Sign-Off
            </button>
          )}
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Products */}
        <div className="glass-panel rounded-xl p-5 border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400">Total Active SKUs</p>
            <p className="text-2xl font-bold text-white">{totalProducts}</p>
            <p className="text-[11px] text-slate-500">Across 4 categories</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Low / Critical Stock */}
        <div className="glass-panel rounded-xl p-5 border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400">Low Stock / Out of Stock</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-400">{lowStockCount}</span>
              <span className="text-sm font-semibold text-rose-400">/ {outOfStockCount} critical</span>
            </div>
            <p className="text-[11px] text-slate-500">Below safety reorder level</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Inbound & Outbound */}
        <div className="glass-panel rounded-xl p-5 border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400">Pending Inbound / Outbound</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-400">{pendingPOs} POs</span>
              <span className="text-sm font-semibold text-indigo-400">/ {pendingSOs} SOs</span>
            </div>
            <p className="text-[11px] text-slate-500">Awaiting dock receipt & delivery</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Truck className="w-6 h-6" />
          </div>
        </div>

        {/* Inventory Valuation */}
        <div className="glass-panel rounded-xl p-5 border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400">Inventory Valuation</p>
            <p className="text-2xl font-bold text-slate-100">
              ${totalInventoryValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-emerald-400 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> Weighted-average costing
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Two Column Layout: Stock Status Table & Recent Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Inventory Health Table */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Critical Stock Status</h2>
              <p className="text-xs text-slate-400">Items requiring attention or reorder review</p>
            </div>
            <button
              onClick={() => onNavigate("products")}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
            >
              View Full Catalog &rarr;
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-900/60 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Product / SKU</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-right">On-Hand</th>
                  <th className="py-3 px-3 text-right">Reserved</th>
                  <th className="py-3 px-3 text-right">Available</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {products.slice(0, 6).map((prod) => {
                  const stock = productStockMap.get(prod.id) || { onHand: 0, reserved: 0, available: 0 };
                  const isCritical = stock.available <= 0;
                  const isLow = stock.available <= prod.reorder_level;

                  return (
                    <tr key={prod.id} className="hover:bg-slate-850/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-200">{prod.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{prod.sku}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700/50">
                          {prod.category?.name || "General"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-300">
                        {stock.onHand} {prod.base_uom?.symbol || "pcs"}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-indigo-300">
                        {stock.reserved}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-100">
                        {stock.available}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isCritical ? (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            Low Stock
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Optimal
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Live Append-Only Stock Movements */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Live Ledger Feed</h2>
                <p className="text-xs text-slate-400">Append-only transactions</p>
              </div>
              <button
                onClick={() => onNavigate("inventory")}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
              >
                Full Ledger &rarr;
              </button>
            </div>

            <div className="space-y-2.5">
              {movements.slice(0, 6).map((m) => {
                const isInbound = m.quantity > 0;
                return (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isInbound
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        }`}
                      >
                        {isInbound ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-200 truncate">
                          {m.product?.name || `Product #${m.product_id}`}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {m.movement_type} &bull; Ref: {m.reference_id || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-xs font-bold font-mono ${
                          isInbound ? "text-emerald-400" : "text-indigo-300"
                        }`}
                      >
                        {isInbound ? `+${m.quantity}` : m.quantity}
                      </p>
                      <p className="text-[9px] text-slate-400">
                        {new Date(m.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              Strict apply_movement() enforcement
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
