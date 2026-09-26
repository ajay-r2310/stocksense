import React, { useState } from "react";
import { Layers, Database, Search, ArrowDownRight, ArrowUpRight, CheckCircle2, ShieldCheck, Filter } from "lucide-react";
import { StockByLocation, StockMovement, Product } from "../types";

interface InventoryLedgerViewProps {
  stockByLocation: StockByLocation[];
  movements: StockMovement[];
  products: Product[];
}

export const InventoryLedgerView: React.FC<InventoryLedgerViewProps> = ({
  stockByLocation,
  movements,
  products,
}) => {
  const [activeTab, setActiveTab] = useState<"cache" | "ledger">("cache");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("");

  const filteredStock = stockByLocation.filter((item) => {
    const nameMatch = item.product?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const skuMatch = item.product?.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const locMatch = item.location?.name.toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || skuMatch || locMatch;
  });

  const filteredMovements = movements.filter((m) => {
    const nameMatch = m.product?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const skuMatch = m.product?.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const refMatch = m.reference_id?.toLowerCase().includes(searchQuery.toLowerCase());
    const typeMatch = selectedType ? m.movement_type === selectedType : true;
    return (nameMatch || skuMatch || refMatch) && typeMatch;
  });

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-indigo-400" />
            Stock Ledger & Cache Architecture
          </h1>
          <p className="text-sm text-slate-400">
            Append-only single source of truth ledger with transactional read cache.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("cache")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "cache"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            StockByLocation Cache ({stockByLocation.length})
          </button>
          <button
            onClick={() => setActiveTab("ledger")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "ledger"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Append-Only Ledger ({movements.length})
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by product name, SKU, reference ID, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          {activeTab === "ledger" && (
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">All Movement Types</option>
              <option value="RECEIPT">RECEIPT</option>
              <option value="DELIVERY">DELIVERY</option>
              <option value="TRANSFER_IN">TRANSFER_IN</option>
              <option value="TRANSFER_OUT">TRANSFER_OUT</option>
              <option value="ADJUSTMENT">ADJUSTMENT</option>
            </select>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
          <ShieldCheck className="w-4 h-4" />
          <span>Transactional Mutex & Row Locks Enforced</span>
        </div>
      </div>

      {/* Tab 1: StockByLocation Cache */}
      {activeTab === "cache" && (
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-900/80 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Product / SKU</th>
                <th className="py-3.5 px-4">Warehouse & Location</th>
                <th className="py-3.5 px-4 text-right">On-Hand Qty</th>
                <th className="py-3.5 px-4 text-right">Reserved Qty</th>
                <th className="py-3.5 px-4 text-right">Available Qty</th>
                <th className="py-3.5 px-4 text-right">Avg Unit Cost</th>
                <th className="py-3.5 px-4 text-right">Total Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredStock.map((row) => {
                const totalVal = row.on_hand_qty * (row.product?.average_cost || 0);
                return (
                  <tr key={row.id} className="hover:bg-slate-850/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200">{row.product?.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{row.product?.sku}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-300">
                        {row.location?.warehouse?.name || "Fulfillment Hub"}
                      </div>
                      <div className="text-[10px] text-indigo-400 font-mono">{row.location?.name}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-200">
                      {row.on_hand_qty} {row.product?.base_uom?.symbol || "pcs"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-indigo-300">
                      {row.reserved_qty}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                      {row.available_qty}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-400">
                      ${(row.product?.average_cost || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-200">
                      ${totalVal.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Append-Only Stock Movements Ledger */}
      {activeTab === "ledger" && (
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-900/80 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Movement ID / Date</th>
                <th className="py-3.5 px-4">Product / SKU</th>
                <th className="py-3.5 px-4">Type & Reference</th>
                <th className="py-3.5 px-4">Source &rarr; Destination</th>
                <th className="py-3.5 px-4 text-right">Signed Quantity</th>
                <th className="py-3.5 px-4 text-right">Unit Cost</th>
                <th className="py-3.5 px-4">Reason / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredMovements.slice(0, 100).map((m) => {
                const isInbound = m.quantity > 0;
                return (
                  <tr key={m.id} className="hover:bg-slate-850/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      <div className="text-slate-300 font-semibold">#{m.id.toString().padStart(6, "0")}</div>
                      <div className="text-[10px]">{new Date(m.timestamp).toLocaleString()}</div>
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <div className="font-semibold text-slate-200">{m.product?.name || `Product #${m.product_id}`}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{m.product?.sku}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold mb-1 ${
                          m.movement_type === "RECEIPT"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : m.movement_type === "DELIVERY"
                            ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {m.movement_type}
                      </span>
                      <div className="text-[10px] text-slate-400">{m.reference_id || "Direct"}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {m.source_location?.name || "EXTERNAL"} &rarr; {m.destination_location?.name || "EXTERNAL"}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-bold ${
                        isInbound ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {isInbound ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-400">
                      {m.unit_cost ? `$${m.unit_cost.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-3.5 px-4 font-sans text-slate-400 text-[11px]">
                      {m.reason || "Standard automated flow"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
