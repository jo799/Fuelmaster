import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  GaugeCircle,
  Database,
  Droplet,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  MoreVertical,
  Gauge as GaugeIcon,
  Cpu,
  Activity,
} from "lucide-react";
import { INITIAL_TANKS } from "../data/mock";
import { MetricCard, PageHeader, PanelHeader, StatusPill, type Tone } from "../components/ui/primitives";
import TankCylinder from "../components/ui/TankCylinder";
import { kes, litres } from "../lib/format";
import NoEquipmentState from "../components/ui/NoEquipmentState";
import AddTankModal from "../components/AddTankModal";
import StrappingTableModal from "../components/StrappingTableModal";
import type { Tank, TankStatus, AlertRow } from "../types";
import { useApiData } from "../lib/useApiData";
import { usePumpTelemetry } from "../lib/usePumpTelemetry";
import { mergeLive } from "../lib/mergeLive";

const STATUS_TONE: Record<TankStatus, Tone> = {
  healthy: "success",
  warning: "warning",
  critical: "danger",
  offline: "neutral",
};
const STATUS_LABEL: Record<TankStatus, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
  offline: "Offline",
};
const PRODUCT_COLOR: Record<string, string> = {
  Petrol: "#f9a826",
  Diesel: "#17c964",
  Kerosene: "#a78bfa",
  LPG: "#38bdf8",
};
const LINE_COLORS = ["#f9a826", "#17c964", "#a78bfa", "#38bdf8", "#f31260", "#facc15", "#22d3ee", "#fb7185"];

interface TankSummary {
  totalTanks: number;
  totalCapacity: number;
  totalVolume: number;
  totalValue: number;
  waterDetectedCount: number;
  atgOnlineCount: number;
  activeTanks: number;
  controllersOnline: number;
  controllersTotal: number;
  lastSync: string | null;
  dataLatencySeconds: number | null;
}
interface TankHistoryResponse {
  series: Record<string, string | number>[];
  tanks: string[];
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div className="h-6 w-16 flex items-center text-[9px] text-text-faint">No trend yet</div>;
  const w = 64;
  const h = 24;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function latencyLabel(seconds: number | null): string {
  if (seconds === null) return "\u2014";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

export default function TankGauges({ onNavigate }: { onNavigate: (route: string) => void }) {
  const { data: apiTanks, refetch } = useApiData<Tank[]>("/tank-gauges", INITIAL_TANKS);
  const { tanks: liveTanks } = usePumpTelemetry(true);
  const tanks = mergeLive(apiTanks ?? INITIAL_TANKS, liveTanks);

  const { data: summary, refetch: refetchSummary } = useApiData<TankSummary>("/tanks/summary");
  const [range, setRange] = useState<"7D" | "1M" | "3M">("7D");
  const { data: history } = useApiData<TankHistoryResponse>(`/tanks/history?range=${range}`, undefined, [range]);
  const { data: alertsData, refetch: refetchAlerts } = useApiData<AlertRow[]>("/alerts", []);
  const tankAlerts = (alertsData ?? []).filter((a) => a.module === "Fuel Tanks" && a.status === "Active").slice(0, 6);

  const [productFilter, setProductFilter] = useState("All");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showAddTank, setShowAddTank] = useState(false);
  const [strappingTankId, setStrappingTankId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => {
      refetchSummary();
      refetchAlerts();
    }, 30_000);
    return () => clearInterval(t);
  }, [autoRefresh, refetchSummary, refetchAlerts]);

  const addTankModal = showAddTank && (
    <AddTankModal
      onClose={() => setShowAddTank(false)}
      onCreated={() => {
        setShowAddTank(false);
        refetch();
        refetchSummary();
      }}
    />
  );

  if (tanks.length === 0) {
    return (
      <>
        <NoEquipmentState
          icon={GaugeCircle}
          title="Tank Gauges"
          message="This station doesn't have any tank gauges registered yet. Add one below, or switch to a station with configured hardware."
          actionLabel="Add Tank"
          onAction={() => setShowAddTank(true)}
        />
        {addTankModal}
      </>
    );
  }

  const products = Array.from(new Set(tanks.map((t) => t.product)));
  const filteredTanks = productFilter === "All" ? tanks : tanks.filter((t) => t.product === productFilter);

  const pctOfCapacity = summary?.totalCapacity ? Math.round((summary.totalVolume / summary.totalCapacity) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Tank Gauges"
        subtitle="Real-time tank levels and sensor data"
        status={{ tone: "success", label: "Live Monitoring" }}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="bg-white/3 border border-border rounded-lg px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-accent"
            >
              <option value="All">All Products</option>
              {products.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] transition-colors ${
                autoRefresh ? "border-success/30 text-success bg-success-soft" : "border-border text-text-dim"
              }`}
            >
              <RefreshCw size={12} className={autoRefresh ? "animate-spin-slow" : ""} />
              Auto Refresh {autoRefresh ? "30s" : "Off"}
            </button>
            <button
              onClick={() => setShowAddTank(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--color-accent)] text-[#081018] text-[12px] font-medium"
            >
              <Plus size={13} /> Add Tank
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-4">
        <MetricCard icon={Database} tone="accent" label="Total Tanks" value={String(summary?.totalTanks ?? tanks.length)} sub={summary?.atgOnlineCount === summary?.totalTanks ? "All Online" : undefined} />
        <MetricCard icon={GaugeIcon} tone="info" label="Total Capacity" value={litres(summary?.totalCapacity ?? 0, 0)} />
        <MetricCard icon={Droplet} tone="success" label="Total Volume" value={litres(summary?.totalVolume ?? 0, 0)} sub={`${pctOfCapacity}% of Capacity`} />
        <MetricCard icon={DollarSign} tone="success" label="Total Value" value={kes(summary?.totalValue ?? 0)} />
        <MetricCard
          icon={AlertTriangle}
          tone={(summary?.waterDetectedCount ?? 0) > 0 ? "danger" : "success"}
          label="Water Detected"
          value={`${summary?.waterDetectedCount ?? 0} Tank${summary?.waterDetectedCount === 1 ? "" : "s"}`}
          sub={(summary?.waterDetectedCount ?? 0) > 0 ? "Needs Attention" : "None"}
        />
        <MetricCard
          icon={CheckCircle2}
          tone={summary?.atgOnlineCount === summary?.totalTanks ? "success" : "warning"}
          label="ATG Status"
          value={summary?.atgOnlineCount === summary?.totalTanks ? "All Healthy" : `${summary?.atgOnlineCount ?? 0}/${summary?.totalTanks ?? 0} Online`}
        />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3 mb-4">
        {filteredTanks.map((t) => {
          const color = PRODUCT_COLOR[t.product] ?? "#8b98a5";
          const pct = Math.round((t.volume / t.capacity) * 100);
          const trendData = (history?.series ?? [])
            .map((row) => row[t.id])
            .filter((v): v is number => typeof v === "number");

          return (
            <div key={t.id} className="card p-4 relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-[13px] truncate">{t.id}</span>
                  <StatusPill tone={STATUS_TONE[t.status]} label={STATUS_LABEL[t.status]} />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-medium" style={{ color }}>
                    {t.product}
                  </span>
                  <button
                    onClick={() => setOpenMenuId(openMenuId === t.id ? null : t.id)}
                    className="w-6 h-6 rounded-md grid place-items-center text-text-faint hover:bg-white/5 transition-colors"
                  >
                    <MoreVertical size={14} />
                  </button>
                  {openMenuId === t.id && (
                    <div className="absolute right-3 top-11 z-20 w-[180px] rounded-lg border border-border bg-panel shadow-xl overflow-hidden">
                      <button
                        onClick={() => {
                          setStrappingTankId(t.id);
                          setOpenMenuId(null);
                        }}
                        className="w-full text-left px-3 py-2 text-[12px] hover:bg-white/5"
                      >
                        Manage Strapping Table
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <TankCylinder product={t.product} percent={pct} size={80} showLabels />
                <div>
                  <div className="text-[30px] font-bold font-mono-num leading-none" style={{ color }}>
                    {pct}%
                  </div>
                  <div className="text-[12px] font-mono-num text-text-dim mt-1.5">{t.capacity.toLocaleString()} L</div>
                  <div className="text-[10px] text-text-faint uppercase tracking-wide">Capacity</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-x-2 gap-y-1.5 text-[10.5px] mt-3 pt-3 border-t border-border">
                <div>
                  <div className="text-text-faint">Current Volume</div>
                  <div className="font-mono-num">{t.volume.toLocaleString()} L</div>
                </div>
                <div>
                  <div className="text-text-faint">Temperature</div>
                  <div className="font-mono-num">{t.temperature.toFixed(1)} \u00b0C</div>
                </div>
                <div>
                  <div className="text-text-faint">Density</div>
                  <div className="font-mono-num">{t.density.toFixed(3)} g/L</div>
                </div>
                <div className={t.waterLevel >= 1 ? "rounded-md bg-danger-soft px-1 py-0.5 -my-0.5 -ml-1" : ""}>
                  <div className="text-text-faint">Water Level</div>
                  <div className={`font-mono-num ${t.waterLevel >= 1 ? "text-danger font-semibold" : ""}`}>{t.waterLevel} cm</div>
                </div>
                <div>
                  <div className="text-text-faint">ATG Status</div>
                  <div className={`font-medium ${t.atgOnline ? "text-success" : "text-danger"}`}>{t.atgOnline ? "Online" : "Offline"}</div>
                </div>
                <div>
                  <div className="text-text-faint mb-0.5">Trend ({range})</div>
                  <Sparkline data={trendData} color={color} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border text-[10.5px]">
                <div>
                  <div className="text-text-faint">Refill Estimate</div>
                  <div className="font-mono-num text-accent">{t.refillDays} Days</div>
                </div>
                <div>
                  <div className="text-text-faint">Empty Estimate</div>
                  <div className="font-mono-num text-warning">{t.emptyDays} Days</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-[13px] font-semibold">Tank Levels Over Time</h3>
            <div className="flex items-center gap-1">
              {(["7D", "1M", "3M"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    range === r ? "bg-accent text-bg" : "text-text-dim hover:bg-white/5"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="p-3 h-[260px]">
            {(history?.series.length ?? 0) === 0 ? (
              <div className="h-full flex items-center justify-center text-[12px] text-text-faint">
                Not enough history yet \u2014 readings are snapshotted every 15 minutes as real telemetry arrives.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history?.series ?? []} margin={{ left: -10, right: 8, top: 8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="d" tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }} />
                  {(history?.tanks ?? []).map((code, i) => (
                    <Line
                      key={code}
                      type="monotone"
                      dataKey={code}
                      name={code}
                      stroke={LINE_COLORS[i % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <PanelHeader title="Tank Alerts" action="View All" onAction={() => onNavigate("alerts")} />
          <div className="p-3 space-y-2.5 max-h-[300px] overflow-y-auto">
            {tankAlerts.length === 0 && (
              <div className="flex flex-col items-center gap-1.5 py-6 text-text-faint">
                <CheckCircle2 size={18} />
                <span className="text-[12px]">No active tank alerts.</span>
              </div>
            )}
            {tankAlerts.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 text-[12px]">
                <span
                  className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                    a.severity === "danger" ? "bg-danger" : a.severity === "warning" ? "bg-warning" : "bg-info"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="leading-snug">{a.message}</div>
                  <div className="text-[10px] text-text-faint mt-0.5">{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <PanelHeader title="Tank Summary" />
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[11px] text-text-faint uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Tank</th>
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 font-medium text-right">Capacity (L)</th>
                <th className="px-4 py-2.5 font-medium text-right">Volume (L)</th>
                <th className="px-4 py-2.5 font-medium text-right">%</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tanks.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-white/2">
                  <td className="px-4 py-2.5 font-medium">{t.id}</td>
                  <td className="px-4 py-2.5 text-text-dim">{t.product}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num">{t.capacity.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num">{t.volume.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num">{Math.round((t.volume / t.capacity) * 100)}%</td>
                  <td className="px-4 py-2.5">
                    <StatusPill tone={STATUS_TONE[t.status]} label={STATUS_LABEL[t.status]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card px-4 py-3 flex items-center justify-between flex-wrap gap-3 text-[11.5px]">
        <span className="flex items-center gap-1.5 text-success font-medium">
          <CheckCircle2 size={13} /> System Status: All Systems Operational
        </span>
        <div className="flex items-center gap-5 text-text-dim flex-wrap">
          <span>
            Last Sync <span className="font-mono-num text-text">{summary?.lastSync ? new Date(summary.lastSync).toLocaleTimeString() : "\u2014"}</span>
          </span>
          <span className="flex items-center gap-1">
            <Database size={12} /> Active Tanks <span className="font-mono-num text-text">{summary?.activeTanks ?? 0}/{summary?.totalTanks ?? 0}</span>
          </span>
          <span className="flex items-center gap-1">
            <Cpu size={12} /> Online Controllers <span className="font-mono-num text-text">{summary?.controllersOnline ?? 0}/{summary?.controllersTotal ?? 0}</span>
          </span>
          <span className="flex items-center gap-1">
            <Activity size={12} /> Data Latency <span className="font-mono-num text-text">{latencyLabel(summary?.dataLatencySeconds ?? null)}</span>
          </span>
          <button onClick={() => onNavigate("system-health")} className="text-accent hover:underline">
            View System Health
          </button>
        </div>
      </div>

      {addTankModal}

      {strappingTankId && (
        <StrappingTableModal
          tankId={strappingTankId}
          onClose={() => setStrappingTankId(null)}
          onSaved={() => {
            setStrappingTankId(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}