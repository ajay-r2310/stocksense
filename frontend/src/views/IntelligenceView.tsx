import React, { useState, useEffect } from "react";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  ShoppingCart,
  CheckCircle2,
  HelpCircle,
  BarChart3,
  Calendar,
  Sparkles,
  ArrowRight,
  Info,
  RefreshCw,
  Layers,
  ChevronRight,
  Target,
  FileCheck,
} from "lucide-react";
import { api } from "../services/api";
import { Product, Category } from "../types";

interface IntelligenceViewProps {
  products: Product[];
  categories: Category[];
}

export const IntelligenceView: React.FC<IntelligenceViewProps> = ({ products, categories }) => {
  const [activeTab, setActiveTab] = useState<"reorders" | "stockout" | "explainability" | "accuracy">("reorders");
  const [selectedProductId, setSelectedProductId] = useState<number>(products[0]?.id || 1);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Intelligence Data States
  const [reorders, setReorders] = useState<any[]>([]);
  const [stockoutRisks, setStockoutRisks] = useState<any[]>([]);
  const [currentForecast, setCurrentForecast] = useState<any | null>(null);
  const [currentExplainability, setCurrentExplainability] = useState<any | null>(null);
  const [accuracyReport, setAccuracyReport] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchIntelligenceData = async () => {
    setIsLoading(true);
    try {
      const [reordersRes, stockoutRes, accuracyRes] = await Promise.all([
        api.getReorderRecommendations().catch(() => []),
        api.getStockoutRisk().catch(() => []),
        api.getPredictionAccuracy().catch(() => null),
      ]);
      setReorders(reordersRes);
      setStockoutRisks(stockoutRes);
      setAccuracyReport(accuracyRes);

      if (selectedProductId) {
        await loadProductDeepDive(selectedProductId);
      }
    } catch (err) {
      console.error("Failed to fetch intelligence data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProductDeepDive = async (prodId: number) => {
    try {
      const [forecastRes, explainRes] = await Promise.all([
        api.getForecast(prodId).catch(() => null),
        api.getExplainability(prodId).catch(() => null),
      ]);
      setCurrentForecast(forecastRes);
      setCurrentExplainability(explainRes);
    } catch (err) {
      console.error("Failed to load product deep dive:", err);
    }
  };

  useEffect(() => {
    fetchIntelligenceData();
  }, [products]);

  useEffect(() => {
    if (selectedProductId) {
      loadProductDeepDive(selectedProductId);
    }
  }, [selectedProductId]);

  const handleCreatePODraft = (rec: any) => {
    setActionSuccess(`Draft Purchase Order queued for ${rec.product_name} (${rec.recommended_reorder_qty} ${rec.uom})`);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const filteredReorders = reorders.filter((r) => {
    if (selectedCategory === "all") return true;
    const prod = products.find((p) => p.sku === r.sku);
    return prod?.category_id?.toString() === selectedCategory;
  });

  const getRiskBadge = (tier: string) => {
    switch (tier?.toUpperCase()) {
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            High Risk
          </span>
        );
      case "MEDIUM":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Medium Risk
          </span>
        );
      case "LOW":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Low Risk
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Tab Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Inventory Intelligence Layer
                <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Adaptive Forecasting
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Moving average trend modeling, stockout horizon forecasting, and auditable reorder logic.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchIntelligenceData}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-indigo-400" : ""}`} />
            Refresh Intelligence
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3 text-emerald-300 text-sm animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab("reorders")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "reorders"
              ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Reorder Recommendations
          <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-slate-800 text-slate-300">
            {reorders.filter((r) => r.recommended_reorder_qty > 0).length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("stockout")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "stockout"
              ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Stockout Risk Monitor
        </button>

        <button
          onClick={() => setActiveTab("explainability")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "explainability"
              ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Per-Product Deep Dive & Explainability
        </button>

        <button
          onClick={() => setActiveTab("accuracy")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "accuracy"
              ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Target className="w-4 h-4" />
          Prediction Accuracy & Feedback Loop
        </button>
      </div>

      {/* Tab 1: Reorder Recommendations */}
      {activeTab === "reorders" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-medium">Filter Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id.toString()}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-400">
              Formula:{" "}
              <code className="bg-slate-950 text-indigo-300 px-2 py-0.5 rounded border border-slate-800 font-mono">
                max(0, (lead_time_days × forecast_demand) + safety_stock - (available_qty + in_transit_qty))
              </code>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl overflow-hidden shadow-xl backdrop-blur-md">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">SKU & Item Name</th>
                  <th className="px-4 py-3.5">Shortage Tier</th>
                  <th className="px-4 py-3.5 text-right">Forecast Demand</th>
                  <th className="px-4 py-3.5 text-right">Available Qty</th>
                  <th className="px-4 py-3.5 text-right">In-Transit POs</th>
                  <th className="px-4 py-3.5 text-right">Reorder Qty</th>
                  <th className="px-5 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredReorders.map((rec) => {
                  const isActionable = rec.recommended_reorder_qty > 0;
                  return (
                    <tr
                      key={rec.product_id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isActionable ? "bg-indigo-950/10" : ""
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-100">{rec.product_name}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{rec.sku}</div>
                      </td>
                      <td className="px-4 py-4">{getRiskBadge(rec.shortage_tier)}</td>
                      <td className="px-4 py-4 text-right font-medium text-slate-200">
                        {rec.forecasted_daily_demand?.toFixed(2)} <span className="text-xs text-slate-400">{rec.uom}/day</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="font-semibold text-slate-100">{rec.available_qty}</span>{" "}
                        <span className="text-xs text-slate-400">{rec.uom}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {rec.pending_incoming_qty > 0 ? (
                          <span className="text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 text-xs">
                            +{rec.pending_incoming_qty} {rec.uom}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">0</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {isActionable ? (
                          <span className="font-bold text-amber-400 text-base">
                            {rec.recommended_reorder_qty}{" "}
                            <span className="text-xs font-normal text-slate-400">{rec.uom}</span>
                          </span>
                        ) : (
                          <span className="text-emerald-400 text-xs font-medium flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Optimal
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {isActionable ? (
                          <button
                            onClick={() => handleCreatePODraft(rec)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition flex items-center gap-1.5 mx-auto"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            Draft PO
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedProductId(rec.product_id);
                              setActiveTab("explainability");
                            }}
                            className="text-xs text-slate-400 hover:text-indigo-300 transition flex items-center gap-1 mx-auto"
                          >
                            Explain <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Stockout Risk Monitor */}
      {activeTab === "stockout" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">High Risk Items</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2">
                {stockoutRisks.filter((s) => s.risk_tier === "HIGH").length}
              </div>
              <p className="text-xs text-rose-300/80 mt-1">Depletion projected within 4 days</p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Medium Risk Items</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2">
                {stockoutRisks.filter((s) => s.risk_tier === "MEDIUM").length}
              </div>
              <p className="text-xs text-amber-300/80 mt-1">Depletion projected within 4 to 14 days</p>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Low Risk / Stable</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2">
                {stockoutRisks.filter((s) => s.risk_tier === "LOW").length}
              </div>
              <p className="text-xs text-emerald-300/80 mt-1">Healthy buffer exceeding 14 days</p>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">SKU & Item</th>
                  <th className="px-4 py-3.5">Risk Tier</th>
                  <th className="px-4 py-3.5 text-right">Available Stock</th>
                  <th className="px-4 py-3.5 text-right">Daily Demand</th>
                  <th className="px-4 py-3.5 text-right">Days Remaining</th>
                  <th className="px-5 py-3.5">Est. Depletion Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {stockoutRisks.map((pred) => (
                  <tr key={pred.product_id} className="hover:bg-slate-800/40 transition">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-100">{pred.product_name}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{pred.sku}</div>
                    </td>
                    <td className="px-4 py-4">{getRiskBadge(pred.risk_tier)}</td>
                    <td className="px-4 py-4 text-right font-medium text-slate-200">
                      {pred.available_qty} {pred.uom}
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-indigo-300">
                      {pred.forecasted_daily_demand?.toFixed(2)} {pred.uom}/day
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span
                        className={`font-bold text-sm ${
                          pred.days_remaining < 4
                            ? "text-rose-400"
                            : pred.days_remaining <= 14
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {pred.days_remaining >= 999 ? ">999d" : `${pred.days_remaining.toFixed(1)} days`}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-300 text-xs">
                      {pred.predicted_depletion_date || "N/A (Sufficient buffer)"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Per-Product Deep Dive & Explainability */}
      {activeTab === "explainability" && (
        <div className="space-y-6">
          {/* Product selector card */}
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-300">Select Product:</span>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(Number(e.target.value))}
                className="bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 font-medium focus:outline-none focus:border-indigo-500"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            {currentForecast?.is_cold_start && (
              <div className="flex items-center gap-2 text-xs bg-amber-500/10 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg">
                <Info className="w-3.5 h-3.5" />
                <span>Cold Start Active: 8-day history &lt; 14 days $\rightarrow$ Falling back to category-level average</span>
              </div>
            )}
          </div>

          {currentForecast && currentExplainability && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Forecast Metrics & Calculations */}
              <div className="space-y-4">
                <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-lg space-y-4">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-400" />
                    Demand Signal Comparison
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
                      <div className="text-[11px] text-slate-400">7-Day Moving Avg</div>
                      <div className="text-lg font-bold text-indigo-300 mt-1">
                        {currentForecast.moving_avg_7d?.toFixed(2)}
                        <span className="text-xs font-normal text-slate-400 ml-1">/day</span>
                      </div>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
                      <div className="text-[11px] text-slate-400">28-Day Moving Avg</div>
                      <div className="text-lg font-bold text-slate-300 mt-1">
                        {currentForecast.moving_avg_28d?.toFixed(2)}
                        <span className="text-xs font-normal text-slate-400 ml-1">/day</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950/80 p-3.5 rounded-lg border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Trend Classification:</span>
                      <span
                        className={`font-semibold flex items-center gap-1 ${
                          currentForecast.trend === "UPWARD"
                            ? "text-rose-400"
                            : currentForecast.trend === "DOWNWARD"
                            ? "text-emerald-400"
                            : "text-slate-300"
                        }`}
                      >
                        {currentForecast.trend === "UPWARD" && <TrendingUp className="w-3.5 h-3.5" />}
                        {currentForecast.trend === "DOWNWARD" && <TrendingDown className="w-3.5 h-3.5" />}
                        {currentForecast.trend}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Active Forecast Demand:</span>
                      <span className="font-bold text-indigo-400 text-sm">
                        {currentForecast.forecasted_daily_demand?.toFixed(2)} /day
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stockout Horizon Summary Card */}
                <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-lg space-y-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    Stockout Horizon
                  </h3>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Risk Tier:</span>
                    {getRiskBadge(currentExplainability.stockout_prediction?.risk_tier)}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Available Stock:</span>
                    <span className="font-bold text-slate-100">
                      {currentExplainability.stockout_prediction?.available_qty}{" "}
                      {currentExplainability.stockout_prediction?.uom}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Days Remaining:</span>
                    <span className="font-bold text-amber-400">
                      {currentExplainability.stockout_prediction?.days_remaining?.toFixed(1)} days
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-xs text-slate-400">Est. Depletion:</span>
                    <span className="text-xs font-semibold text-slate-200">
                      {currentExplainability.stockout_prediction?.predicted_depletion_date || "Stable"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Programmatic Explainability Report */}
              <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800/80 rounded-xl p-6 shadow-xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-400" />
                      Auditable Intelligence Narrative
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Deterministic bullet points synthesized directly from live computed formulas
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-semibold text-slate-400">Shortage Tier</div>
                    <div className="mt-1">{getRiskBadge(currentExplainability.shortage_tier)}</div>
                  </div>
                </div>

                {/* Explanation Bullets */}
                <div className="space-y-3">
                  {currentExplainability.explanation_bullets?.map((bullet: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3.5 rounded-lg bg-slate-950/70 border border-slate-800/90 text-sm text-slate-200"
                    >
                      <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                        {idx + 1}
                      </div>
                      <div className="leading-relaxed">{bullet}</div>
                    </div>
                  ))}
                </div>

                {/* Formula Breakdown Breakdown Box */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-indigo-400" />
                    Computed Inputs Snapshot:
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-400 pt-1">
                    <div>
                      Lead Time: <span className="text-slate-200 font-semibold">{currentExplainability.reorder_recommendation?.lead_time_days}d</span>
                    </div>
                    <div>
                      Safety Stock: <span className="text-slate-200 font-semibold">{currentExplainability.reorder_recommendation?.safety_stock}</span>
                    </div>
                    <div>
                      In-Transit POs: <span className="text-slate-200 font-semibold">{currentExplainability.reorder_recommendation?.pending_incoming_qty}</span>
                    </div>
                    <div>
                      Reorder Output: <span className="text-amber-400 font-bold">{currentExplainability.reorder_recommendation?.recommended_reorder_qty}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Prediction Accuracy & Feedback Loop */}
      {activeTab === "accuracy" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-lg">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Mean Absolute Error (MAE)
              </div>
              <div className="text-2xl font-bold text-indigo-400 mt-2">
                {accuracyReport?.mae !== null ? `${accuracyReport?.mae?.toFixed(2)} units` : "Evaluating..."}
              </div>
              <p className="text-xs text-slate-400 mt-1">Average magnitude of demand forecasting delta</p>
            </div>

            <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-lg">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Root Mean Squared Error (RMSE)
              </div>
              <div className="text-2xl font-bold text-indigo-400 mt-2">
                {accuracyReport?.rmse !== null ? `${accuracyReport?.rmse?.toFixed(2)} units` : "Evaluating..."}
              </div>
              <p className="text-xs text-slate-400 mt-1">Penalizes large outlier forecast errors</p>
            </div>

            <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-lg">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Evaluated Prediction Logs
              </div>
              <div className="text-2xl font-bold text-emerald-400 mt-2">
                {accuracyReport?.evaluated_samples || 0}
              </div>
              <p className="text-xs text-slate-400 mt-1">Total backtested prediction snapshots</p>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Prediction Feedback Loop Architecture</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Whenever forecasts or stockout predictions are rendered, a snapshot is preserved in <code>PredictionLog</code>.
                  A backfill pipeline reconciles predicted demand against verified <code>StockMovement</code> ledger consumption.
                </p>
              </div>
              <button
                onClick={async () => {
                  setIsLoading(true);
                  await api.evaluatePredictions();
                  await fetchIntelligenceData();
                  setIsLoading(false);
                }}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Run Backfill Evaluation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
