import type { Pump, PumpStatus } from "../types";
import { kes, litres } from "../lib/format";

const STATUS_STYLE: Record<PumpStatus, { text: string; dot: string; label: string }> = {
  dispensing: { text: "text-[var(--color-success)]", dot: "bg-[var(--color-success)]", label: "Dispensing" },
  idle: { text: "text-[var(--color-warning)]", dot: "bg-[var(--color-warning)]", label: "Idle" },
  offline: { text: "text-[var(--color-danger)]", dot: "bg-[var(--color-danger)]", label: "Offline" },
  maintenance: { text: "text-[var(--color-info)]", dot: "bg-[var(--color-info)]", label: "Maintenance" },
};

export default function PumpOverviewTable({ pumps }: { pumps: Pump[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <h3 className="text-[13.5px] font-semibold">Pump Overview</h3>
        <button className="text-[11.5px] text-[var(--color-accent)] hover:underline">
          View All
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-[11px] text-[var(--color-text-faint)] uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Pump</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Nozzle</th>
              <th className="px-4 py-2.5 font-medium">Product</th>
              <th className="px-4 py-2.5 font-medium text-right">Litres</th>
              <th className="px-4 py-2.5 font-medium text-right">Amount</th>
              <th className="px-4 py-2.5 font-medium text-right">Flow Rate</th>
              <th className="px-4 py-2.5 font-medium">Controller</th>
            </tr>
          </thead>
          <tbody>
            {pumps.map((p) => {
              const s = STATUS_STYLE[p.status];
              return (
                <tr
                  key={p.id}
                  className="border-t border-[var(--color-border)] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-2.5 font-medium">{p.name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 ${s.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-text-dim)]">Nozzle {p.nozzle}</td>
                  <td className="px-4 py-2.5 text-[var(--color-text-dim)]">{p.product}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num">{litres(p.litres)}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num">{kes(p.amountKes)}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num text-[var(--color-text-dim)]">
                    {p.flowRate.toFixed(2)} L/min
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-accent)]">{p.controller}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
