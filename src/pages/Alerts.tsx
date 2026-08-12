import { useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Eye, Search, Check } from "lucide-react";
import { INITIAL_ALERTS } from "../data/mock";
import { MetricCard, PageHeader, StatusPill, type Tone } from "../components/ui/primitives";
import type { AlertRow, AlertSeverity, AlertStatus } from "../types";
import { useApiData } from "../lib/useApiData";
import { api } from "../lib/api";

const SEVERITY_TONE: Record<AlertSeverity, Tone> = {
  info: "info",
  warning: "warning",
  danger: "danger",
};

const STATUS_TONE: Record<AlertStatus, Tone> = {
  Active: "danger",
  Acknowledged: "warning",
  Resolved: "success",
};

const STATUS_FILTERS: (AlertStatus | "All")[] = ["All", "Active", "Acknowledged", "Resolved"];

export default function Alerts() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AlertStatus | "All">("All");
  const { data, refetch } = useApiData<AlertRow[]>("/alerts", INITIAL_ALERTS);
  const alerts = data ?? INITIAL_ALERTS;
  const [updating, setUpdating] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      alerts.filter(
        (a) =>
          (status === "All" || a.status === status) &&
          (a.message.toLowerCase().includes(query.toLowerCase()) || a.module.toLowerCase().includes(query.toLowerCase()))
      ),
    [alerts, query, status]
  );

  const activeCount = alerts.filter((a) => a.status === "Active").length;
  const ackCount = alerts.filter((a) => a.status === "Acknowledged").length;
  const resolvedCount = alerts.filter((a) => a.status === "Resolved").length;
  const criticalCount = alerts.filter((a) => a.severity === "danger" && a.status !== "Resolved").length;

  async function advanceStatus(alert: AlertRow) {
    const next: AlertStatus = alert.status === "Active" ? "Acknowledged" : "Resolved";
    setUpdating(alert.id);
    try {
      await api.patch(`/alerts/${alert.id}`, { status: next });
      refetch();
    } catch {
      /* leave alert as-is on failure; user can retry */
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Alerts"
        subtitle="Every warning and critical event across the platform, in one place"
        status={{ tone: criticalCount > 0 ? "danger" : "success", label: criticalCount > 0 ? `${criticalCount} Critical` : "All Clear" }}
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-4">
        <MetricCard icon={Bell} tone="accent" label="Total Alerts" value={String(alerts.length)} sub="Last 24 hours" />
        <MetricCard icon={AlertTriangle} tone="danger" label="Active" value={String(activeCount)} />
        <MetricCard icon={Eye} tone="warning" label="Acknowledged" value={String(ackCount)} />
        <MetricCard icon={CheckCircle2} tone="success" label="Resolved" value={String(resolvedCount)} />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                status === s ? "bg-accent-soft text-accent" : "text-text-dim hover:bg-white/4"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 bg-white/3 border border-border rounded-lg px-2.5 py-1.5">
          <Search size={13} className="text-text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search alerts..."
            className="bg-transparent text-[12px] w-[200px] focus:outline-none"
          />
        </div>
      </div>

      <div className="card divide-y divide-border">
        {rows.map((a) => (
          <div key={a.id} className="p-4 flex items-start gap-3">
            <span
              className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                a.severity === "danger" ? "bg-danger" : a.severity === "warning" ? "bg-warning" : "bg-info"
              }`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[13px] font-medium">{a.message}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusPill tone={SEVERITY_TONE[a.severity]} label={a.severity === "danger" ? "Critical" : a.severity[0].toUpperCase() + a.severity.slice(1)} />
                  <StatusPill tone={STATUS_TONE[a.status]} label={a.status} />
                  {a.status !== "Resolved" && (
                    <button
                      onClick={() => advanceStatus(a)}
                      disabled={updating === a.id}
                      className="flex items-center gap-1 px-2 py-1 rounded-md border border-border text-[10.5px] text-text-dim hover:border-border-strong disabled:opacity-50"
                    >
                      <Check size={11} />
                      {a.status === "Active" ? "Acknowledge" : "Resolve"}
                    </button>
                  )}
                </div>
              </div>
              <div className="text-[11px] text-text-faint mt-1">
                {a.module} <span className="mx-1">&middot;</span> {a.id} <span className="mx-1">&middot;</span> {a.time}
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="p-10 text-center text-text-faint text-[13px]">No alerts match your filters.</div>
        )}
      </div>
    </div>
  );
}
