import React, { useState } from "react";
import { Package, Search, Plus, Filter, Tag, Layers, ArrowUpRight } from "lucide-react";
import { Product, Category, StockByLocation } from "../types";

interface ProductsViewProps {
  products: Product[];
  categories: Category[];
  stockByLocation: StockByLocation[];
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  categories,
  stockByLocation,
}) => {
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<number | null>(null);

  const productStockMap = new Map<number, number>();
  for (const s of stockByLocation) {
    productStockMap.set(s.product_id, (productStockMap.get(s.product_id) || 0) + s.available_qty);
  }

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCat ? p.category_id === selectedCat : true;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Package className="w-6 h-6 text-indigo-400" />
            Product Master Catalog
          </h1>
          <p className="text-sm text-slate-400">
            SKU definitions, UOM conversion factors, costing, and safety parameters.
          </p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search products by SKU or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <select
            value={selectedCat || ""}
            onChange={(e) => setSelectedCat(e.target.value ? Number(e.target.value) : null)}
            className="bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((prod) => {
          const available = productStockMap.get(prod.id) || 0;
          const isLow = available <= prod.reorder_level;

          return (
            <div
              key={prod.id}
              className="glass-panel-interactive rounded-2xl p-5 border border-slate-800 space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 uppercase tracking-wide">
                    {prod.category?.name || "General"}
                  </span>
                  <span className="font-mono text-xs text-slate-400 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {prod.sku}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white leading-snug">{prod.name}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Supplier: <span className="text-slate-300">{prod.primary_supplier?.name || "Primary Vendor"}</span>
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-900/70 border border-slate-800/80 rounded-xl p-3 text-center">
                  <div>
                    <p className="text-[10px] text-slate-400">Available</p>
                    <p className={`text-sm font-bold ${isLow ? "text-amber-400" : "text-emerald-400"}`}>
                      {available}
                    </p>
                    <p className="text-[9px] text-slate-400">{prod.base_uom?.symbol || "pcs"}</p>
                  </div>
                  <div className="border-x border-slate-800">
                    <p className="text-[10px] text-slate-400">Reorder At</p>
                    <p className="text-sm font-semibold text-slate-200">{prod.reorder_level}</p>
                    <p className="text-[9px] text-slate-400">Safety: {prod.safety_stock}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Avg Cost</p>
                    <p className="text-sm font-semibold text-slate-200">${(prod.average_cost || 0).toFixed(2)}</p>
                    <p className="text-[9px] text-slate-400">Weighted</p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                <span>UOM Factor: 1 box = {prod.uom_conversion_factor} {prod.base_uom?.symbol || "pcs"}</span>
                {prod.is_lot_tracked && (
                  <span className="text-indigo-400 font-medium">Lot/FEFO Tracked</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
