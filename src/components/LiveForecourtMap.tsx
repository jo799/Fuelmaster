import { RefreshCw, Fuel } from "lucide-react";
import type { Pump, PumpStatus } from "../types";
import { kes, litres } from "../lib/format";

const STATUS_STYLE: Record<
  PumpStatus,
  { text: string; label: string; dot: string; bar: string; border: string }
> = {
  dispensing: {
    text: "text-success",
    label: "Dispensing",
    dot: "bg-success",
    bar: "bg-success",
    border: "border-success/25",
  },
  idle: {
    text: "text-warning",
    label: "Idle",
    dot: "bg-warning",
    bar: "bg-warning",
    border: "border-border",
  },
  offline: {
    text: "text-danger",
    label: "Offline",
    dot: "bg-danger",
    bar: "bg-danger",
    border: "border-danger/20",
  },
  maintenance: {
    text: "text-info",
    label: "Maintenance",
    dot: "bg-info",
    bar: "bg-info",
    border: "border-info/20",
  },
};

function PumpTile({ pump }: { pump: Pump }) {
  const s = STATUS_STYLE[pump.status];
  const isActive = pump.status === "dispensing";
  // How far into the current fill we are, for the flow indicator bar.
  const target = pump.targetLitres ?? 30;
  const fillPct = isActive ? Math.min(100, (pump.litres / target) * 100) : 0;

  return (
    <div className={`card border ${s.border} overflow-hidden flex flex-col`}>
      <div className="flex items-center justify-between px-3.5 pt-3">
        <span className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-white/5 grid place-items-center text-text-dim">
            <Fuel size={13} />
          </span>
          <span className="text-[13px] font-semibold">{pump.name}</span>
        </span>
        <span className={`flex items-center gap-1.5 text-[10.5px] font-medium ${s.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${isActive ? "animate-pulse" : ""}`} />
          {s.label}
        </span>
      </div>

      <div className="px-3.5 pt-2 text-[11px] text-text-dim">
        Nozzle {pump.nozzle} <span className="mx-1 text-text-faint">&middot;</span> {pump.product}
      </div>

      <div className="px-3.5 pt-1.5 text-[19px] font-semibold font-mono-num leading-tight">
        {kes(pump.amountKes)}
      </div>

      <div className="px-3.5 pt-1 flex items-center justify-between text-[10.5px] text-text-faint font-mono-num">
        <span>{litres(pump.litres)}</span>
        <span>{pump.flowRate.toFixed(0)} L/min</span>
      </div>

      {/* Fill progress toward this transaction's target volume */}
      <div className="mt-3 h-[3px] bg-white/5">
        <div
          className={`h-full ${s.bar} transition-[width] duration-1000 ease-linear`}
          style={{ width: `${isActive ? fillPct : 0}%` }}
        />
      </div>
    </div>
  );
}

export default function LiveForecourtMap({ pumps }: { pumps: Pump[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-[13.5px] font-semibold">Live Forecourt</h3>
        <div className="flex items-center gap-1.5 text-[11px] text-text-faint">
          <RefreshCw size={12} className="animate-spin [animation-duration:3s]" />
          Auto refresh &middot; 5s
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {pumps.map((p) => (
          <PumpTile key={p.id} pump={p} />
        ))}
      </div>
    </div>
  );
}
