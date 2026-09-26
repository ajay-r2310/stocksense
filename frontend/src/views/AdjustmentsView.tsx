import React, { useState } from "react";
import { ClipboardCheck, Check, X, ShieldAlert, Plus, AlertCircle } from "lucide-react";
import { InventoryAdjustment, Product, Location } from "../types";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";

interface AdjustmentsViewProps {
  adjustments: InventoryAdjustment[];
  products: Product[];
  locations: Location[];
  onRefresh: () => void;
}

export const AdjustmentsView: React.FC<AdjustmentsViewProps> = ({
  adjustments,
  products,
  locations,
  onRefresh,
}) => {
  const { user, hasRole } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [productId, setProductId] = useState<number>(products[0]?.id || 1);
  const [locationId, setLocationId] = useState<number>(locations[0]?.id || 1);
  const [countedQty, setCountedQty] = useState<number>(100);
  const [reason, setReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const canApprove = hasRole(["Admin", "Inventory Manager"]);

  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      setErrorMsg("Reason is required for inventory adjustments");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await api.submitAdjustment({
        product_id: productId,
        location_id: locationId,
        counted_qty: Number(countedQty),
        reason,
      });
      setShowModal(false);
      setReason("");
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit adjustment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await api.approveAdjustment(id);
      await onRefresh();
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    }
  };

  const handleReject = async (id: number) => {
    try {
      await api.rejectAdjustment(id);
      await onRefresh();
    } catch (err: any) {
      alert(`Reject error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ClipboardCheck className="w-6 h-6 text-indigo-400" />
            Inventory Adjustments & Approval Queue
          </h1>
          <p className="text-sm text-slate-400">
            Physical cycle count discrepancies requiring Manager sign-off before applying to the ledger.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          Submit Physical Count
        </button>
      </div>

      {/* Adjustments Queue Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-900/80 border-b border-slate-800">
            <tr>
              <th className="py-3.5 px-4">Adjustment ID / Date</th>
              <th className="py-3.5 px-4">Product / SKU</th>
              <th className="py-3.5 px-4">Location</th>
              <th className="py-3.5 px-4 text-right">System Qty</th>
              <th className="py-3.5 px-4 text-right">Counted Qty</th>
              <th className="py-3.5 px-4 text-right">Difference</th>
              <th className="py-3.5 px-4">Reason / Notes</th>
              <th className="py-3.5 px-4 text-center">Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {adjustments.map((adj) => {
              const isPending = adj.status === "pending_approval";
              const isPositive = adj.difference >= 0;

              return (
                <tr key={adj.id} className="hover:bg-slate-850/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-slate-400">
                    <div className="font-semibold text-slate-200">#ADJ-{adj.id.toString().padStart(4, "0")}</div>
                    <div className="text-[10px]">{new Date(adj.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-200">{adj.product?.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{adj.product?.sku}</div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300 font-medium">
                    {adj.location?.name || `Loc #${adj.location_id}`}
                  </td>
                  <td className="py-3.5 px-4 text-right font-medium text-slate-300">
                    {adj.recorded_qty}
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-slate-100">
                    {adj.counted_qty}
                  </td>
                  <td
                    className={`py-3.5 px-4 text-right font-bold ${
                      isPositive ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {isPositive ? `+${adj.difference}` : adj.difference}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate">
                    {adj.reason}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        adj.status === "approved"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : adj.status === "pending_approval"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {adj.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {isPending && canApprove ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleApprove(adj.id)}
                          className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all"
                          title="Approve & Apply to Ledger"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleReject(adj.id)}
                          className="p-1.5 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white transition-all"
                          title="Reject"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500">
                        {isPending ? "Pending Mgr" : "Resolved"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Physical Count Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121927] border border-slate-700/80 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">Record Physical Inventory Count</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmitAdjustment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Product SKU</label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Warehouse Location</label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Physical Counted Quantity</label>
                <input
                  type="number"
                  step="any"
                  value={countedQty}
                  onChange={(e) => setCountedQty(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Reason for Count Discrepancy</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Discovered unlabelled box during quarterly cycle count..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 h-20 placeholder-slate-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500 shadow-md shadow-indigo-600/20"
                >
                  {isSubmitting ? "Submitting..." : "Submit Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
