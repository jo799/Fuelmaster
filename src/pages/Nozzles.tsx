import { useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Droplets, Wifi, Play, PowerOff, Plus } from "lucide-react";
import { INITIAL_NOZZLES } from "../data/mock";
import { MetricCard, PageHeader, PanelHeader, StatusPill, type Tone } from "../components/ui/primitives";
import { kes, litres } from "../lib/format";
import type { Nozzle, NozzleStatus, Pump } from "../types";
import { useApiData } from "../lib/useApiData";
import NoEquipmentState from "../components/ui/NoEquipmentState";
import Modal, { FormField, inputClass, ModalActions } from "../components/ui/Modal";
import { api, ApiError } from "../lib/api";

const STATUS_TONE: Record<NozzleStatus, Tone> = {
  online: "success",
  dispensing: "warning",
  offline: "danger",
  maintenance: "info",
};
const STATUS_LABEL: Record<NozzleStatus, string> = {
  online: "Online",
  dispensing: "Dispensing",
  offline: "Offline",
  maintenance: "Maintenance",
};

const perf = [
  { t: "12 AM", l: 10 }, { t: "4 AM", l: 25 }, { t: "8 AM", l: 60 },
  { t: "12 PM", l: 40 }, { t: "4 PM", l: 90 }, { t: "8 PM", l: 55 }, { t: "11 PM", l: 30 },
];

function AddNozzleModal({
  pumps,
  onClose,
  onCreated,
}: {
  pumps: Pump[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [pumpId, setPumpId] = useState<number | "">(pumps[0]?.id ?? "");
  const [product, setProduct] = useState<"Petrol" | "Diesel" | "Kerosene" | "LPG">("Petrol");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pumpId) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/nozzles", { pumpId, product });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the nozzle.");
    } finally {
      setSubmitting(false);
    }
  }

  if (pumps.length === 0) {
    return (
      <Modal title="Add Nozzle" onClose={onClose}>
        <p className="text-[12.5px] text-text-dim">
          You need at least one pump before you can add a nozzle. Add a pump from the Dispensers page first.
        </p>
        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="px-3.5 py-2 rounded-lg border border-border text-[12.5px] text-text-dim">
            Close
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Add Nozzle" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <FormField label="Pump">
          <select
            autoFocus
            value={pumpId}
            onChange={(e) => setPumpId(Number(e.target.value))}
            className={inputClass}
          >
            {pumps.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Product">
          <select value={product} onChange={(e) => setProduct(e.target.value as typeof product)} className={inputClass}>
            <option value="Petrol">Petrol</option>
            <option value="Diesel">Diesel</option>
            <option value="Kerosene">Kerosene</option>
            <option value="LPG">LPG</option>
          </select>
        </FormField>
        <p className="text-[11px] text-text-faint">The nozzle number is assigned automatically for the selected pump.</p>
        <ModalActions onCancel={onClose} submitLabel="Add Nozzle" submitting={submitting} />
      </form>
    </Modal>
  );
}

export default function Nozzles() {
  const { data: nozzles, refetch } = useApiData<Nozzle[]>("/nozzles", INITIAL_NOZZLES);
  const list = nozzles ?? INITIAL_NOZZLES;
  const { data: pumpsData } = useApiData<Pump[]>("/dispensers", []);
  const pumps = pumpsData ?? [];
  const [selectedId, setSelectedId] = useState(3);
  const [showAddNozzle, setShowAddNozzle] = useState(false);

  const addNozzleModal = showAddNozzle && (
    <AddNozzleModal
      pumps={pumps}
      onClose={() => setShowAddNozzle(false)}
      onCreated={() => {
        setShowAddNozzle(false);
        refetch();
      }}
    />
  );

  if (list.length === 0) {
    return (
      <>
        <NoEquipmentState
          icon={Droplets}
          title="Nozzles"
          message="This station doesn't have any nozzles registered yet. Add one below (you'll need a pump first), or switch to a station with configured hardware."
          actionLabel="Add Nozzle"
          onAction={() => setShowAddNozzle(true)}
        />
        {addNozzleModal}
      </>
    );
  }

  const selected = list.find((n) => n.id === selectedId) ?? list[0];

  const online = list.filter((n) => n.status !== "offline").length;
  const dispensing = list.filter((n) => n.status === "dispensing").length;
  const offline = list.filter((n) => n.status === "offline").length;
  const totalToday = list.reduce((s, n) => s + n.todayLitres, 0);
  const totalKes = list.reduce((s, n) => s + n.todayKes, 0);

  const topByVolume = [...list].sort((a, b) => b.todayLitres - a.todayLitres).slice(0, 3);
  const topByRevenue = [...list].sort((a, b) => b.todayKes - a.todayKes).slice(0, 3);

  return (
    <div>
      <PageHeader
        title="Nozzles"
        status={{ tone: "success", label: "Online" }}
        actions={
          <button
            onClick={() => setShowAddNozzle(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--color-accent)] text-[#081018] text-[12px] font-medium"
          >
            <Plus size={13} /> Add Nozzle
          </button>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-4">
        <MetricCard icon={Droplets} tone="accent" label="Total Nozzles" value={String(list.length)} sub="All Stations" />
        <MetricCard icon={Wifi} tone="success" label="Online" value={String(online)} sub={`${Math.round((online / list.length) * 100)}%`} />
        <MetricCard icon={Play} tone="warning" label="Dispensing" value={String(dispensing)} />
        <MetricCard icon={PowerOff} tone="danger" label="Offline" value={String(offline)} />
        <MetricCard icon={Droplets} tone="info" label="Total Today (L)" value={litres(totalToday, 0)} />
        <MetricCard icon={Droplets} tone="success" label="Total Today (KES)" value={kes(totalKes)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card">
          <PanelHeader title="Nozzle Overview" action="View All" />
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-[var(--color-text-faint)] uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Nozzle</th>
                  <th className="px-4 py-2.5 font-medium">Dispenser</th>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Flow Rate</th>
                  <th className="px-4 py-2.5 font-medium text-right">Today (L)</th>
                  <th className="px-4 py-2.5 font-medium">Last Dispensed</th>
                </tr>
              </thead>
              <tbody>
                {list.map((n) => (
                  <tr
                    key={n.id}
                    onClick={() => setSelectedId(n.id)}
                    className={`border-t border-[var(--color-border)] hover:bg-white/[0.02] cursor-pointer ${
                      n.id === selectedId ? "bg-white/[0.03]" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 font-medium">{n.id}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-dim)]">{n.dispenser}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-dim)]">{n.product}</td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone={STATUS_TONE[n.status]} label={STATUS_LABEL[n.status]} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{n.flowRate.toFixed(1)} L/min</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{n.todayLitres.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-faint)]">{n.lastDispensed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 border-t border-[var(--color-border)]">
            <div>
              <h4 className="text-[12px] font-semibold mb-2 text-[var(--color-text-dim)]">
                Top Nozzle by Volume (Today)
              </h4>
              {topByVolume.map((n, i) => (
                <div key={n.id} className="flex items-center justify-between text-[12px] py-1">
                  <span>{i + 1}. Nozzle {n.id} ({n.dispenser})</span>
                  <span className="font-mono-num">{n.todayLitres.toFixed(1)} L</span>
                </div>
              ))}
            </div>
            <div>
              <h4 className="text-[12px] font-semibold mb-2 text-[var(--color-text-dim)]">
                Top Nozzle by Revenue (Today)
              </h4>
              {topByRevenue.map((n, i) => (
                <div key={n.id} className="flex items-center justify-between text-[12px] py-1">
                  <span>{i + 1}. Nozzle {n.id} ({n.dispenser})</span>
                  <span className="font-mono-num">{kes(n.todayKes)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-semibold">Nozzle {selected.id} Details</h3>
              <StatusPill tone={STATUS_TONE[selected.status]} label={STATUS_LABEL[selected.status]} />
            </div>
            <div className="space-y-2 text-[12px]">
              {[
                ["Dispenser", selected.dispenser],
                ["Product", selected.product],
                ["Flow Rate", `${selected.flowRate.toFixed(1)} L/min`],
                ["Today (L)", selected.todayLitres.toFixed(1)],
                ["Today (KES)", kes(selected.todayKes)],
                ["Last Dispensed", selected.lastDispensed],
              ].map(([l, v]) => (
                <div key={l} className="flex items-center justify-between">
                  <span className="text-[var(--color-text-faint)]">{l}</span>
                  <span className="font-mono-num">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <PanelHeader title="Nozzle Performance (Today)" />
            <div className="p-3 h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={perf} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#17c964" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#17c964" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="t" tick={{ fontSize: 9, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }} />
                  <Area type="monotone" dataKey="l" stroke="#17c964" strokeWidth={2} fill="url(#perfFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {addNozzleModal}
    </div>
  );
}