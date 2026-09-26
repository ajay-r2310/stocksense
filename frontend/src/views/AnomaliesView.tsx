import React, { useState, useEffect } from "react";
import {
  Activity,
  AlertOctagon,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Plus,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  XCircle,
  HelpCircle,
  Layers,
  ChevronRight,
  Sliders,
} from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Product } from "../types";

interface AnomaliesViewProps {
  products: Product[];
}

export const AnomaliesView: React.FC<AnomaliesViewProps> = ({ products }) => {
  const { hasRole, user } = useAuth();
  const [activeTab, setActiveTab] = useState<"feed" | "known_events" | "health">("feed");
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [knownEvents, setKnownEvents] = useState<any[]>([]);
  const [healthData, setHealthData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Known Event Form Modal
  const [showEventModal, setShowEventModal] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventStart, setNewEventStart] = useState("");
  const [newEventEnd, setNewEventEnd] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [anomRes, eventsRes, healthRes] = await Promise.all([
        api.getAnomalies().catch(() => []),
        api.getKnownEvents().catch(() => []),
        api.getStockHealthScore().catch(() => null),
      ]);
      setAnomalies(anomRes);
      setKnownEvents(eventsRes);
      setHealthData(healthRes);
    } catch (err) {
      console.error("Failed to load anomalies data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRunScan = async () => {
    setIsScanning(true);
    try {
      const res = await api.runAnomalyDetection();
      setSuccessMsg(`On-demand EWMA scan complete. ${res.scanned_records_count || 0} anomalies synchronized.`);
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Scan failed: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAcknowledge = async (id: number) => {
    try {
      await api.acknowledgeAnomaly(id);
      setSuccessMsg(`Anomaly #${id} acknowledged and logged.`);
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(`Failed to acknowledge: ${err.message}`);
    }
  };

  const handleCreateKnownEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName || !newEventStart || !newEventEnd) {
      alert("Please enter Name, Start Date, and End Date.");
      return;
    }
    try {
      await api.createKnownEvent({
        name: newEventName,
        start_date: new Date(newEventStart).toISOString(),
        end_date: new Date(newEventEnd).toISOString(),
        description: newEventDesc,
      });
      setShowEventModal(false);
      setNewEventName("");
      setNewEventStart("");
      setNewEventEnd("");
      setNewEventDesc("");
      setSuccessMsg("Known Event registered. EWMA baseline exclusion applied.");
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Failed to create event: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Anomaly Intelligence & Known Events
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                EWMA ±3σ Engine
              </span>
            </h1>
            <p className="text-sm text-slate-400">
              Statistical consumption surge detection with automated KnownEvent baseline exclusion.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasRole(["Admin", "Inventory Manager"]) && (
            <>
              <button
                onClick={() => setShowEventModal(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                Register Known Event
              </button>

              <button
                onClick={handleRunScan}
                disabled={isScanning}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-indigo-500/25 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
                Run On-Demand EWMA Scan
              </button>
            </>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3 text-emerald-300 text-sm animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab("feed")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "feed"
              ? "border-amber-500 text-amber-400 bg-amber-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <AlertOctagon className="w-4 h-4" />
          Anomaly Feed
          <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-slate-800 text-slate-300">
            {anomalies.filter((a) => !a.is_acknowledged).length} Active
          </span>
        </button>

        <button
          onClick={() => setActiveTab("known_events")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "known_events"
              ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Known Events (Exclusion Windows)
          <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-slate-800 text-slate-300">
            {knownEvents.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("health")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "health"
              ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Composite Stock Health Score (§7.6)
        </button>
      </div>

      {/* Tab 1: Anomaly Feed */}
      {activeTab === "feed" && (
        <div className="space-y-4">
          {anomalies.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-200">No Unflagged Anomalies Detected</h3>
              <p className="text-xs mt-1">
                All daily consumption movements fall safely within calculated EWMA ±3σ statistical bands.
              </p>
              {hasRole(["Admin", "Inventory Manager"]) && (
                <button
                  onClick={handleRunScan}
                  className="mt-4 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Run Statistical Scan Now
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {anomalies.map((anom) => (
                <div
                  key={anom.id}
                  className={`bg-slate-900/70 border rounded-xl p-5 shadow-lg backdrop-blur-md transition-all ${
                    anom.is_acknowledged
                      ? "border-slate-800/80 opacity-75"
                      : "border-amber-500/40 bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-amber-950/20"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                          <AlertOctagon className="w-3.5 h-3.5" />
                          {anom.anomaly_type} (+{anom.deviation_percentage}%)
                        </span>
                        <h3 className="text-base font-bold text-white">
                          {anom.product_name} <span className="text-xs text-slate-400 font-mono">({anom.sku})</span>
                        </h3>
                        {anom.is_acknowledged && (
                          <span className="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                            Acknowledged
                          </span>
                        )}
                      </div>

                      {/* Metrics comparison bar */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80">
                          <div className="text-[10px] text-slate-400 uppercase">Event Date</div>
                          <div className="text-xs font-semibold text-slate-200 mt-0.5">
                            {new Date(anom.event_date).toLocaleDateString()}
                          </div>
                        </div>

                        <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80">
                          <div className="text-[10px] text-slate-400 uppercase">Actual Volume</div>
                          <div className="text-xs font-bold text-rose-400 mt-0.5">
                            {anom.actual_quantity} {anom.uom}
                          </div>
                        </div>

                        <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80">
                          <div className="text-[10px] text-slate-400 uppercase">Expected EWMA</div>
                          <div className="text-xs font-semibold text-slate-300 mt-0.5">
                            {anom.expected_ewma} {anom.uom}
                          </div>
                        </div>

                        <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80">
                          <div className="text-[10px] text-slate-400 uppercase">Z-Score Deviation</div>
                          <div className="text-xs font-bold text-amber-400 mt-0.5">
                            +{anom.z_score} σ
                          </div>
                        </div>
                      </div>

                      {/* Explainability bullets */}
                      <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/80 space-y-1.5 mt-2">
                        <div className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" /> Explainable Root Causes:
                        </div>
                        <ul className="text-xs text-slate-300 space-y-1 pl-4 list-disc marker:text-indigo-500">
                          {anom.possible_causes?.map((cause: string, cidx: number) => (
                            <li key={cidx}>{cause}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Action button */}
                    {!anom.is_acknowledged && hasRole(["Admin", "Inventory Manager"]) && (
                      <div className="shrink-0">
                        <button
                          onClick={() => handleAcknowledge(anom.id)}
                          className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Acknowledge Anomaly
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Known Events */}
      {activeTab === "known_events" && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-300">
              <strong>KnownEvent Exclusion Architecture:</strong> Dates within these ranges are automatically
              excluded from EWMA baseline smoothing and outlier alerts, preventing anticipated seasonal surges from
              distorting rolling forecasts.
            </div>
            {hasRole(["Admin", "Inventory Manager"]) && (
              <button
                onClick={() => setShowEventModal(true)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shrink-0 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Window
              </button>
            )}
          </div>

          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Event Name</th>
                  <th className="px-4 py-3.5">Start Date</th>
                  <th className="px-4 py-3.5">End Date</th>
                  <th className="px-5 py-3.5">Description / Purpose</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {knownEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-5 py-4 font-semibold text-slate-100">{ev.name}</td>
                    <td className="px-4 py-4 text-slate-300 text-xs font-mono">
                      {new Date(ev.start_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 text-slate-300 text-xs font-mono">
                      {new Date(ev.end_date).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-xs">{ev.description || "N/A"}</td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        <CheckCircle2 className="w-3 h-3 text-indigo-400" /> Active Exclusion
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Stock Health Composite Score */}
      {activeTab === "health" && (
        <div className="space-y-6">
          {healthData && (
            <>
              {/* Overall Score Banner */}
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div
                    className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-extrabold shadow-lg ${
                      healthData.overall_health_score >= 80
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-emerald-500/20"
                        : healthData.overall_health_score >= 60
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-amber-500/20"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-rose-500/20"
                    }`}
                  >
                    {healthData.overall_health_score}
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Overall Portfolio Stock Health Score
                    </div>
                    <div className="text-xl font-bold text-white mt-0.5 flex items-center gap-2">
                      Status: {healthData.status}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          healthData.status === "OPTIMAL"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {healthData.evaluated_products_count} SKUs Monitored
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Composite weighting: Availability (25%), Stability (20%), Supplier (15%), Overstock (15%),
                      Stockout (15%), Anomaly Health (10%).
                    </p>
                  </div>
                </div>
              </div>

              {/* Sub-score grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-1">
                  <div className="text-[11px] text-slate-400">Availability (25)</div>
                  <div className="text-lg font-bold text-indigo-300">
                    {healthData.composite_sub_scores?.availability_score}
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-1">
                  <div className="text-[11px] text-slate-400">Stability (20)</div>
                  <div className="text-lg font-bold text-indigo-300">
                    {healthData.composite_sub_scores?.demand_stability_score}
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-1">
                  <div className="text-[11px] text-slate-400">Supplier Rel. (15)</div>
                  <div className="text-lg font-bold text-indigo-300">
                    {healthData.composite_sub_scores?.supplier_reliability_score}
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-1">
                  <div className="text-[11px] text-slate-400">Overstock Ctrl (15)</div>
                  <div className="text-lg font-bold text-indigo-300">
                    {healthData.composite_sub_scores?.overstock_control_score}
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-1">
                  <div className="text-[11px] text-slate-400">Stockout Mit. (15)</div>
                  <div className="text-lg font-bold text-indigo-300">
                    {healthData.composite_sub_scores?.stockout_mitigation_score}
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-1">
                  <div className="text-[11px] text-slate-400">Anomaly Hlt. (10)</div>
                  <div className="text-lg font-bold text-indigo-300">
                    {healthData.composite_sub_scores?.anomaly_health_score}
                  </div>
                </div>
              </div>

              {/* Per-product table */}
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">SKU & Item Name</th>
                      <th className="px-4 py-3.5 text-right">Score</th>
                      <th className="px-3 py-3.5 text-right">Availability</th>
                      <th className="px-3 py-3.5 text-right">Stability</th>
                      <th className="px-3 py-3.5 text-right">Supplier</th>
                      <th className="px-3 py-3.5 text-right">Overstock</th>
                      <th className="px-3 py-3.5 text-right">Stockout</th>
                      <th className="px-3 py-3.5 text-right">Anomaly</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {healthData.product_scores?.map((ps: any) => (
                      <tr key={ps.product_id} className="hover:bg-slate-800/40 transition">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-100">{ps.name}</div>
                          <div className="text-xs text-slate-400 font-mono">{ps.sku}</div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-white text-base">
                          <span
                            className={
                              ps.health_score >= 80
                                ? "text-emerald-400"
                                : ps.health_score >= 60
                                ? "text-amber-400"
                                : "text-rose-400"
                            }
                          >
                            {ps.health_score}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-right text-xs text-slate-300">{ps.sub_scores?.availability}</td>
                        <td className="px-3 py-3.5 text-right text-xs text-slate-300">{ps.sub_scores?.demand_stability}</td>
                        <td className="px-3 py-3.5 text-right text-xs text-slate-300">{ps.sub_scores?.supplier_reliability}</td>
                        <td className="px-3 py-3.5 text-right text-xs text-slate-300">{ps.sub_scores?.overstock_risk}</td>
                        <td className="px-3 py-3.5 text-right text-xs text-slate-300">{ps.sub_scores?.stockout_risk}</td>
                        <td className="px-3 py-3.5 text-right text-xs text-slate-300">{ps.sub_scores?.recent_anomalies}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal: Register Known Event */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" /> Register Known Event Window
              </h3>
              <button onClick={() => setShowEventModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateKnownEvent} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Event / Campaign Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diwali Mega Sale, Batch Assembly #102"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={newEventStart}
                    onChange={(e) => setNewEventStart(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={newEventEnd}
                    onChange={(e) => setNewEventEnd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Anticipated 4x demand surge during festival production run..."
                  value={newEventDesc}
                  onChange={(e) => setNewEventDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30"
                >
                  Save & Apply Exclusion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
