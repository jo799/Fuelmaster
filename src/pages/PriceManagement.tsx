import { useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Tag, Gauge, Repeat, ListChecks, AlertTriangle, Clock3, Plus, ArrowUp, ArrowDown, Pencil, Check, X } from "lucide-react";
import { INITIAL_FUEL_PRICES, PRICE_HISTORY, PRICE_TREND } from "../data/mock";
import { MetricCard, PageHeader, PanelHeader, StatusPill } from "../components/ui/primitives";
import type { FuelPriceRow } from "../types";
import { useApiData } from "../lib/useApiData";
import { api, ApiError } from "../lib/api";
import Modal, { FormField, inputClass, ModalActions } from "../components/ui/Modal";

const TABS = ["Fuel Prices", "Price Rules", "History", "Schedules"];

interface PriceHistoryRow {
  date: string;
  fuel: string;
  oldPrice: number;
  newPrice: number;
  changedBy: string;
  reason: string;
}

export default function PriceManagement() {
  const [tab, setTab] = useState("Fuel Prices");
  const { data, refetch } = useApiData<FuelPriceRow[]>("/price-management", INITIAL_FUEL_PRICES);
  const prices = data ?? INITIAL_FUEL_PRICES;
  const { data: historyData, refetch: refetchHistory } = useApiData<PriceHistoryRow[]>(
    "/price-management/history",
    PRICE_HISTORY
  );
  const history = historyData ?? PRICE_HISTORY;

  const [editingFuel, setEditingFuel] = useState<string | null>(null);
  const [showNewPrice, setShowNewPrice] = useState(false);
  const [draftPrice, setDraftPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function startEdit(p: FuelPriceRow) {
    setEditingFuel(p.fuel);
    setDraftPrice(String(p.currentPrice));
    setErrorMsg(null);
  }

  function cancelEdit() {
    setEditingFuel(null);
    setErrorMsg(null);
  }

  async function saveEdit(fuel: string) {
    const newPrice = Number(draftPrice);
    if (!newPrice || newPrice <= 0) {
      setErrorMsg("Enter a valid price greater than 0.");
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      await api.post("/price-management", { fuel, newPrice, reason: "Manual update" });
      setEditingFuel(null);
      refetch();
      refetchHistory();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not update the price.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Price Management"
        status={{ tone: "success", label: "All Prices" }}
        actions={
          <button
            onClick={() => setShowNewPrice(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-bg text-[12px] font-medium"
          >
            <Plus size={13} /> New Price
          </button>
        }
      />

      <div className="flex items-center gap-1 mb-4 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3.5 py-2 text-[12.5px] whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t ? "border-accent text-accent font-medium" : "border-transparent text-text-dim hover:text-text"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-4">
        <MetricCard icon={Tag} tone="accent" label="Active Price Items" value="8" sub="All Fuels" />
        <MetricCard icon={Gauge} tone="info" label="Average Price (KES/L)" value="1,156" sub="Across All Fuels" />
        <MetricCard icon={Repeat} tone="warning" label="Today's Price Changes" value="2" sub="1 up / 1 down" />
        <MetricCard icon={ListChecks} tone="success" label="Total Price Rules" value="3" sub="Active" />
        <MetricCard icon={AlertTriangle} tone="danger" label="Low Margin Alerts" value="1" sub="Needs Attention" />
        <MetricCard icon={Clock3} tone="info" label="Next Scheduled Update" value="In 14 Hrs" sub="Auto Update" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card">
          <PanelHeader title="Fuel Prices" />
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-text-faint uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Fuel</th>
                  <th className="px-4 py-2.5 font-medium text-right">Current Price</th>
                  <th className="px-4 py-2.5 font-medium text-right">Previous Price</th>
                  <th className="px-4 py-2.5 font-medium text-right">Change</th>
                  <th className="px-4 py-2.5 font-medium">Effective From</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p) => {
                  const change = p.currentPrice - p.previousPrice;
                  const pct = p.previousPrice ? (change / p.previousPrice) * 100 : 0;
                  const isEditing = editingFuel === p.fuel;
                  return (
                    <tr key={p.fuel} className="border-t border-border hover:bg-white/2">
                      <td className="px-4 py-2.5 font-medium">{p.fuel}</td>
                      <td className="px-4 py-2.5 text-right font-mono-num font-semibold">
                        {isEditing ? (
                          <input
                            autoFocus
                            type="number"
                            value={draftPrice}
                            onChange={(e) => setDraftPrice(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(p.fuel);
                              if (e.key === "Escape") cancelEdit();
                            }}
                            className="w-24 bg-white/5 border border-accent rounded-md px-2 py-1 text-right font-mono-num text-[12.5px] focus:outline-none"
                          />
                        ) : (
                          p.currentPrice.toLocaleString()
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono-num text-text-dim">{p.previousPrice.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right">
                        {change === 0 ? (
                          <span className="font-mono-num text-text-faint">0.00%</span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 font-mono-num ${change > 0 ? "text-success" : "text-danger"}`}>
                            {change > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                            {Math.abs(pct).toFixed(2)}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-text-faint whitespace-nowrap">{p.effectiveFrom}</td>
                      <td className="px-4 py-2.5">
                        <StatusPill tone={p.status === "Active" ? "success" : "danger"} label={p.status} />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => saveEdit(p.fuel)}
                              disabled={saving}
                              className="p-1.5 rounded-md bg-success-soft text-success disabled:opacity-50"
                              title="Save"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={saving}
                              className="p-1.5 rounded-md border border-border text-text-dim disabled:opacity-50"
                              title="Cancel"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(p)}
                            className="p-1.5 rounded-md border border-border text-text-dim hover:border-border-strong hover:text-accent transition-colors"
                            title="Edit price"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {errorMsg && (
            <div className="mx-4 mb-3 text-[11.5px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
              {errorMsg}
            </div>
          )}
          <div className="px-4 py-3 border-t border-border text-[11.5px] text-text-faint">
            Showing {prices.length} of 10 items
          </div>

          <div className="p-4 border-t border-border">
            <h3 className="text-[13.5px] font-semibold mb-3">Price History (Last 10 Changes)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[10.5px] text-text-faint uppercase tracking-wide">
                    <th className="pr-4 py-2 font-medium">Date & Time</th>
                    <th className="pr-4 py-2 font-medium">Fuel</th>
                    <th className="pr-4 py-2 font-medium text-right">Old Price</th>
                    <th className="pr-4 py-2 font-medium text-right">New Price</th>
                    <th className="pr-4 py-2 font-medium">Changed By</th>
                    <th className="pr-4 py-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="pr-4 py-2 text-text-faint whitespace-nowrap">{h.date}</td>
                      <td className="pr-4 py-2">{h.fuel}</td>
                      <td className="pr-4 py-2 text-right font-mono-num text-text-dim">{h.oldPrice}</td>
                      <td className="pr-4 py-2 text-right font-mono-num font-medium">{h.newPrice}</td>
                      <td className="pr-4 py-2 text-text-dim">{h.changedBy}</td>
                      <td className="pr-4 py-2 text-text-faint">{h.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <PanelHeader title="Price Trend (KES/L) - Last 7 Days" />
            <div className="p-3 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={PRICE_TREND} margin={{ left: -10, right: 8, top: 8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="d" tick={{ fontSize: 9, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} domain={["dataMin - 50", "dataMax + 50"]} />
                  <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" name="Diesel" dataKey="diesel" stroke="#17c964" strokeWidth={2} dot={false} />
                  <Line type="monotone" name="Petrol" dataKey="petrol" stroke="#f9a826" strokeWidth={2} dot={false} />
                  <Line type="monotone" name="Kerosene" dataKey="kerosene" stroke="#a78bfa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-4">
            <PanelHeader title="Recent Price Changes" />
            <div className="pt-3 space-y-3">
              {[
                { m: "Diesel (ENS90) price increased", d: "Jul 17, 10:00 AM", v: "+40 KES/L", up: true },
                { m: "Petrol (PMS 95) price increased", d: "Jul 17, 10:00 AM", v: "+40 KES/L", up: true },
                { m: "Kerosene price decreased", d: "Jul 17, 10:00 AM", v: "-20 KES/L", up: false },
                { m: "AdBlue (10L) price decreased", d: "Jul 12, 08:00 AM", v: "-20 KES/L", up: false },
              ].map((c) => (
                <div key={c.m} className="flex items-start justify-between gap-2 text-[12px]">
                  <div className="flex items-start gap-2 min-w-0">
                    {c.up ? (
                      <ArrowUp size={13} className="text-success mt-0.5 shrink-0" />
                    ) : (
                      <ArrowDown size={13} className="text-danger mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate">{c.m}</div>
                      <div className="text-text-faint text-[10.5px]">{c.d}</div>
                    </div>
                  </div>
                  <span className={`shrink-0 font-mono-num ${c.up ? "text-success" : "text-danger"}`}>{c.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <PanelHeader title="Price Rules" action="View All" />
            <div className="pt-3 space-y-2.5">
              {[
                "Fuel Price Adjustment (Daily)",
                "Weekend Promotion",
                "Kerosene Max Price Limit",
              ].map((r) => (
                <div key={r} className="flex items-center justify-between text-[12px]">
                  <span className="text-text-dim">{r}</span>
                  <StatusPill tone="success" label="Active" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showNewPrice && (
        <NewPriceModal
          existingFuels={prices.map((p) => p.fuel)}
          onClose={() => setShowNewPrice(false)}
          onCreated={() => {
            setShowNewPrice(false);
            refetch();
            refetchHistory();
          }}
        />
      )}
    </div>
  );
}

function NewPriceModal({
  existingFuels,
  onClose,
  onCreated,
}: {
  existingFuels: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fuel, setFuel] = useState("");
  const [newPrice, setNewPrice] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDuplicate = fuel.trim().length > 0 && existingFuels.some((f) => f.toLowerCase() === fuel.trim().toLowerCase());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isDuplicate) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/price-management", { fuel: fuel.trim(), newPrice, reason: "Initial price set" });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the price.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New Price" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <FormField label="Fuel / Product Name">
          <input
            required
            autoFocus
            value={fuel}
            onChange={(e) => setFuel(e.target.value)}
            placeholder="e.g. Petrol (PMS 95)"
            className={inputClass}
          />
          {isDuplicate && (
            <p className="text-[11px] text-danger mt-1">
              A price already exists for this product \u2014 edit it from the table instead of creating a duplicate.
            </p>
          )}
        </FormField>
        <FormField label="Price (KES)">
          <input
            required
            type="number"
            min={0.01}
            step="0.01"
            value={newPrice}
            onChange={(e) => setNewPrice(Number(e.target.value))}
            className={inputClass}
          />
        </FormField>
        <p className="text-[11px] text-text-faint">
          Use this for a product this station doesn't have a price on record for yet \u2014 e.g. onboarding a new
          station, or introducing a new fuel grade or shop product.
        </p>
        <ModalActions onCancel={onClose} submitLabel="Create Price" submitting={submitting || isDuplicate} />
      </form>
    </Modal>
  );
}