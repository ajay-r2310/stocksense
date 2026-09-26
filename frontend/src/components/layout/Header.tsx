import React, { useState, useEffect } from "react";
import { Bell, CheckCircle2, AlertTriangle, RefreshCw, Database } from "lucide-react";
import { api } from "../../services/api";
import { Warehouse, InvariantResult } from "../../types";

interface HeaderProps {
  warehouses: Warehouse[];
  selectedWarehouse: number | null;
  onSelectWarehouse: (id: number | null) => void;
  onRefreshData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  warehouses,
  selectedWarehouse,
  onSelectWarehouse,
  onRefreshData,
}) => {
  const [invariantStatus, setInvariantStatus] = useState<InvariantResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const checkInvariant = async () => {
    setIsVerifying(true);
    try {
      const res = await api.checkInvariant();
      setInvariantStatus(res);
    } catch (err) {
      console.error("Invariant check error:", err);
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    checkInvariant();
  }, []);

  return (
    <header className="h-16 bg-[#0D131F]/90 backdrop-blur-md border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Warehouse Selector & Context */}
      <div className="flex items-center gap-4">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Warehouse:
        </label>
        <select
          value={selectedWarehouse || ""}
          onChange={(e) => onSelectWarehouse(e.target.value ? Number(e.target.value) : null)}
          className="bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
        >
          <option value="">All Warehouses (Global)</option>
          {warehouses.map((wh) => (
            <option key={wh.id} value={wh.id}>
              {wh.name} ({wh.code})
            </option>
          ))}
        </select>
      </div>

      {/* Right: Live Invariant Badge & Actions */}
      <div className="flex items-center gap-3">
        {/* Ledger Invariant Real-time Indicator */}
        <button
          onClick={checkInvariant}
          disabled={isVerifying}
          title="Click to re-verify ledger sum(StockMovement) == StockByLocation.on_hand"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            invariantStatus?.is_valid
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
              : "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          {isVerifying ? (
            <span>Verifying Ledger...</span>
          ) : invariantStatus?.is_valid ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Ledger Invariant: 100% Verified
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              Invariant Discrepancy Found
            </span>
          )}
        </button>

        {/* Refresh button */}
        <button
          onClick={onRefreshData}
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Notifications */}
        <button
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors relative"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-[#0D131F]" />
        </button>
      </div>
    </header>
  );
};
