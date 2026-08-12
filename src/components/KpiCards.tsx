import { Fuel, Droplet, PauseCircle, PowerOff, Banknote, Gauge, Receipt, AlertTriangle } from "lucide-react";
import type { Pump } from "../types";
import { MetricCard } from "./ui/primitives";
import { kes, litres } from "../lib/format";

export default function KpiCards({
  pumps,
  dailyTotals,
}: {
  pumps: Pump[];
  dailyTotals: { litres: number; kes: number; transactions: number; activeAlerts: number };
}) {
  const dispensing = pumps.filter((p) => p.status === "dispensing").length;
  const idle = pumps.filter((p) => p.status === "idle").length;
  const offline = pumps.filter((p) => p.status === "offline").length;
  const active = pumps.length - offline;

  return (
    // minmax(150px, 1fr) gives every card a width floor so the grid wraps
    // to more rows instead of ever crushing a column's text to nothing.
    <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
      <MetricCard icon={Fuel} tone="accent" label="Active Pumps" value={`${active} / ${pumps.length}`} />
      <MetricCard icon={Droplet} tone="success" label="Dispensing" value={String(dispensing)} />
      <MetricCard icon={PauseCircle} tone="warning" label="Idle" value={String(idle)} />
      <MetricCard icon={PowerOff} tone="danger" label="Offline" value={String(offline)} />
      <MetricCard icon={Banknote} tone="success" label="Total Sales Today" value={kes(dailyTotals.kes)} />
      <MetricCard icon={Gauge} tone="info" label="Fuel Dispensed Today" value={litres(dailyTotals.litres, 0)} />
      <MetricCard icon={Receipt} tone="info" label="Transactions" value={String(dailyTotals.transactions)} />
      <MetricCard icon={AlertTriangle} tone="danger" label="Active Alerts" value={String(dailyTotals.activeAlerts)} />
    </div>
  );
}