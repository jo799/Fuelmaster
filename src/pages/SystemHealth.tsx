import {
  Cpu,
  MemoryStick,
  HardDrive,
  Database,
  Server,
  Radio,
  Gauge,
  Activity,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { PageHeader, PanelHeader, StatusPill, type Tone } from "../components/ui/primitives";
import { useApiData } from "../lib/useApiData";

// Matches exactly the services /api/system-health actually returns \u2014 keep
// this in sync with server/src/routes/systemHealth.routes.ts rather than
// listing icons for infrastructure (Redis, RabbitMQ, etc.) we don't have.
const ICON_BY_SERVICE: Record<string, typeof Database> = {
  PostgreSQL: Database,
  "REST API": Gauge,
  Controllers: Activity,
  "Tank Gauges (ATG)": Radio,
};

interface HealthResponse {
  uptimeSeconds: number;
  resources: { cpu: number; ram: number; disk: number };
  dbConnections: { total: number; idle: number; waiting: number };
  overallHealthy: boolean;
  services: { name: string; status: "Healthy" | "Degraded" | "Down"; detail: string }[];
}

const STATUS_TONE: Record<"Healthy" | "Degraded" | "Down", Tone> = {
  Healthy: "success",
  Degraded: "warning",
  Down: "danger",
};

function ResourceGauge({ icon: Icon, label, pct, sub }: { icon: typeof Cpu; label: string; pct: number; sub: string }) {
  const tone = pct >= 85 ? "danger" : pct >= 65 ? "warning" : "success";
  const toneColor = tone === "danger" ? "bg-danger" : tone === "warning" ? "bg-warning" : "bg-success";
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-2 text-[12.5px] font-medium">
          <Icon size={15} className="text-text-dim" />
          {label}
        </span>
        <span className="font-mono-num text-[15px] font-semibold">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full rounded-full ${toneColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[10.5px] text-text-faint mt-2">{sub}</div>
    </div>
  );
}

export default function SystemHealth() {
  const { data } = useApiData<HealthResponse>("/system-health");

  const cpu = data?.resources.cpu ?? 0;
  const ram = data?.resources.ram ?? 0;
  const disk = data?.resources.disk ?? 0;
  const resources = [
    { icon: Cpu, label: "CPU", pct: cpu, sub: "Load average" },
    { icon: MemoryStick, label: "RAM", pct: ram, sub: "System memory" },
    { icon: HardDrive, label: "Disk", pct: disk, sub: "Filesystem usage" },
  ];

  const services = data?.services ?? [];
  const downServices = services.filter((s) => s.status === "Down").length;
  const degradedServices = services.filter((s) => s.status === "Degraded").length;
  const pageStatus =
    downServices > 0
      ? ({ tone: "danger", label: `${downServices} Service${downServices > 1 ? "s" : ""} Down` } as const)
      : degradedServices > 0
      ? ({ tone: "warning", label: `${degradedServices} Degraded` } as const)
      : ({ tone: "success", label: "All Systems Operational" } as const);

  const uptimeSeconds = data?.uptimeSeconds ?? 0;
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const uptimeLabel = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return (
    <div>
      <PageHeader
        title="System Health"
        subtitle="Live infrastructure and hardware connectivity status"
        status={pageStatus}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {resources.map((r) => (
          <ResourceGauge key={r.label} {...r} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="xl:col-span-2 card">
          <PanelHeader title="Services" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border">
            {services.map((s) => {
              const Icon = ICON_BY_SERVICE[s.name] ?? Server;
              return (
                <div key={s.name} className="p-4 flex items-center gap-3 bg-panel">
                  <span className="w-9 h-9 rounded-lg bg-white/5 grid place-items-center text-text-dim shrink-0">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-medium truncate">{s.name}</span>
                      <StatusPill tone={STATUS_TONE[s.status]} label={s.status} />
                    </div>
                    <div className="text-[10.5px] text-text-faint mt-0.5">{s.detail}</div>
                  </div>
                </div>
              );
            })}
            {services.length === 0 && (
              <div className="p-6 text-center text-[12px] text-text-faint col-span-2">Loading service status...</div>
            )}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-[13px] font-semibold mb-3">System Overview</h3>
          <div className="space-y-2.5 text-[12.5px]">
            {[
              { icon: Clock, l: "Backend Uptime", v: uptimeLabel },
              { icon: CheckCircle2, l: "Overall Status", v: pageStatus.label },
              { icon: Activity, l: "Active DB Connections", v: `${data?.dbConnections.total ?? 0} (${data?.dbConnections.idle ?? 0} idle)` },
            ].map((s) => (
              <div key={s.l} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-text-dim">
                  <s.icon size={13} className="text-text-faint" />
                  {s.l}
                </span>
                <span className="font-mono-num font-medium">{s.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}