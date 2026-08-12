import { useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Cpu, Wifi, PowerOff, Wrench, AlertTriangle, Plus, Eye } from "lucide-react";
import { INITIAL_CONTROLLERS } from "../data/mock";
import { MetricCard, PageHeader, PanelHeader, StatusPill, type Tone } from "../components/ui/primitives";
import type { Controller, ControllerStatus } from "../types";
import { useApiData } from "../lib/useApiData";
import NoEquipmentState from "../components/ui/NoEquipmentState";
import Modal, { FormField, inputClass, ModalActions } from "../components/ui/Modal";
import { api, ApiError } from "../lib/api";

function AddControllerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [model, setModel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/controllers", { model });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the controller.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Add Controller" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <FormField label="Model">
          <input
            required
            autoFocus
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g. Gilbarco Encore S"
            className={inputClass}
          />
        </FormField>
        <p className="text-[11px] text-text-faint">
          The controller code (e.g. C-006) is assigned automatically. It's created online with no pumps attached yet
          &mdash; assign pumps to it from the Dispensers page.
        </p>
        <ModalActions onCancel={onClose} submitLabel="Add Controller" submitting={submitting} />
      </form>
    </Modal>
  );
}

const STATUS_TONE: Record<ControllerStatus, Tone> = {
  online: "success",
  offline: "danger",
  maintenance: "info",
};
const STATUS_LABEL: Record<ControllerStatus, string> = {
  online: "Online",
  offline: "Offline",
  maintenance: "Maintenance",
};

export default function Controllers() {
  const { data: apiControllers, refetch } = useApiData<Controller[]>("/controllers", INITIAL_CONTROLLERS);
  const controllers = apiControllers ?? INITIAL_CONTROLLERS;
  const [selectedId, setSelectedId] = useState("C-001");
  const [showAddController, setShowAddController] = useState(false);

  const addControllerModal = showAddController && (
    <AddControllerModal
      onClose={() => setShowAddController(false)}
      onCreated={() => {
        setShowAddController(false);
        refetch();
      }}
    />
  );

  if (controllers.length === 0) {
    return (
      <>
        <NoEquipmentState
          icon={Cpu}
          title="Controllers"
          message="This station doesn't have any forecourt controllers registered yet. Add one below, or switch to a station with configured hardware."
          actionLabel="Add Controller"
          onAction={() => setShowAddController(true)}
        />
        {addControllerModal}
      </>
    );
  }

  const selected = controllers.find((c) => c.id === selectedId) ?? controllers[0];

  const online = controllers.filter((c) => c.status === "online").length;
  const offline = controllers.filter((c) => c.status === "offline").length;
  const maintenance = controllers.filter((c) => c.status === "maintenance").length;
  const totalNozzles = controllers.reduce((s, c) => s + c.nozzles, 0);

  const health = [
    { name: "Online", value: online, color: "#17c964" },
    { name: "Maintenance", value: maintenance, color: "#f5a524" },
    { name: "Offline", value: offline, color: "#f31260" },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-full">
      <div className="flex-1 min-w-0">
        <PageHeader
          title="Controllers"
          status={
            offline > 0
              ? { tone: "danger", label: `${offline} Controller${offline > 1 ? "s" : ""} Offline` }
              : maintenance > 0
              ? { tone: "warning", label: `${maintenance} In Maintenance` }
              : { tone: "success", label: "All Systems Operational" }
          }
          actions={
            <button
              onClick={() => setShowAddController(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--color-accent)] text-[#081018] text-[12px] font-medium"
            >
              <Plus size={13} /> Add Controller
            </button>
          }
        />

        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-4">
          <MetricCard icon={Cpu} tone="accent" label="Total Controllers" value={String(controllers.length)} />
          <MetricCard icon={Wifi} tone="success" label="Online" value={String(online)} sub={`${Math.round((online / controllers.length) * 100)}%`} />
          <MetricCard icon={PowerOff} tone="danger" label="Offline" value={String(offline)} />
          <MetricCard icon={Wrench} tone="info" label="Maintenance" value={String(maintenance)} />
          <MetricCard icon={AlertTriangle} tone="warning" label="Total Nozzles" value={String(totalNozzles)} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
          {controllers.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`card p-3 text-left ${c.id === selectedId ? "border-[var(--color-accent)]" : "hover:border-[var(--color-border-strong)]"}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12.5px] font-semibold">{c.id}</span>
                <StatusPill tone={STATUS_TONE[c.status]} label={STATUS_LABEL[c.status]} />
              </div>
              <div className="text-[11px] text-[var(--color-text-dim)] mb-2">{c.station}</div>
              <div className="text-[10.5px] text-[var(--color-text-faint)]">{c.model}</div>
              <div className="grid grid-cols-3 gap-1 mt-2 text-[10.5px] font-mono-num">
                <div>
                  <div className="text-[var(--color-text-faint)]">Pumps</div>
                  <div>{c.pumpsOnline}/{c.pumps}</div>
                </div>
                <div>
                  <div className="text-[var(--color-text-faint)]">Nozzles</div>
                  <div>{c.nozzles}</div>
                </div>
                <div>
                  <div className="text-[var(--color-text-faint)]">Uptime</div>
                  <div className="truncate">{c.uptime}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="card">
          <PanelHeader title="Controllers List" />
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-[var(--color-text-faint)] uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">ID</th>
                  <th className="px-4 py-2.5 font-medium">Station</th>
                  <th className="px-4 py-2.5 font-medium">Model</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Pumps</th>
                  <th className="px-4 py-2.5 font-medium">Uptime</th>
                  <th className="px-4 py-2.5 font-medium">Last Seen</th>
                  <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {controllers.map((c) => (
                  <tr key={c.id} className="border-t border-[var(--color-border)] hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 font-medium">{c.id}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-dim)]">{c.station}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-dim)]">{c.model}</td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone={STATUS_TONE[c.status]} label={STATUS_LABEL[c.status]} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{c.pumpsOnline}/{c.pumps}</td>
                    <td className="px-4 py-2.5 font-mono-num">{c.uptime}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-faint)]">{c.lastSeen}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => setSelectedId(c.id)} className="text-[var(--color-text-dim)] hover:text-[var(--color-accent)]">
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[300px] lg:shrink-0 space-y-4">
        <div className="card p-4">
          <h3 className="text-[13px] font-semibold mb-3">Controller Details</h3>
          <div className="text-[16px] font-semibold mb-0.5">{selected.id}</div>
          <StatusPill tone={STATUS_TONE[selected.status]} label={STATUS_LABEL[selected.status]} />
          <div className="mt-4 space-y-2 text-[12px]">
            {[
              ["Station", selected.station],
              ["Model", selected.model],
              ["Pumps Online", `${selected.pumpsOnline}/${selected.pumps}`],
              ["Dispensers", String(selected.dispensers)],
              ["Nozzles", String(selected.nozzles)],
              ["Uptime", selected.uptime],
              ["Last Seen", selected.lastSeen],
            ].map(([l, v]) => (
              <div key={l} className="flex items-center justify-between">
                <span className="text-[var(--color-text-faint)]">{l}</span>
                <span className="font-mono-num">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <PanelHeader title="Controller Health" />
          <div className="p-4 flex items-center gap-4">
            <div className="w-[90px] h-[90px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={health} dataKey="value" innerRadius={28} outerRadius={44} paddingAngle={2} stroke="none">
                    {health.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 flex-1">
              {health.map((h) => (
                <div key={h.name} className="flex items-center justify-between text-[11.5px]">
                  <span className="flex items-center gap-1.5 text-[var(--color-text-dim)]">
                    <span className="w-2 h-2 rounded-full" style={{ background: h.color }} />
                    {h.name}
                  </span>
                  <span className="font-mono-num">{h.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <PanelHeader title="Uptime by Controller" />
          <div className="p-4 space-y-2.5">
            {controllers.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-1.5 text-text-dim">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      c.status === "online" ? "bg-success" : c.status === "maintenance" ? "bg-info" : "bg-danger"
                    }`}
                  />
                  {c.id}
                </span>
                <span className="font-mono-num">{c.uptime}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {addControllerModal}
    </div>
  );
}