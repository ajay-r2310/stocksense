import React, { useState } from "react";
import { ArrowLeftRight, Truck, CheckCircle2, Clock, PackageCheck, AlertCircle } from "lucide-react";
import { PurchaseOrder, SalesOrder, Location } from "../types";
import { api } from "../services/api";

interface OrdersViewProps {
  purchaseOrders: PurchaseOrder[];
  salesOrders: SalesOrder[];
  locations: Location[];
  onRefresh: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  purchaseOrders,
  salesOrders,
  locations,
  onRefresh,
}) => {
  const [tab, setTab] = useState<"po" | "so">("po");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleReceivePO = async (po: PurchaseOrder) => {
    const loc = locations[0];
    if (!loc) {
      alert("No destination warehouse location available");
      return;
    }
    const items = po.lines.map((l) => ({
      product_id: l.product_id,
      qty: l.ordered_qty - l.received_qty,
    })).filter((i) => i.qty > 0);

    if (items.length === 0) return;

    setIsProcessing(true);
    setErrorMsg("");
    try {
      await api.receivePO(po.id, loc.id, items);
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to receive order");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeliverSO = async (so: SalesOrder) => {
    const loc = locations[0];
    if (!loc) {
      alert("No source location available");
      return;
    }
    const items = so.lines.map((l) => ({
      product_id: l.product_id,
      qty: l.ordered_qty - l.delivered_qty,
    })).filter((i) => i.qty > 0);

    if (items.length === 0) return;

    setIsProcessing(true);
    setErrorMsg("");
    try {
      await api.deliverSO(so.id, loc.id, items);
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to deliver order");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ArrowLeftRight className="w-6 h-6 text-indigo-400" />
            Orders & Fulfillment Management
          </h1>
          <p className="text-sm text-slate-400">
            Purchase Orders (Inbound & Costing) & Sales Orders (Stock Reservation & Picking).
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setTab("po")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === "po"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Purchase Orders ({purchaseOrders.length})
          </button>
          <button
            onClick={() => setTab("so")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === "so"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Sales Orders ({salesOrders.length})
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {errorMsg}
        </div>
      )}

      {/* Orders List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tab === "po" &&
          purchaseOrders.slice(0, 30).map((po) => {
            const isDone = po.status === "done";
            return (
              <div
                key={po.id}
                className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-md">
                      {po.po_number}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isDone
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {po.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Vendor: {po.supplier?.name || `Supplier #${po.supplier_id}`}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Destination: {po.warehouse?.name || "Main Fulfillment"} &bull; Created:{" "}
                      {new Date(po.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="bg-slate-900/60 rounded-xl p-3 divide-y divide-slate-800/60 text-xs">
                    {po.lines.map((line) => (
                      <div key={line.id} className="py-1.5 first:pt-0 last:pb-0 flex items-center justify-between">
                        <span className="text-slate-300 font-medium">
                          {line.product?.name || `Product #${line.product_id}`}
                        </span>
                        <div className="text-right">
                          <span className="font-bold text-slate-200">
                            {line.received_qty} / {line.ordered_qty}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                            (${line.unit_cost.toFixed(2)}/ea)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {!isDone && (
                  <button
                    onClick={() => handleReceivePO(po)}
                    disabled={isProcessing}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20"
                  >
                    <PackageCheck className="w-4 h-4" />
                    Receive Inbound Shipment (Apply to Ledger)
                  </button>
                )}
              </div>
            );
          })}

        {tab === "so" &&
          salesOrders.slice(0, 30).map((so) => {
            const isDone = so.status === "done";
            return (
              <div
                key={so.id}
                className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                      {so.so_number}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isDone
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                      }`}
                    >
                      {so.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-white">Customer: {so.customer_name}</h3>
                    <p className="text-[11px] text-slate-400">
                      Warehouse: {so.warehouse?.name || "Main Fulfillment"} &bull; Created:{" "}
                      {new Date(so.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="bg-slate-900/60 rounded-xl p-3 divide-y divide-slate-800/60 text-xs">
                    {so.lines.map((line) => (
                      <div key={line.id} className="py-1.5 first:pt-0 last:pb-0 flex items-center justify-between">
                        <span className="text-slate-300 font-medium">
                          {line.product?.name || `Product #${line.product_id}`}
                        </span>
                        <div className="text-right">
                          <span className="font-bold text-slate-200">
                            {line.delivered_qty} / {line.ordered_qty}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                            (${line.unit_price.toFixed(2)}/ea)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {!isDone && (
                  <button
                    onClick={() => handleDeliverSO(so)}
                    disabled={isProcessing}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/20"
                  >
                    <Truck className="w-4 h-4" />
                    Deliver & Release Reserved Stock
                  </button>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};
