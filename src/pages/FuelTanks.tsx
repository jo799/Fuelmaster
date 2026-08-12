import { useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { Database, Layers, Droplet, DollarSign, Truck as TruckIcon, AlertTriangle, Plus } from "lucide-react";
import { INITIAL_TANKS } from "../data/mock";
import { MetricCard, PageHeader, PanelHeader, StatusPill, type Tone } from "../components/ui/primitives";
import TankCylinder from "../components/ui/TankCylinder";
import { kes } from "../lib/format";
import type { Tank, TankStatus, FuelPriceRow } from "../types";
import { useApiData } from "../lib/useApiData";
import { usePumpTelemetry } from "../lib/usePumpTelemetry";
import NoEquipmentState from "../components/ui/NoEquipmentState";
import AddTankModal from "../components/AddTankModal";
import StrappingTableModal from "../components/StrappingTableModal";
import { mergeLive } from "../lib/mergeLive";
import { findFuelPrice } from "../lib/fuelPrice";

const STATUS_TONE: Record<TankStatus, Tone> = {
  healthy: "success",
  warning: "warning",
  critical: "danger",
  offline: "danger",
};
const STATUS_LABEL: Record<TankStatus, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
  offline: "Offline",
};

const volumeTrend = [
  { t: "12 AM", v: 20500 }, { t: "4 AM", v: 20100 }, { t: "8 AM", v: 19200 },
  { t: "12 PM", v: 18900 }, { t: "4 PM", v: 18700 }, { t: "8 PM", v: 18600 }, { t: "12 AM ", v: 18560 },
];

const distributionColors: Record<string, string> = {
  Petrol: "#f9a826",
  Diesel: "#17c964",
  Kerosene: "#a78bfa",
  LPG: "#38bdf8",
};

export default function FuelTanks() {
  const { data: apiTanks, refetch } = useApiData<Tank[]>("/tanks", INITIAL_TANKS);
  const { tanks: liveTanks } = usePumpTelemetry(true);
  const tanks = mergeLive(apiTanks ?? INITIAL_TANKS, liveTanks);
  const { data: priceData } = useApiData<FuelPriceRow[]>("/price-management", []);
  const prices = priceData ?? [];
  const { data: deliveryData } = useApiData<{ costKes: number }[]>("/deliveries", []);
  const deliveries = deliveryData ?? [];
  const [selectedId, setSelectedId] = useState("TANK-1");
  const [showStrapping, setShowStrapping] = useState(false);
  const [showAddTank, setShowAddTank] = useState(false);

  const addTankModal = showAddTank && (
    <AddTankModal
      onClose={() => setShowAddTank(false)}
      onCreated={() => {
        setShowAddTank(false);
        refetch();
      }}
    />
  );

  if (tanks.length === 0) {
    return (
      <>
        <NoEquipmentState
          icon={Database}
          title="Fuel Tanks"
          message="This station doesn't have any tanks registered yet. Add one below, or switch to a station with configured hardware."
          actionLabel="Add Tank"
          onAction={() => setShowAddTank(true)}
        />
        {addTankModal}
      </>
    );
  }

  const selected = tanks.find((t) => t.id === selectedId) ?? tanks[0];

  const totalCapacity = tanks.reduce((s, t) => s + t.capacity, 0);
  const totalVolume = tanks.reduce((s, t) => s + t.volume, 0);
  const totalValue = tanks.reduce((s, t) => s + t.volume * (findFuelPrice(prices, t.product) ?? 0), 0);
  const totalDeliveryValue = deliveries.reduce((s, d) => s + d.costKes, 0);
  const waterDetected = tanks.filter((t) => t.waterLevel >= 1).length;

  const distribution = Object.entries(
    tanks.reduce<Record<string, number>>((acc, t) => {
      acc[t.product] = (acc[t.product] ?? 0) + t.volume;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value, color: distributionColors[name] }));

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-full">
      <div className="flex-1 min-w-0">
        <PageHeader
          title="Fuel Tanks"
          status={{ tone: "success", label: "All Tanks" }}
          actions={
            <button
              onClick={() => setShowAddTank(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--color-accent)] text-[#081018] text-[12px] font-medium"
            >
              <Plus size={13} /> Add Tank
            </button>
          }
        />

        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-4">
          <MetricCard icon={Database} tone="accent" label="Total Tanks" value={String(tanks.length)} sub="All Stations" />
          <MetricCard icon={Layers} tone="info" label="Total Capacity" value={`${(totalCapacity / 1000).toFixed(1)}K L`} />
          <MetricCard icon={Droplet} tone="success" label="Total Volume" value={`${(totalVolume / 1000).toFixed(1)}K L`} sub={`${Math.round((totalVolume / totalCapacity) * 100)}%`} />
          <MetricCard icon={DollarSign} tone="success" label="Total Value" value={kes(totalValue)} />
          <MetricCard icon={TruckIcon} tone="warning" label="Recorded Deliveries" value={kes(totalDeliveryValue)} sub={`${deliveries.length} deliveries`} />
          <MetricCard icon={AlertTriangle} tone={waterDetected ? "danger" : "success"} label="Water Detected" value={`${waterDetected} Tank`} />
        </div>

        <div className="card">
          <PanelHeader title="Fuel Tanks Overview" />
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10.5px] text-[var(--color-text-faint)] uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Tank</th>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 font-medium text-right">Capacity</th>
                  <th className="px-4 py-2.5 font-medium text-right">Volume</th>
                  <th className="px-4 py-2.5 font-medium text-right">% Full</th>
                  <th className="px-4 py-2.5 font-medium text-right">Temp</th>
                  <th className="px-4 py-2.5 font-medium text-right">Water</th>
                  <th className="px-4 py-2.5 font-medium">ATG</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Refill</th>
                </tr>
              </thead>
              <tbody>
                {tanks.map((t) => {
                  const pct = Math.round((t.volume / t.capacity) * 100);
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={`border-t border-[var(--color-border)] hover:bg-white/[0.02] cursor-pointer ${
                        t.id === selectedId ? "bg-white/[0.03]" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5 font-medium">{t.id}</td>
                      <td className="px-4 py-2.5 text-[var(--color-text-dim)]">{t.product}</td>
                      <td className="px-4 py-2.5 text-right font-mono-num">{t.capacity.toLocaleString()} L</td>
                      <td className="px-4 py-2.5 text-right font-mono-num">{t.volume.toLocaleString()} L</td>
                      <td className="px-4 py-2.5 text-right font-mono-num">{pct}%</td>
                      <td className="px-4 py-2.5 text-right font-mono-num">{t.temperature} \u00b0C</td>
                      <td className={`px-4 py-2.5 text-right font-mono-num ${t.waterLevel >= 1 ? "text-[var(--color-danger)]" : ""}`}>
                        {t.waterLevel} cm
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill tone={t.atgOnline ? "success" : "danger"} label={t.atgOnline ? "Online" : "Offline"} />
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill tone={STATUS_TONE[t.status]} label={STATUS_LABEL[t.status]} />
                      </td>
                      <td className="px-4 py-2.5 text-[var(--color-accent)]">{t.refillDays} Days</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[300px] lg:shrink-0 space-y-4 lg:overflow-y-auto lg:pr-1">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold">Tank Details ({selected.id})</h3>
            <StatusPill tone={STATUS_TONE[selected.status]} label={STATUS_LABEL[selected.status]} />
          </div>
          <div className="flex items-center justify-center mb-3">
            <TankCylinder product={selected.product} percent={(selected.volume / selected.capacity) * 100} size={90} />
          </div>

          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <div className="rounded-lg bg-white/3 border border-border p-2.5 text-center">
              <div className="text-[10px] text-text-faint uppercase tracking-wide mb-0.5">Volume</div>
              <div className="text-[16px] font-semibold font-mono-num">{selected.volume.toLocaleString()} L</div>
            </div>
            <div
              className={`rounded-lg border p-2.5 text-center ${
                selected.waterLevel >= 1 ? "bg-danger-soft border-danger/30" : "bg-white/3 border-border"
              }`}
            >
              <div className="text-[10px] text-text-faint uppercase tracking-wide mb-0.5">Water</div>
              <div className={`text-[16px] font-semibold font-mono-num ${selected.waterLevel >= 1 ? "text-danger" : ""}`}>
                {selected.waterLevel} cm
              </div>
            </div>
          </div>

          <div className="space-y-2 text-[12px]">
            {[
              ["Product", selected.product],
              ["Capacity", `${selected.capacity.toLocaleString()} L`],
              ["Percentage Full", `${Math.round((selected.volume / selected.capacity) * 100)}%`],
              ["Product Height", selected.heightMm != null ? `${selected.heightMm.toLocaleString()} mm` : "\u2014"],
              ["Temperature", `${selected.temperature} \u00b0C`],
              ["Density", `${selected.density} g/L`],
            ].map(([l, v]) => (
              <div key={l} className="flex items-center justify-between">
                <span className="text-[var(--color-text-faint)]">{l}</span>
                <span className="font-mono-num">{v}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[var(--color-text-faint)]">Calibration</span>
              <span className={selected.hasStrappingTable ? "text-success" : "text-text-faint"}>
                {selected.hasStrappingTable ? "Strapping table on file" : "Estimated geometry"}
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowStrapping(true)}
            className="w-full mt-3 py-2 rounded-lg border border-border text-[12px] text-text-dim hover:border-border-strong transition-colors"
          >
            Manage Strapping Table
          </button>
        </div>

        <div className="card">
          <PanelHeader title="Volume Trend (24h)" />
          <div className="p-3 h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeTrend} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#17c964" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#17c964" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 9, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }} />
                <Area type="monotone" dataKey="v" stroke="#17c964" strokeWidth={2} fill="url(#volFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <PanelHeader title="Fuel Distribution" />
          <div className="p-4 flex items-center gap-4">
            <div className="w-[100px] h-[100px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribution} dataKey="value" innerRadius={30} outerRadius={48} paddingAngle={2} stroke="none">
                    {distribution.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              {distribution.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-[11.5px]">
                  <span className="flex items-center gap-1.5 text-[var(--color-text-dim)]">
                    <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    {d.name}
                  </span>
                  <span className="font-mono-num">{Math.round((d.value / totalVolume) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {addTankModal}

      {showStrapping && (
        <StrappingTableModal
          tankId={selected.id}
          onClose={() => setShowStrapping(false)}
          onSaved={() => {
            setShowStrapping(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}