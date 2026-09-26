import React from "react";
import { Building2, MapPin, Layers } from "lucide-react";
import { Warehouse, Location } from "../types";

interface WarehousesViewProps {
  warehouses: Warehouse[];
  locations: Location[];
}

export const WarehousesView: React.FC<WarehousesViewProps> = ({
  warehouses,
  locations,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Building2 className="w-6 h-6 text-indigo-400" />
          Warehouses & Storage Locations
        </h1>
        <p className="text-sm text-slate-400">
          Multi-warehouse topology, zones, racks, and bin hierarchy.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {warehouses.map((wh) => {
          const whLocations = locations.filter((loc) => loc.warehouse_id === wh.id);

          return (
            <div
              key={wh.id}
              className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded">
                    {wh.code}
                  </span>
                  <h2 className="text-lg font-bold text-white mt-1.5">{wh.name}</h2>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    {wh.address || "Primary Hub"}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  Assigned Storage Locations ({whLocations.length})
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {whLocations.map((loc) => (
                    <div
                      key={loc.id}
                      className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 text-center"
                    >
                      <p className="font-mono text-xs font-bold text-slate-200">{loc.name}</p>
                      <p className="text-[10px] text-slate-500">Active Location</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
