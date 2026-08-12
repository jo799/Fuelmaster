import { useMemo, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Truck, Package, Banknote, Gauge, Clock3, TrendingUp, Plus } from "lucide-react";
import { INITIAL_DELIVERIES, DELIVERIES_UPCOMING } from "../data/mock";
import { MetricCard, PageHeader, PanelHeader, StatusPill, type Tone } from "../components/ui/primitives";
import { kes, litres } from "../lib/format";
import type { DeliveryRow, DeliveryStatus } from "../types";
import { useApiData } from "../lib/useApiData";
import { api, ApiError } from "../lib/api";
import Modal, { FormField, inputClass, ModalActions } from "../components/ui/Modal";
import RowActions from "../components/ui/RowActions";

const STATUS_TONE: Record<DeliveryStatus, Tone> = {
  Received: "success",
  "In Transit": "info",
  Scheduled: "warning",
  Cancelled: "danger",
};

const FILTERS: { label: string; status: DeliveryStatus | "All" }[] = [
  { label: "All", status: "All" },
  { label: "Scheduled", status: "Scheduled" },
  { label: "In Transit", status: "In Transit" },
  { label: "Received", status: "Received" },
  { label: "Cancelled", status: "Cancelled" },
];

export default function Deliveries() {
  const [filter, setFilter] = useState<DeliveryStatus | "All">("All");
  const { data, refetch } = useApiData<DeliveryRow[]>("/deliveries", INITIAL_DELIVERIES);
  const deliveries = data ?? INITIAL_DELIVERIES;
  const [showAdd, setShowAdd] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<DeliveryRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(d: DeliveryRow) {
    if (!confirm(`Delete delivery ${d.id}? This can't be undone.`)) return;
    setDeletingId(d.id);
    try {
      await api.del(`/deliveries/${d.id}`);
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not delete the delivery.");
    } finally {
      setDeletingId(null);
    }
  }

  const rows = useMemo(
    () => (filter === "All" ? deliveries : deliveries.filter((d) => d.status === filter)),
    [deliveries, filter]
  );
  const totalQty = deliveries.reduce((s, d) => s + d.quantityL, 0);
  const totalCost = deliveries.reduce((s, d) => s + d.costKes, 0);

  const summary = [
    { name: "Received", value: deliveries.filter((d) => d.status === "Received").length, color: "#17c964" },
    { name: "In Transit", value: deliveries.filter((d) => d.status === "In Transit").length, color: "#38bdf8" },
    { name: "Scheduled", value: deliveries.filter((d) => d.status === "Scheduled").length, color: "#f5a524" },
    { name: "Cancelled", value: deliveries.filter((d) => d.status === "Cancelled").length, color: "#f31260" },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-full">
      <div className="flex-1 min-w-0">
        <PageHeader
          title="Deliveries"
          status={{ tone: "success", label: "All Deliveries" }}
          actions={
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-bg text-[12px] font-medium"
            >
              <Plus size={13} /> New Delivery
            </button>
          }
        />

        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-4">
          <MetricCard icon={Truck} tone="accent" label="Total Deliveries" value={String(deliveries.length)} sub="All Time" />
          <MetricCard icon={Package} tone="info" label="Total Quantity" value={litres(totalQty, 0)} sub="All Time" />
          <MetricCard icon={Banknote} tone="success" label="Total Cost" value={kes(totalCost)} sub="All Time" />
          <MetricCard icon={Gauge} tone="warning" label="Avg. Cost / Litre" value={`KES ${(totalCost / totalQty).toFixed(2)}`} />
          <MetricCard icon={Clock3} tone="danger" label="Pending Deliveries" value="2" sub="Requires Action" />
          <MetricCard icon={TrendingUp} tone="success" label="Total Delivered Volume" value={litres(totalQty, 0)} />
        </div>

        <div className="flex items-center gap-1.5 mb-3">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setFilter(f.status)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                filter === f.status ? "bg-accent-soft text-accent" : "text-text-dim hover:bg-white/4"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-text-faint uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Delivery ID</th>
                  <th className="px-4 py-2.5 font-medium">Date & Time</th>
                  <th className="px-4 py-2.5 font-medium">Supplier</th>
                  <th className="px-4 py-2.5 font-medium">Fuel Type</th>
                  <th className="px-4 py-2.5 font-medium text-right">Quantity</th>
                  <th className="px-4 py-2.5 font-medium text-right">Cost</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Note</th>
                  <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-t border-border hover:bg-white/2">
                    <td className="px-4 py-2.5 font-mono-num text-accent underline decoration-border">{d.id}</td>
                    <td className="px-4 py-2.5 text-text-dim whitespace-nowrap">{d.date}</td>
                    <td className="px-4 py-2.5">{d.supplier}</td>
                    <td className="px-4 py-2.5 text-text-dim">{d.fuelType}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{litres(d.quantityL, 0)}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num font-medium">{kes(d.costKes)}</td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone={STATUS_TONE[d.status]} label={d.status} />
                    </td>
                    <td className="px-4 py-2.5 text-text-faint">{d.note}</td>
                    <td className="px-4 py-2.5 text-right">
                      <RowActions
                        onEdit={() => setEditingDelivery(d)}
                        onDelete={() => handleDelete(d)}
                        deleting={deletingId === d.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border text-[11.5px] text-text-faint">
            Showing {rows.length} of {deliveries.length} deliveries
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[300px] lg:shrink-0 space-y-4 lg:overflow-y-auto lg:pr-1">
        <div className="card">
          <PanelHeader title="Delivery Summary" action="View All" />
          <div className="p-4 flex items-center gap-4">
            <div className="relative w-[100px] h-[100px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={summary} dataKey="value" innerRadius={30} outerRadius={48} paddingAngle={2} stroke="none">
                    {summary.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center">
                  <div className="text-[13px] font-semibold font-mono-num">{deliveries.length}</div>
                  <div className="text-[9px] text-text-faint">Total</div>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {summary.map((d) => (
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

        <div className="card p-4">
          <PanelHeader title="Upcoming Deliveries" />
          <div className="pt-3 space-y-2.5">
            {DELIVERIES_UPCOMING.map((u) => (
              <div key={u.date} className="flex items-center justify-between text-[12px]">
                <div>
                  <div>{u.date}</div>
                  <div className="text-text-faint text-[10.5px]">{u.supplier}</div>
                </div>
                <span className="font-mono-num">{litres(u.quantityL, 0)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <PanelHeader title="Recent Deliveries" />
          <div className="pt-3 space-y-2">
            {deliveries.slice(0, 5).map((d) => (
              <div key={d.id} className="flex items-center justify-between text-[12px]">
                <span className="text-accent font-mono-num">{d.id}</span>
                <span className="text-text-dim">{d.date.split(" ").slice(0, 3).join(" ")}</span>
                <span className="font-mono-num">{litres(d.quantityL, 0)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-[13px] font-semibold mb-3">Delivery Insights</h3>
          <div className="space-y-2.5 text-[12.5px]">
            {[
              ["On-Time Deliveries", "92%"],
              ["Avg. Delivery Time", "2.4 hrs"],
              ["Total Cost", "1.43 M"],
              ["Total Quantity", litres(totalQty, 0)],
            ].map(([l, v]) => (
              <div key={l} className="flex items-center justify-between">
                <span className="text-text-dim">{l}</span>
                <span className="font-mono-num font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAdd && (
        <NewDeliveryModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            refetch();
          }}
        />
      )}

      {editingDelivery && (
        <UpdateDeliveryStatusModal
          delivery={editingDelivery}
          onClose={() => setEditingDelivery(null)}
          onUpdated={() => {
            setEditingDelivery(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function UpdateDeliveryStatusModal({
  delivery,
  onClose,
  onUpdated,
}: {
  delivery: DeliveryRow;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [status, setStatus] = useState<DeliveryStatus>(delivery.status);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/deliveries/${delivery.id}`, { status });
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the delivery.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Update ${delivery.id}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <p className="text-[12px] text-text-dim">
          {delivery.supplier} &middot; {delivery.fuelType} &middot; {delivery.quantityL.toLocaleString()} L
        </p>
        <FormField label="Status">
          <select
            autoFocus
            value={status}
            onChange={(e) => setStatus(e.target.value as DeliveryStatus)}
            className={inputClass}
          >
            <option value="Scheduled">Scheduled</option>
            <option value="In Transit">In Transit</option>
            <option value="Received">Received</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </FormField>
        <ModalActions onCancel={onClose} submitLabel="Update Status" submitting={submitting} />
      </form>
    </Modal>
  );
}function NewDeliveryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [supplier, setSupplier] = useState("");
  const [fuelType, setFuelType] = useState<"Petrol" | "Diesel" | "Kerosene" | "LPG">("Diesel");
  const [quantityL, setQuantityL] = useState(5000);
  const [costKes, setCostKes] = useState(0);
  const [status, setStatus] = useState<"Received" | "In Transit" | "Scheduled">("Scheduled");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/deliveries", { supplier, fuelType, quantityL, costKes, status, note });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the delivery.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New Delivery" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <FormField label="Supplier">
          <input required autoFocus value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inputClass} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Fuel Type">
            <select value={fuelType} onChange={(e) => setFuelType(e.target.value as typeof fuelType)} className={inputClass}>
              <option value="Petrol">Petrol</option>
              <option value="Diesel">Diesel</option>
              <option value="Kerosene">Kerosene</option>
              <option value="LPG">LPG</option>
            </select>
          </FormField>
          <FormField label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputClass}>
              <option value="Scheduled">Scheduled</option>
              <option value="In Transit">In Transit</option>
              <option value="Received">Received</option>
            </select>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Quantity (L)">
            <input type="number" min={1} value={quantityL} onChange={(e) => setQuantityL(Number(e.target.value))} className={inputClass} />
          </FormField>
          <FormField label="Cost (KES)">
            <input type="number" min={0} value={costKes} onChange={(e) => setCostKes(Number(e.target.value))} className={inputClass} />
          </FormField>
        </div>
        <FormField label="Note / PO Number">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </FormField>
        <ModalActions onCancel={onClose} submitLabel="Create Delivery" submitting={submitting} />
      </form>
    </Modal>
  );
}