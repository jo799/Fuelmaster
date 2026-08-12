import { useMemo, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Package, Box, TriangleAlert, PackageX, Banknote, TrendingUp, Plus, ArrowDown, ArrowUp } from "lucide-react";
import { INITIAL_INVENTORY, INVENTORY_MOVEMENTS } from "../data/mock";
import { MetricCard, PageHeader, PanelHeader, StatusPill, type Tone } from "../components/ui/primitives";
import { kes } from "../lib/format";
import type { InventoryItem, InventoryStatus } from "../types";
import { useApiData } from "../lib/useApiData";
import { api, ApiError } from "../lib/api";
import Modal, { FormField, inputClass, ModalActions } from "../components/ui/Modal";
import RowActions from "../components/ui/RowActions";

const STATUS_TONE: Record<InventoryStatus, Tone> = {
  "In Stock": "success",
  "Low Stock": "warning",
  "Out of Stock": "danger",
};

const CATEGORIES = ["All Items", "Fuel", "Lubricants", "Other Products"] as const;

interface MovementRow {
  item: string;
  delta: number;
  unit: string;
  reason?: string;
  ago?: string;
}

export default function Inventory() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All Items");
  const { data, refetch } = useApiData<InventoryItem[]>("/inventory", INITIAL_INVENTORY);
  const items = data ?? INITIAL_INVENTORY;
  const { data: movementData } = useApiData<MovementRow[]>("/inventory/movements", INVENTORY_MOVEMENTS);
  const movements = movementData ?? INVENTORY_MOVEMENTS;
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleDelete(i: InventoryItem) {
    if (!i.id) return;
    if (!confirm(`Delete inventory item "${i.name}"? This can't be undone.`)) return;
    setDeletingId(i.id);
    try {
      await api.del(`/inventory/${i.id}`);
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not delete the item.");
    } finally {
      setDeletingId(null);
    }
  }

  const rows = useMemo(
    () => (category === "All Items" ? items : items.filter((i) => i.category === category)),
    [items, category]
  );

  const summary = [
    { name: "In Stock", value: items.filter((i) => i.status === "In Stock").length, color: "#17c964" },
    { name: "Low Stock", value: items.filter((i) => i.status === "Low Stock").length, color: "#f5a524" },
    { name: "Out of Stock", value: items.filter((i) => i.status === "Out of Stock").length, color: "#f31260" },
  ];

  const lowStock = useMemo(
    () =>
      [...items]
        .filter((i) => i.status !== "In Stock")
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 4)
        .map((i) => ({ name: i.name, quantity: `${i.quantity.toLocaleString()} ${i.unit === "Units" ? "" : i.unit === "Liters" ? "L" : i.unit}`.trim() })),
    [items]
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-full">
      <div className="flex-1 min-w-0">
        <PageHeader
          title="Inventory"
          status={{ tone: "success", label: "All Items" }}
          actions={
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-bg text-[12px] font-medium"
            >
              <Plus size={13} /> Add Inventory Item
            </button>
          }
        />

        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-4">
          <MetricCard icon={Package} tone="accent" label="Total Items" value={String(items.length)} sub="All Items" />
          <MetricCard icon={Box} tone="success" label="In Stock" value={String(items.filter((i) => i.status === "In Stock").length)} />
          <MetricCard icon={TriangleAlert} tone="warning" label="Low Stock" value={String(items.filter((i) => i.status === "Low Stock").length)} />
          <MetricCard icon={PackageX} tone="danger" label="Out of Stock" value={String(items.filter((i) => i.status === "Out of Stock").length)} />
          <MetricCard icon={Banknote} tone="info" label="Total Cost" value={kes(items.reduce((s, i) => s + i.costKes * i.quantity, 0))} sub="Total Value" />
          <MetricCard icon={TrendingUp} tone="success" label="Total Stock Value" value={kes(items.reduce((s, i) => s + i.valueKes, 0))} sub="Current Value" />
        </div>

        <div className="flex items-center gap-1.5 mb-3">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                category === c ? "bg-accent-soft text-accent" : "text-text-dim hover:bg-white/4"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-text-faint uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Item</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Location</th>
                  <th className="px-4 py-2.5 font-medium">Unit</th>
                  <th className="px-4 py-2.5 font-medium text-right">Quantity</th>
                  <th className="px-4 py-2.5 font-medium text-right">Cost</th>
                  <th className="px-4 py-2.5 font-medium text-right">Value</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.name} className="border-t border-border hover:bg-white/2">
                    <td className="px-4 py-2.5 font-medium">{i.name}</td>
                    <td className="px-4 py-2.5 text-text-dim">{i.category}</td>
                    <td className="px-4 py-2.5 text-text-dim">{i.location}</td>
                    <td className="px-4 py-2.5 text-text-faint">{i.unit}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{i.quantity.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{kes(i.costKes)}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num font-medium">{kes(i.valueKes)}</td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone={STATUS_TONE[i.status]} label={i.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <RowActions
                        onEdit={() => setEditingItem(i)}
                        onDelete={() => handleDelete(i)}
                        deleting={deletingId === i.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border text-[11.5px] text-text-faint">
            Showing {rows.length} of {items.length} items
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[300px] lg:shrink-0 space-y-4 lg:overflow-y-auto lg:pr-1">
        <div className="card">
          <PanelHeader title="Inventory Summary" />
          <div className="p-4 flex items-center gap-4">
            <div className="relative w-[110px] h-[110px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={summary} dataKey="value" innerRadius={36} outerRadius={52} paddingAngle={2} stroke="none">
                    {summary.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center">
                  <div className="text-[13px] font-semibold font-mono-num">128</div>
                  <div className="text-[9px] text-text-faint">Items</div>
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
          <PanelHeader title="Top Low Stock Items" action="View All" />
          <div className="pt-3 space-y-2.5">
            {lowStock.map((i) => (
              <div key={i.name} className="flex items-center justify-between text-[12px]">
                <span className="text-text-dim">{i.name}</span>
                <span className="font-mono-num text-warning font-medium">{i.quantity}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <PanelHeader title="Recent Stock Movements" action="View All" />
          <div className="pt-3 space-y-2.5">
            {movements.map((m) => (
              <div key={m.item} className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-1.5 min-w-0">
                  {m.delta < 0 ? (
                    <ArrowDown size={12} className="text-danger shrink-0" />
                  ) : (
                    <ArrowUp size={12} className="text-success shrink-0" />
                  )}
                  <span className="text-text-dim truncate">{m.item}</span>
                </span>
                <span className={`font-mono-num shrink-0 ${m.delta < 0 ? "text-danger" : "text-success"}`}>
                  {m.delta > 0 ? "+" : ""}
                  {m.delta} {m.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAdd && (
        <AddInventoryItemModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            refetch();
          }}
        />
      )}

      {editingItem && (
        <AddInventoryItemModal
          editing={editingItem}
          onClose={() => setEditingItem(null)}
          onCreated={() => {
            setEditingItem(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function AddInventoryItemModal({
  editing,
  onClose,
  onCreated,
}: {
  editing?: InventoryItem;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [itemCategory, setItemCategory] = useState<"Fuel" | "Lubricants" | "Other Products">(
    editing?.category ?? "Other Products"
  );
  const [location, setLocation] = useState(editing?.location ?? "");
  const [unit, setUnit] = useState(editing?.unit ?? "Units");
  const [quantity, setQuantity] = useState(editing?.quantity ?? 0);
  const [costKes, setCostKes] = useState(editing?.costKes ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (editing?.id) {
        await api.patch(`/inventory/${editing.id}`, { name, category: itemCategory, location, unit, quantity, costKes });
      } else {
        await api.post("/inventory", { name, category: itemCategory, location, unit, quantity, costKes });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the item.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={editing ? "Edit Inventory Item" : "Add Inventory Item"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <FormField label="Item Name">
          <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Category">
            <select value={itemCategory} onChange={(e) => setItemCategory(e.target.value as typeof itemCategory)} className={inputClass}>
              <option value="Fuel">Fuel</option>
              <option value="Lubricants">Lubricants</option>
              <option value="Other Products">Other Products</option>
            </select>
          </FormField>
          <FormField label="Location">
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Store 1" className={inputClass} />
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Unit">
            <input value={unit} onChange={(e) => setUnit(e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Quantity">
            <input type="number" min={0} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className={inputClass} />
          </FormField>
          <FormField label="Unit Cost (KES)">
            <input type="number" min={0} value={costKes} onChange={(e) => setCostKes(Number(e.target.value))} className={inputClass} />
          </FormField>
        </div>
        <ModalActions onCancel={onClose} submitLabel={editing ? "Save Changes" : "Add Item"} submitting={submitting} />
      </form>
    </Modal>
  );
}