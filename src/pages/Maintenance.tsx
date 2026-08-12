import { useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { ClipboardList, CheckCircle2, Clock3, AlertTriangle, CalendarClock, Banknote, Plus } from "lucide-react";
import { INITIAL_WORK_ORDERS } from "../data/mock";
import { MetricCard, PageHeader, PanelHeader, StatusPill, type Tone } from "../components/ui/primitives";
import type { WorkOrder, WorkOrderStatus, WorkOrderPriority, WorkOrderType } from "../types";
import { useApiData } from "../lib/useApiData";
import { api, ApiError } from "../lib/api";
import Modal, { FormField, inputClass, ModalActions } from "../components/ui/Modal";
import RowActions from "../components/ui/RowActions";

const STATUS_TONE: Record<WorkOrderStatus, Tone> = {
  Completed: "success",
  "In Progress": "warning",
  Scheduled: "info",
  Overdue: "danger",
};

const PRIORITY_TONE: Record<WorkOrderPriority, Tone> = {
  High: "danger",
  Medium: "warning",
  Low: "neutral",
};

const TYPE_COLORS: Record<string, string> = {
  Preventive: "#f5a524",
  Corrective: "#38bdf8",
  Inspections: "#a78bfa",
  Other: "#8b98a5",
};
const PRIORITY_COLORS: Record<string, string> = { High: "#f31260", Medium: "#f5a524", Low: "#8b98a5" };

interface TrendRow {
  d: string;
  created: number;
}

export default function Maintenance() {
  const { data, refetch } = useApiData<WorkOrder[]>("/maintenance/work-orders", INITIAL_WORK_ORDERS);
  const workOrders = data ?? INITIAL_WORK_ORDERS;
  const { data: trend } = useApiData<TrendRow[]>("/maintenance/trend", []);
  const [showAdd, setShowAdd] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const byType = Object.entries(
    workOrders.reduce<Record<string, number>>((acc, w) => {
      acc[w.type] = (acc[w.type] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value, color: TYPE_COLORS[name] ?? "#8b98a5" }));

  const byPriority = Object.entries(
    workOrders.reduce<Record<string, number>>((acc, w) => {
      acc[w.priority] = (acc[w.priority] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value, color: PRIORITY_COLORS[name] ?? "#8b98a5" }));

  const byAsset = Object.entries(
    workOrders.reduce<Record<string, number>>((acc, w) => {
      acc[w.asset] = (acc[w.asset] ?? 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const maxAssetCount = Math.max(1, ...byAsset.map((a) => a.value));

  const upcomingPreventive = workOrders
    .filter((w) => w.type === "Preventive" && w.status !== "Completed")
    .slice(0, 5);

  async function handleDelete(w: WorkOrder) {
    if (!confirm(`Delete work order ${w.id}? This can't be undone.`)) return;
    setDeletingId(w.id);
    try {
      await api.del(`/maintenance/work-orders/${w.id}`);
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not delete the work order.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Maintenance"
        subtitle="Keep your station running at peak performance"
        actions={
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-bg text-[12px] font-medium"
          >
            <Plus size={13} /> New Maintenance
          </button>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-4">
        <MetricCard icon={ClipboardList} tone="accent" label="Total Work Orders" value={String(workOrders.length)} />
        <MetricCard icon={CheckCircle2} tone="success" label="Completed" value={String(workOrders.filter((w) => w.status === "Completed").length)} />
        <MetricCard icon={Clock3} tone="warning" label="In Progress" value={String(workOrders.filter((w) => w.status === "In Progress").length)} />
        <MetricCard icon={AlertTriangle} tone="danger" label="Overdue" value={String(workOrders.filter((w) => w.status === "Overdue").length)} />
        <MetricCard icon={CalendarClock} tone="info" label="Preventive Due" value={String(workOrders.filter((w) => w.type === "Preventive" && w.status !== "Completed").length)} />
        <MetricCard icon={Banknote} tone="success" label="Unassigned" value={String(workOrders.filter((w) => w.assignedTo === "Unassigned").length)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="xl:col-span-2 card">
          <PanelHeader title="Work Orders Created (Last 7 Days)" />
          <div className="p-3 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend ?? []} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }} />
                <Line type="monotone" dataKey="created" name="Created" stroke="#17c964" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <PanelHeader title="Work Orders by Type" />
          <div className="p-4 flex items-center gap-4">
            <div className="relative w-[110px] h-[110px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byType} dataKey="value" innerRadius={36} outerRadius={52} paddingAngle={2} stroke="none">
                    {byType.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center">
                  <div className="text-[13px] font-semibold font-mono-num">{workOrders.length}</div>
                  <div className="text-[9px] text-text-faint">Total</div>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {byType.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-[11px] gap-2">
                  <span className="flex items-center gap-1.5 min-w-0 text-text-dim">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="truncate">{d.name}</span>
                  </span>
                  <span className="font-mono-num shrink-0">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card">
          <PanelHeader title="Work Orders" />
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-text-faint uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">WO #</th>
                  <th className="px-4 py-2.5 font-medium">Description</th>
                  <th className="px-4 py-2.5 font-medium">Priority</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Assigned To</th>
                  <th className="px-4 py-2.5 font-medium">Due Date</th>
                  <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((w) => (
                  <tr key={w.id} className="border-t border-border hover:bg-white/2">
                    <td className="px-4 py-2.5 font-mono-num text-accent">{w.id}</td>
                    <td className="px-4 py-2.5">
                      {w.description}
                      <div className="text-[10.5px] text-text-faint">{w.asset} &middot; {w.type}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone={PRIORITY_TONE[w.priority]} label={w.priority} />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone={STATUS_TONE[w.status]} label={w.status} />
                    </td>
                    <td className="px-4 py-2.5 text-text-dim">{w.assignedTo}</td>
                    <td className="px-4 py-2.5 text-text-faint whitespace-nowrap">{w.dueDate}</td>
                    <td className="px-4 py-2.5 text-right">
                      <RowActions
                        onEdit={() => setEditingOrder(w)}
                        onDelete={() => handleDelete(w)}
                        deleting={deletingId === w.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border text-[11.5px] text-text-faint">
            Showing all {workOrders.length} work orders
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <PanelHeader title="Upcoming Preventive Maintenance" />
            {upcomingPreventive.length === 0 ? (
              <p className="text-[12px] text-text-faint pt-3">No preventive work orders pending.</p>
            ) : (
              <div className="pt-3 space-y-2.5">
                {upcomingPreventive.map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-2 text-[12px]">
                    <div className="min-w-0">
                      <div className="truncate">{w.description}</div>
                      <div className="text-text-faint text-[10.5px]">{w.asset}</div>
                    </div>
                    <StatusPill tone={STATUS_TONE[w.status]} label={w.dueDate} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <PanelHeader title="Work Orders by Priority" />
            {byPriority.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-text-faint">No work orders yet.</div>
            ) : (
              <div className="p-4 flex items-center gap-4">
                <div className="relative w-[100px] h-[100px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={byPriority} dataKey="value" innerRadius={30} outerRadius={48} paddingAngle={2} stroke="none">
                        {byPriority.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 grid place-items-center pointer-events-none">
                    <div className="text-center">
                      <div className="text-[13px] font-semibold font-mono-num">{workOrders.length}</div>
                      <div className="text-[9px] text-text-faint">Total</div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  {byPriority.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-[11px] gap-2">
                      <span className="flex items-center gap-1.5 min-w-0 text-text-dim">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="truncate">{d.name}</span>
                      </span>
                      <span className="font-mono-num shrink-0">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card p-4">
            <PanelHeader title="Most-Serviced Assets" />
            {byAsset.length === 0 ? (
              <p className="text-[12px] text-text-faint pt-3">No work orders yet.</p>
            ) : (
              <div className="pt-3 space-y-2.5">
                {byAsset.map((a) => (
                  <div key={a.name}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <span className="text-text-dim truncate">{a.name}</span>
                      <span className="font-mono-num">{a.value} work order{a.value > 1 ? "s" : ""}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-warning" style={{ width: `${(a.value / maxAssetCount) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAdd && (
        <NewWorkOrderModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            refetch();
          }}
        />
      )}

      {editingOrder && (
        <UpdateWorkOrderModal
          workOrder={editingOrder}
          onClose={() => setEditingOrder(null)}
          onUpdated={() => {
            setEditingOrder(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function UpdateWorkOrderModal({
  workOrder,
  onClose,
  onUpdated,
}: {
  workOrder: WorkOrder;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [status, setStatus] = useState<WorkOrderStatus>(workOrder.status);
  const [priority, setPriority] = useState<WorkOrderPriority>(workOrder.priority);
  const [assignedTo, setAssignedTo] = useState(workOrder.assignedTo);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/maintenance/work-orders/${workOrder.id}`, { status, priority, assignedTo });
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the work order.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Update ${workOrder.id}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <p className="text-[12px] text-text-dim">
          {workOrder.description} &middot; {workOrder.asset}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as WorkOrderStatus)} className={inputClass}>
              <option value="Scheduled">Scheduled</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Overdue">Overdue</option>
            </select>
          </FormField>
          <FormField label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value as WorkOrderPriority)} className={inputClass}>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </FormField>
        </div>
        <FormField label="Assigned To">
          <input autoFocus value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className={inputClass} />
        </FormField>
        <ModalActions onCancel={onClose} submitLabel="Save Changes" submitting={submitting} />
      </form>
    </Modal>
  );
}function NewWorkOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [description, setDescription] = useState("");
  const [asset, setAsset] = useState("");
  const [type, setType] = useState<WorkOrderType>("Corrective");
  const [priority, setPriority] = useState<WorkOrderPriority>("Medium");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/maintenance/work-orders", { description, asset, type, priority, dueDate });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the work order.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New Work Order" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <FormField label="Description">
          <input required autoFocus value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Asset">
          <input required value={asset} onChange={(e) => setAsset(e.target.value)} placeholder="e.g. Dispenser 2, Tank 1" className={inputClass} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Type">
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={inputClass}>
              <option value="Corrective">Corrective</option>
              <option value="Preventive">Preventive</option>
              <option value="Inspections">Inspections</option>
              <option value="Other">Other</option>
            </select>
          </FormField>
          <FormField label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value as WorkOrderPriority)} className={inputClass}>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </FormField>
        </div>
        <FormField label="Due Date">
          <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
        </FormField>
        <ModalActions onCancel={onClose} submitLabel="Create Work Order" submitting={submitting} />
      </form>
    </Modal>
  );
}