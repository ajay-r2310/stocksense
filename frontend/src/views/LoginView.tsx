import React, { useState } from "react";
import { Brain, ShieldCheck, ArrowRight, Lock, Mail, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { UserRole } from "../types";

export const LoginView: React.FC = () => {
  const { login, switchDemoUser, isLoading } = useAuth();
  const [email, setEmail] = useState("admin@stocksense.io");
  const [password, setPassword] = useState("adminpassword123");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Check email and password.");
    }
  };

  const demoAccounts: Array<{ role: UserRole; title: string; desc: string; email: string; pass: string }> = [
    {
      role: "Admin",
      title: "System Admin",
      desc: "Full config, users, and warehouse settings",
      email: "admin@stocksense.io",
      pass: "adminpassword123",
    },
    {
      role: "Inventory Manager",
      title: "Inventory Manager",
      desc: "Adjustment approvals, orders, and intelligence",
      email: "manager@stocksense.io",
      pass: "managerpassword123",
    },
    {
      role: "Warehouse Worker",
      title: "Warehouse Worker",
      desc: "Cycle counting, receiving, and picking",
      email: "worker@stocksense.io",
      pass: "workerpassword123",
    },
    {
      role: "Viewer",
      title: "Stakeholder / Judge",
      desc: "Read-only analytics and audit dashboards",
      email: "viewer@stocksense.io",
      pass: "viewerpassword123",
    },
  ];

  return (
    <div className="min-h-screen bg-[#070A10] text-slate-100 flex items-center justify-center p-4 selection:bg-indigo-500">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Left: Branding & Pitch */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-xl shadow-indigo-500/20">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">StockSense</h1>
              <p className="text-xs text-indigo-400 font-medium">Predictive & Explainable Inventory Platform</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" /> Core Thesis
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                StockSense doesn't just record what happened — it analyzes 75+ days of transaction trends to predict
                stockouts, calculates exact reorder quantities, and explains every number in auditable language.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-400">
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                <p className="font-semibold text-slate-200">100% Invariant Compliant</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Append-only signed ledger</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                <p className="font-semibold text-slate-200">API-Enforced RBAC</p>
                <p className="text-[10px] text-slate-500 mt-0.5">4 role permission security</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Login Card & Demo Switcher */}
        <div className="glass-panel p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Sign In to Workspace</h2>
            <p className="text-xs text-slate-400 mt-1">Select a demo role or enter custom credentials</p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Quick Demo Role Picker */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              1-Click Demo Logins
            </label>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => switchDemoUser(acc.role)}
                  className="p-2.5 text-left rounded-xl bg-slate-900/90 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/40 transition-all group"
                >
                  <p className="text-xs font-bold text-slate-200 group-hover:text-indigo-300 flex items-center justify-between">
                    {acc.title}
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{acc.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-[#121927] px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider absolute">
              Or Manual Sign In
            </span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-400 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? "Signing In..." : "Sign In to Dashboard"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
