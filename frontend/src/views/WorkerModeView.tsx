import React, { useState, useEffect } from "react";
import {
  Smartphone,
  ArrowDownLeft,
  ArrowRightLeft,
  ClipboardList,
  ArrowUpRight,
  Search,
  Barcode,
  CheckCircle2,
  AlertCircle,
  Package,
  MapPin,
  Building2,
  Volume2,
  RefreshCw,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Product, Location, Warehouse, StockByLocation } from "../types";

interface WorkerModeViewProps {
  products: Product[];
  locations: Location[];
  warehouses: Warehouse[];
  stockByLocation: StockByLocation[];
  onRefreshData: () => void;
}

export const WorkerModeView: React.FC<WorkerModeViewProps> = ({
  products,
  locations,
  warehouses,
  stockByLocation,
  onRefreshData,
}) => {
  const { user } = useAuth();
  const [activeAction, setActiveAction] = useState<"RECEIVE" | "MOVE" | "COUNT" | "PICK">("RECEIVE");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(products[0] || null);

  // Form Fields
  const [sourceLocId, setSourceLocId] = useState<number>(locations[0]?.id || 1);
  const [destLocId, setDestLocId] = useState<number>(locations[0]?.id || 1);
  const [quantity, setQuantity] = useState<number>(10);
  const [referenceId, setReferenceId] = useState("PO-DEMO-01");
  const [reason, setReason] = useState("Standard Warehouse Processing");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [simulatedScannerActive, setSimulatedScannerActive] = useState(false);

  // Filter products by manual search
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio fallback silent
    }
  };

  const handleSimulateBarcodeScan = (prod: Product) => {
    playBeep();
    setSelectedProduct(prod);
    setSimulatedScannerActive(false);
    setStatusMsg({
      type: "success",
      text: `Scanned Barcode for SKU: ${prod.sku} (${prod.name})`,
    });
    setTimeout(() => setStatusMsg(null), 3500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      setStatusMsg({ type: "error", text: "Please select a product first." });
      return;
    }
    if (quantity <= 0) {
      setStatusMsg({ type: "error", text: "Quantity must be strictly positive." });
      return;
    }

    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      if (activeAction === "RECEIVE") {
        await api.createMovement({
          product_id: selectedProduct.id,
          movement_type: "RECEIPT",
          quantity: Number(quantity),
          destination_location_id: Number(destLocId),
          reference_id: referenceId || "PO-WORKER",
          reason: reason || "Inbound Dock Receipt",
        });
        setStatusMsg({
          type: "success",
          text: `Received +${quantity} ${selectedProduct.base_uom?.symbol || "units"} into Bin #${destLocId}`,
        });
      } else if (activeAction === "MOVE") {
        if (sourceLocId === destLocId) {
          throw new Error("Source location and Destination location cannot be the same.");
        }
        await api.createMovement({
          product_id: selectedProduct.id,
          movement_type: "TRANSFER_OUT",
          quantity: Number(quantity),
          source_location_id: Number(sourceLocId),
          destination_location_id: Number(destLocId),
          reference_id: "INTERNAL-TRANSFER",
          reason: reason || "Relocation",
        });
        setStatusMsg({
          type: "success",
          text: `Moved ${quantity} units from Bin #${sourceLocId} to Bin #${destLocId}`,
        });
      } else if (activeAction === "PICK") {
        await api.createMovement({
          product_id: selectedProduct.id,
          movement_type: "DELIVERY",
          quantity: Number(quantity),
          source_location_id: Number(sourceLocId),
          reference_id: referenceId || "SO-PICK",
          reason: reason || "Outbound Dispatch",
        });
        setStatusMsg({
          type: "success",
          text: `Picked & Dispatched -${quantity} ${selectedProduct.base_uom?.symbol || "units"} from Bin #${sourceLocId}`,
        });
      } else if (activeAction === "COUNT") {
        await api.submitAdjustment({
          product_id: selectedProduct.id,
          location_id: Number(sourceLocId),
          counted_qty: Number(quantity),
          reason: reason || "Cycle Count discrepancy detected",
        });
        setStatusMsg({
          type: "success",
          text: `Physical count of ${quantity} units submitted to Manager Approval Queue.`,
        });
      }

      onRefreshData();
      setTimeout(() => setStatusMsg(null), 5000);
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Action failed." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Mobile-first Header Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 text-white">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">Warehouse Worker Mode</h1>
              <span className="text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Touch-Optimized
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
              <span>Assigned Operator: <strong className="text-slate-200">{user?.name}</strong></span>
              <span>•</span>
              <span className="flex items-center gap-1"><Building2 className="w-3 h-3 text-indigo-400" /> WH-MAIN Hub</span>
            </p>
          </div>
        </div>

        <button
          onClick={() => setSimulatedScannerActive(!simulatedScannerActive)}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition border ${
            simulatedScannerActive
              ? "bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/40 animate-pulse"
              : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
          }`}
        >
          <Barcode className="w-4 h-4 text-indigo-400" />
          {simulatedScannerActive ? "Scanner Active" : "Barcode Scanner"}
        </button>
      </div>

      {/* Simulated Barcode Scanner Drawer */}
      {simulatedScannerActive && (
        <div className="bg-slate-950/90 border border-indigo-500/40 rounded-2xl p-5 space-y-3 animate-fadeIn shadow-2xl">
          <div className="flex items-center justify-between text-xs text-indigo-300 font-semibold border-b border-slate-800 pb-2">
            <span className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-indigo-400" />
              Simulated Barcode Camera Feed & Scan Targets:
            </span>
            <span className="text-slate-400 text-[11px]">Click a SKU barcode to simulate camera scan</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {products.slice(0, 8).map((p) => (
              <button
                key={p.id}
                onClick={() => handleSimulateBarcodeScan(p)}
                className="p-2.5 rounded-lg bg-slate-900 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/60 text-left transition space-y-1 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-indigo-400 font-bold group-hover:text-indigo-300">
                    {p.sku}
                  </span>
                  <Barcode className="w-4 h-4 text-slate-500 group-hover:text-indigo-400" />
                </div>
                <div className="text-xs font-semibold text-slate-200 truncate">{p.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {statusMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium animate-fadeIn ${
            statusMsg.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/15 border-rose-500/30 text-rose-300"
          }`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* 4 Primary Action Selector Buttons (Large Touch Targets) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setActiveAction("RECEIVE")}
          className={`p-4 rounded-xl font-bold text-sm transition-all flex flex-col items-center gap-2 border ${
            activeAction === "RECEIVE"
              ? "bg-gradient-to-b from-indigo-600 to-indigo-700 text-white border-indigo-400 shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/20"
              : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border-slate-800"
          }`}
        >
          <ArrowDownLeft className="w-6 h-6 text-indigo-300" />
          RECEIVE
          <span className="text-[10px] font-normal text-slate-300">Inbound Receipts</span>
        </button>

        <button
          onClick={() => setActiveAction("MOVE")}
          className={`p-4 rounded-xl font-bold text-sm transition-all flex flex-col items-center gap-2 border ${
            activeAction === "MOVE"
              ? "bg-gradient-to-b from-indigo-600 to-indigo-700 text-white border-indigo-400 shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/20"
              : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border-slate-800"
          }`}
        >
          <ArrowRightLeft className="w-6 h-6 text-indigo-300" />
          MOVE
          <span className="text-[10px] font-normal text-slate-300">Location Relocate</span>
        </button>

        <button
          onClick={() => setActiveAction("COUNT")}
          className={`p-4 rounded-xl font-bold text-sm transition-all flex flex-col items-center gap-2 border ${
            activeAction === "COUNT"
              ? "bg-gradient-to-b from-indigo-600 to-indigo-700 text-white border-indigo-400 shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/20"
              : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border-slate-800"
          }`}
        >
          <ClipboardList className="w-6 h-6 text-indigo-300" />
          COUNT
          <span className="text-[10px] font-normal text-slate-300">Cycle Count Audit</span>
        </button>

        <button
          onClick={() => setActiveAction("PICK")}
          className={`p-4 rounded-xl font-bold text-sm transition-all flex flex-col items-center gap-2 border ${
            activeAction === "PICK"
              ? "bg-gradient-to-b from-indigo-600 to-indigo-700 text-white border-indigo-400 shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/20"
              : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border-slate-800"
          }`}
        >
          <ArrowUpRight className="w-6 h-6 text-indigo-300" />
          PICK
          <span className="text-[10px] font-normal text-slate-300">Outbound Dispatch</span>
        </button>
      </div>

      {/* Main Touch Screen Form */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        {/* Step 1: Search & Product Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
            1. Select SKU / Item:
          </label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Type SKU (e.g. MCU-STM32F4, DISP-OLED) or item name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-100 text-sm rounded-xl pl-10 pr-4 py-3 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {searchQuery && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-800/80 mt-1 shadow-2xl">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProduct(p);
                    setSearchQuery("");
                  }}
                  className="w-full text-left p-3 hover:bg-slate-800/60 transition flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-bold text-indigo-400 font-mono">{p.sku}</span>
                    <span className="text-xs text-slate-200 ml-2 font-medium">{p.name}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">{p.base_uom?.symbol || "units"}</span>
                </button>
              ))}
            </div>
          )}

          {selectedProduct && (
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-indigo-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                  SKU
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{selectedProduct.name}</div>
                  <div className="text-xs text-indigo-300 font-mono">{selectedProduct.sku}</div>
                </div>
              </div>
              <span className="text-xs text-slate-400 font-semibold bg-slate-800 px-2.5 py-1 rounded">
                Safety Stock: {selectedProduct.safety_stock}
              </span>
            </div>
          )}
        </div>

        {/* Step 2: Form Parameters for Active Action */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-slate-800/80">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Quantity */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Quantity ({selectedProduct?.base_uom?.symbol || "units"}):
              </label>
              <input
                type="number"
                min="0.1"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 text-white font-bold text-lg rounded-xl p-3 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Reference ID */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Reference ID / Document #:</label>
              <input
                type="text"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                placeholder="e.g. PO-8821, SO-4402, BATCH-12"
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl p-3 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Source Location (for MOVE, PICK, COUNT) */}
            {(activeAction === "MOVE" || activeAction === "PICK" || activeAction === "COUNT") && (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Source Location (Bin):
                </label>
                <select
                  value={sourceLocId}
                  onChange={(e) => setSourceLocId(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl p-3 focus:border-indigo-500 focus:outline-none"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.code ? `(${l.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Destination Location (for RECEIVE, MOVE) */}
            {(activeAction === "RECEIVE" || activeAction === "MOVE") && (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Destination Location (Bin):
                </label>
                <select
                  value={destLocId}
                  onChange={(e) => setDestLocId(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl p-3 focus:border-indigo-500 focus:outline-none"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.code ? `(${l.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Operational Notes / Reason:</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl p-3 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !selectedProduct}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-base shadow-xl shadow-indigo-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" /> Recording Mutation...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" /> Execute {activeAction} Action
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
