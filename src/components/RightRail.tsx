import { ShoppingCart, Tag, Truck, PowerOff, type LucideIcon } from "lucide-react";
import type { Pump, ForecourtEvent, EventLevel } from "../types";
import { kes, litres, mmss } from "../lib/format";
import { useApiData } from "../lib/useApiData";

function Panel({
  title,
  onViewAll,
  children,
}: {
  title: string;
  onViewAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {onViewAll && (
          <button onClick={onViewAll} className="text-[11px] text-[var(--color-accent)] hover:underline">
            View All
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function StatRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between text-[12.5px] py-1.5">
      <span className="text-[var(--color-text-dim)]">{label}</span>
      <span className={`font-mono-num font-medium ${tone ?? ""}`}>{value}</span>
    </div>
  );
}

const EVENT_DOT: Record<EventLevel, string> = {
  success: "bg-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]",
  danger: "bg-[var(--color-danger)]",
  info: "bg-[var(--color-info)]",
};

function QuickAction({ icon: Icon, label, tone, onClick }: { icon: LucideIcon; label: string; tone: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 rounded-[10px] py-3 text-[11.5px] font-medium border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors"
      style={{ color: tone }}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

interface ControllerRow {
  status: string;
}

export default function RightRail({
  pumps,
  events,
  onNavigate,
}: {
  pumps: Pump[];
  events: ForecourtEvent[];
  onNavigate: (route: string) => void;
}) {
  const dispensing = pumps.filter((p) => p.status === "dispensing");
  const idle = pumps.filter((p) => p.status === "idle").length;
  const offline = pumps.filter((p) => p.status === "offline").length;
  const active = pumps.length - offline;

  const { data: controllers } = useApiData<ControllerRow[]>("/controllers", []);
  const controllersDown = (controllers ?? []).filter((c) => c.status !== "online").length;
  const controllerStatusLabel =
    !controllers || controllers.length === 0 ? "None Registered" : controllersDown === 0 ? "Online" : `${controllersDown} Down`;
  const controllerStatusTone =
    !controllers || controllers.length === 0
      ? "text-[var(--color-warning)]"
      : controllersDown === 0
      ? "text-[var(--color-success)]"
      : "text-[var(--color-danger)]";

  return (
    <div className="w-full lg:w-[300px] lg:shrink-0 space-y-4 lg:overflow-y-auto lg:pr-1">
      <Panel title="Forecourt Overview" onViewAll={() => onNavigate("dispensers")}>
        <StatRow label="Active Pumps" value={`${active} / ${pumps.length}`} />
        <StatRow label="Dispensing" value={String(dispensing.length)} tone="text-[var(--color-success)]" />
        <StatRow label="Idle" value={String(idle)} tone="text-[var(--color-warning)]" />
        <StatRow label="Offline" value={String(offline)} tone="text-[var(--color-danger)]" />
        <StatRow label="Controller Status" value={controllerStatusLabel} tone={controllerStatusTone} />
      </Panel>

      <Panel title="Active Transactions" onViewAll={() => onNavigate("sales")}>
        <div className="space-y-2.5">
          {dispensing.length === 0 && (
            <p className="text-[12px] text-[var(--color-text-faint)]">No active transactions.</p>
          )}
          {dispensing.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between text-[12.5px] pb-2.5 border-b border-[var(--color-border)] last:border-0 last:pb-0"
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] shrink-0" />
                <span className="font-medium">
                  {p.name} - Nozzle {p.nozzle}
                </span>
              </div>
              <div className="text-right leading-tight">
                <div className="font-mono-num">{litres(p.litres)}</div>
                <div className="font-mono-num text-[var(--color-text-faint)] text-[10.5px]">
                  {kes(p.amountKes)} &middot; {mmss(p.elapsedSec)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Recent Events" onViewAll={() => onNavigate("audit-logs")}>
        <div className="space-y-3">
          {events.map((e) => (
            <div key={e.id} className="flex items-start gap-2.5 text-[12px]">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${EVENT_DOT[e.level]}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[var(--color-text)] leading-snug">
                  <span className="text-[var(--color-text-faint)] font-mono-num mr-1.5">
                    {e.time}
                  </span>
                  {e.message}
                </div>
              </div>
              <span className="text-[10.5px] text-[var(--color-text-faint)] shrink-0 whitespace-nowrap">
                {e.ago}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="card p-4">
        <h3 className="text-[13px] font-semibold mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2.5">
          <QuickAction icon={ShoppingCart} label="New Sale" tone="#17c964" onClick={() => onNavigate("pos")} />
          <QuickAction icon={Tag} label="Price Change" tone="#38bdf8" onClick={() => onNavigate("price-management")} />
          <QuickAction icon={Truck} label="Delivery" tone="#a78bfa" onClick={() => onNavigate("deliveries")} />
          <QuickAction icon={PowerOff} label="Shift Close" tone="#f9a826" onClick={() => onNavigate("shifts")} />
        </div>
      </div>
    </div>
  );
}