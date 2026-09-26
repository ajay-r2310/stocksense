import React from "react";
import { Truck, Clock, ShieldCheck, Mail } from "lucide-react";
import { Supplier } from "../types";

interface SuppliersViewProps {
  suppliers: Supplier[];
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({ suppliers }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Truck className="w-6 h-6 text-indigo-400" />
          Suppliers & Lead Times
        </h1>
        <p className="text-sm text-slate-400">
          Vendor directory, contractual lead times, and reliability scoring parameters.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {suppliers.map((sup) => (
          <div
            key={sup.id}
            className="glass-panel-interactive rounded-2xl p-5 border border-slate-800 space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">{sup.name}</h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    {sup.contact_info || "procurement@vendor.com"}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Truck className="w-5 h-5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-900/70 border border-slate-800/80 rounded-xl p-3 text-center">
                <div>
                  <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-400" />
                    Lead Time
                  </p>
                  <p className="text-sm font-bold text-slate-100">{sup.default_lead_time_days} days</p>
                  <p className="text-[9px] text-slate-500">Order to dock</p>
                </div>
                <div className="border-l border-slate-800">
                  <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    Reliability
                  </p>
                  <p className="text-sm font-bold text-emerald-400">
                    {(sup.reliability_score * 100).toFixed(0)}%
                  </p>
                  <p className="text-[9px] text-slate-500">On-time fulfillment</p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 text-center">
              Active Procurement Vendor &bull; ID: #{sup.id}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
