import React from "react";
import {
  LayoutDashboard,
  Package,
  Layers,
  ArrowLeftRight,
  ClipboardCheck,
  Building2,
  Truck,
  ShieldCheck,
  LogOut,
  Brain,
  SlidersHorizontal,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { UserRole } from "../../types";

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { user, logout, switchDemoUser, hasRole } = useAuth();

  const navItems = [
    { id: "dashboard", label: "Dashboard & KPIs", icon: LayoutDashboard, roles: ["Admin", "Inventory Manager", "Warehouse Worker", "Viewer"] },
    { id: "inventory", label: "Stock Ledger & Cache", icon: Layers, roles: ["Admin", "Inventory Manager", "Warehouse Worker", "Viewer"] },
    { id: "products", label: "Products Catalog", icon: Package, roles: ["Admin", "Inventory Manager", "Warehouse Worker", "Viewer"] },
    { id: "orders", label: "PO & Sales Orders", icon: ArrowLeftRight, roles: ["Admin", "Inventory Manager", "Warehouse Worker", "Viewer"] },
    { id: "adjustments", label: "Adjustment Queue", icon: ClipboardCheck, roles: ["Admin", "Inventory Manager", "Warehouse Worker"] },
    { id: "warehouses", label: "Warehouses & Locations", icon: Building2, roles: ["Admin", "Inventory Manager", "Viewer"] },
    { id: "suppliers", label: "Suppliers", icon: Truck, roles: ["Admin", "Inventory Manager", "Viewer"] },
  ];

  const demoRoles: UserRole[] = ["Admin", "Inventory Manager", "Warehouse Worker", "Viewer"];

  return (
    <aside className="w-64 bg-[#0D131F] border-r border-slate-800/80 flex flex-col justify-between shrink-0 select-none h-screen sticky top-0">
      <div>
        {/* Brand Logo Header */}
        <div className="p-5 flex items-center gap-3 border-b border-slate-800/60">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="font-bold text-lg text-white tracking-tight flex items-center gap-1.5">
              StockSense
              <span className="text-[10px] uppercase font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Explainable Inventory AI</p>
          </div>
        </div>

        {/* Navigation links */}
        <div className="px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Management
          </div>
          {navItems
            .filter((item) => hasRole(item.roles as UserRole[]))
            .map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  {item.label}
                </button>
              );
            })}
        </div>
      </div>

      {/* Role Switcher & User Profile */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/40 space-y-3">
        {/* Quick Role Switcher for Hackathon Demo */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold mb-2">
            <span className="flex items-center gap-1 text-indigo-400">
              <SlidersHorizontal className="w-3 h-3" /> Demo Switcher
            </span>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">RBAC</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {demoRoles.map((r) => (
              <button
                key={r}
                onClick={() => switchDemoUser(r)}
                className={`px-2 py-1 text-[11px] rounded font-medium text-left truncate transition-colors ${
                  user?.role?.name === r
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent"
                }`}
                title={`Switch to ${r}`}
              >
                {r.replace("Warehouse ", "").replace("Inventory ", "")}
              </button>
            ))}
          </div>
        </div>

        {/* User Card */}
        <div className="flex items-center justify-between px-2 pt-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-indigo-400 shrink-0">
              {user?.name?.slice(0, 2).toUpperCase() || "SS"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                {user?.role?.name || "User"}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
