import { useState } from "react";
import { Fuel, Play, Pause, PowerOff, Wrench, Plus } from "lucide-react";
import { INITIAL_PUMPS } from "../data/mock";
import { MetricCard, PageHeader, PanelHeader, StatusPill, type Tone } from "../components/ui/primitives";
import { kes, litres } from "../lib/format";
import type { Pump, PumpStatus } from "../types";
import { useApiData } from "../lib/useApiData";
import { usePumpTelemetry } from "../lib/usePumpTelemetry";
import NoEquipmentState from "../components/ui/NoEquipmentState";
import Modal, { FormField, inputClass, ModalActions } from "../components/ui/Modal";
import { api, ApiError } from "../lib/api";
import { mergeLive } from "../lib/mergeLive";

const STATUS_TONE: Record<PumpStatus, Tone> = {
  dispensing: "success",
  idle: "warning",
  offline: "danger",
  maintenance: "info",
};

const STATUS_LABEL: Record<PumpStatus, string> = {
  dispensing: "Dispensing",
  idle: "Idle",
  offline: "Offline",
  maintenance: "Maintenance",
};

interface DashboardKpis {
  salesToday: number;
  litresToday: number;
}

function AddPumpModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [product, setProduct] = useState<"Petrol" | "Diesel" | "Kerosene" | "LPG">("Petrol");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/dispensers", { name: name.trim() || undefined, product });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the pump.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Add Pump" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <FormField label="Pump Name (optional)">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Leave blank to auto-name (e.g. Pump 3)"
            className={inputClass}
          />
        </FormField>
        <FormField label="Default Product">
          <select value={product} onChange={(e) => setProduct(e.target.value as typeof product)} className={inputClass}>
            <option value="Petrol">Petrol</option>
            <option value="Diesel">Diesel</option>
            <option value="Kerosene">Kerosene</option>
            <option value="LPG">LPG</option>
          </select>
        </FormField>
        <p className="text-[11px] text-text-faint">
          The pump is created idle. Add nozzles to it from the Nozzles page once it's here.
        </p>
        <ModalActions onCancel={onClose} submitLabel="Add Pump" submitting={submitting} />
      </form>
    </Modal>
  );
}

export default function Dispensers() {
  const { data: snapshot, refetch } = useApiData<Pump[]>("/dispensers", INITIAL_PUMPS);
  const { data: kpis } = useApiData<DashboardKpis>("/dashboard/kpis");
  const { pumps: livePumps } = usePumpTelemetry(true);
  const pumps = mergeLive(snapshot ?? INITIAL_PUMPS, livePumps);
  const [selectedId, setSelectedId] = useState(1);
  const [showAddPump, setShowAddPump] = useState(false);

  const addPumpModal = showAddPump && (
    <AddPumpModal
      onClose={() => setShowAddPump(false)}
      onCreated={() => {
        setShowAddPump(false);
        refetch();
      }}
    />
  );

  if (pumps.length === 0) {
    return (
      <>
        <NoEquipmentState
          icon={Fuel}
          title="Dispensers"
          message="This station doesn't have any pumps registered yet. Add one below, or switch to a station with configured hardware."
          actionLabel="Add Pump"
          onAction={() => setShowAddPump(true)}
        />
        {addPumpModal}
      </>
    );
  }

  const selected = pumps.find((p) => p.id === selectedId) ?? pumps[0];

  const online = pumps.filter((p) => p.status !== "offline").length;
  const dispensing = pumps.filter((p) => p.status === "dispensing").length;
  const idle = pumps.filter((p) => p.status === "idle").length;
  const offline = pumps.filter((p) => p.status === "offline").length;
  const totalLitres = kpis?.litresToday ?? pumps.reduce((s, p) => s + p.litres, 0);
  const totalKes = kpis?.salesToday ?? pumps.reduce((s, p) => s + p.amountKes, 0);

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-full">
      <div className="flex-1 min-w-0">
        <PageHeader
          title="Dispensers"
          status={{ tone: "success", label: "Online" }}
          actions={
            <button
              onClick={() => setShowAddPump(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--color-accent)] text-[#081018] text-[12px] font-medium"
            >
              <Plus size={13} /> Add Dispenser
            </button>
          }
        />

        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-4">
          <MetricCard icon={Fuel} tone="accent" label="Total Dispensers" value={String(pumps.length)} sub="Online" />
          <MetricCard icon={Play} tone="success" label="Dispensing" value={String(dispensing)} sub="Active" />
          <MetricCard icon={Pause} tone="warning" label="Idle" value={String(idle)} />
          <MetricCard icon={PowerOff} tone="danger" label="Offline" value={String(offline)} />
          <MetricCard icon={Wrench} tone="info" label="Maintenance" value="1" />
          <MetricCard icon={Fuel} tone="neutral" label="Total Fuel Dispensed" value={litres(totalLitres, 0)} sub="Today" />
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3 mb-4">
          {pumps.map((p) => {
            const tone = STATUS_TONE[p.status];
            const active = p.id === selectedId;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`card p-3 text-left transition-colors ${
                  active ? "border-[var(--color-accent)]" : "hover:border-[var(--color-border-strong)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[12.5px] font-semibold truncate min-w-0">
                    PUMP {p.id.toString().padStart(2, "0")}
                  </span>
                  <StatusPill tone={tone} label={STATUS_LABEL[p.status]} />
                </div>
                <div className="text-[11px] text-[var(--color-text-dim)] mb-2">
                  Nozzle {p.nozzle} &middot; {p.product}
                </div>
                <div className="text-[15px] font-semibold font-mono-num">{kes(p.amountKes)}</div>
                <div className="flex items-center justify-between text-[10.5px] text-[var(--color-text-faint)] font-mono-num mt-1">
                  <span>{p.flowRate.toFixed(1)} L/min</span>
                  <span>{litres(p.litres)}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="card">
          <PanelHeader title="Dispenser Overview" />
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-[var(--color-text-faint)] uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Pump</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Nozzle</th>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 font-medium text-right">Flow Rate</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total Today</th>
                  <th className="px-4 py-2.5 font-medium">Controller</th>
                </tr>
              </thead>
              <tbody>
                {pumps.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className="border-t border-[var(--color-border)] hover:bg-white/[0.02] cursor-pointer"
                  >
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone={STATUS_TONE[p.status]} label={STATUS_LABEL[p.status]} />
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-dim)]">Nozzle {p.nozzle}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-dim)]">{p.product}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{p.flowRate.toFixed(1)} L/min</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{kes(p.amountKes)}</td>
                    <td className="px-4 py-2.5 text-[var(--color-accent)]">{p.controller}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[280px] lg:shrink-0 space-y-4">
        <div className="card p-4">
          <h3 className="text-[13px] font-semibold mb-3">Dispenser Details</h3>
          <div className="text-[16px] font-semibold mb-0.5">{selected.name}</div>
          <StatusPill tone={STATUS_TONE[selected.status]} label={STATUS_LABEL[selected.status]} />
          <div className="mt-4 space-y-2.5">
            {[
              ["Nozzle", String(selected.nozzle)],
              ["Product", selected.product],
              ["Current Litres", litres(selected.litres)],
              ["Current Amount", kes(selected.amountKes)],
              ["Flow Rate", `${selected.flowRate.toFixed(1)} L/min`],
              ["Controller", selected.controller],
            ].map(([l, v]) => (
              <div key={l} className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--color-text-faint)]">{l}</span>
                <span className="font-mono-num">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-[13px] font-semibold mb-3">Quick Stats</h3>
          <div className="space-y-2.5 text-[12.5px]">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-dim)]">Today&apos;s Dispensed</span>
              <span className="font-mono-num">{litres(totalLitres, 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-dim)]">Today&apos;s Sales</span>
              <span className="font-mono-num">{kes(totalKes)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-dim)]">Active Dispensers</span>
              <span className="font-mono-num">
                {online} / {pumps.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {addPumpModal}
    </div>
  );
}