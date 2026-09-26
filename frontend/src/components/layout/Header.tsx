import React, { useState, useEffect } from "react";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Database,
  Mail,
  X,
  AlertCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
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

  // Notification States
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);

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

  const fetchNotifications = async () => {
    try {
      const notifs = await api.getNotifications().catch(() => []);
      setNotifications(notifs);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  const fetchEmailLogs = async () => {
    try {
      const logs = await api.getSimulatedEmailLogs().catch(() => []);
      setEmailLogs(logs);
    } catch (err) {
      console.error("Failed to fetch simulated email logs:", err);
    }
  };

  useEffect(() => {
    checkInvariant();
    fetchNotifications();
  }, []);

  const handleMarkRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark read:", err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

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
      <div className="flex items-center gap-3 relative">
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
          onClick={() => {
            onRefreshData();
            fetchNotifications();
            checkInvariant();
          }}
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          title="Refresh Workspace"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Simulated Email Log Modal Trigger */}
        <button
          onClick={() => {
            fetchEmailLogs();
            setShowEmailModal(true);
          }}
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors"
          title="Manager Simulated Email Dispatch Audit"
        >
          <Mail className="w-4 h-4" />
        </button>

        {/* Notifications Bell Icon & Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              fetchNotifications();
              setShowNotifications(!showNotifications);
            }}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors relative"
            title="Notification Center"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-[#0D131F] animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Slide-out Notification Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-fadeIn">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-400" />
                  <span className="font-bold text-sm text-white">Alerts & Notifications</span>
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/80">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    No active system alerts.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3.5 space-y-1.5 transition-colors ${
                        !n.is_read ? "bg-indigo-950/20" : "hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            n.severity === "CRITICAL"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              : n.severity === "WARNING"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                          }`}
                        >
                          {n.notification_type?.replace("_", " ")}
                        </span>
                        {!n.is_read && (
                          <button
                            onClick={() => handleMarkRead(n.id)}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                          >
                            Mark Read
                          </button>
                        )}
                      </div>
                      <h4 className="text-xs font-semibold text-slate-100">{n.title}</h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{n.message}</p>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 pt-1">
                        <Clock className="w-3 h-3" />
                        {new Date(n.created_at).toLocaleTimeString()} • {new Date(n.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Simulated Email Logs Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-scaleUp max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Mail className="w-5 h-5 text-indigo-400" /> Manager Outbound Email Dispatches (Simulated Audit)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verifies simulated SMTP alerts dispatched to warehouse managers and admins.
                </p>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {emailLogs.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  No simulated emails dispatched yet.
                </div>
              ) : (
                emailLogs.map((log) => (
                  <div key={log.id} className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-indigo-300">To: {log.recipient_name} ({log.recipient_email})</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(log.sent_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-100">{log.subject}</div>
                    <pre className="text-[11px] text-slate-300 font-sans whitespace-pre-wrap bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                      {log.body_text}
                    </pre>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
