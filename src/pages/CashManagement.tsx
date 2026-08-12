import { useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { Wallet, ArrowDownCircle, ArrowUpCircle, TrendingUp, Target, Landmark, Plus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { INITIAL_CASH_TXNS } from "../data/mock";
import { MetricCard, PageHeader, PanelHeader, StatusPill } from "../components/ui/primitives";
import { kes } from "../lib/format";
import type { CashTransaction, CashTxnType } from "../types";
import { useApiData } from "../lib/useApiData";
import { api, ApiError } from "../lib/api";
import Modal, { FormField, inputClass, ModalActions } from "../components/ui/Modal";

interface TrendRow {
  d: string;
  inflow: number;
  outflow: number;
}

export default function CashManagement() {
  const [limit, setLimit] = useState(20);
  const { data, refetch } = useApiData<CashTransaction[]>(`/cash-management/transactions?limit=${limit}`, INITIAL_CASH_TXNS, [limit]);
  const txns = data ?? INITIAL_CASH_TXNS;
  const { data: trend } = useApiData<TrendRow[]>("/cash-management/trend", []);
  const [showRecord, setShowRecord] = useState(false);

  const totalIn = txns.filter((t) => t.amountKes > 0).reduce((s, t) => s + t.amountKes, 0);
  const totalOut = Math.abs(txns.filter((t) => t.amountKes < 0).reduce((s, t) => s + t.amountKes, 0));
  const net = totalIn - totalOut;
  const cashOnHand = txns.filter((t) => t.method === "Cash").reduce((s, t) => s + t.amountKes, 0);
  const pendingCount = txns.filter((t) => t.status === "pending").length;

  const byMethod = Object.entries(
    txns.reduce<Record<string, number>>((acc, t) => {
      if (t.amountKes > 0) acc[t.method] = (acc[t.method] ?? 0) + t.amountKes;
      return acc;
    }, {})
  ).map(([name, value]) => ({
    name,
    value,
    color: name === "Cash" ? "#17c964" : name === "Bank Transfer" ? "#38bdf8" : "#a78bfa",
  }));

  const byType = [
    { name: "Cash In", value: totalIn, color: "#17c964" },
    { name: "Cash Out", value: totalOut, color: "#f31260" },
  ];

  const alerts: { message: string; tone: "warning" | "danger" }[] = [];
  if (net < 0) alerts.push({ message: "Net cash position is negative for the recorded period.", tone: "danger" });
  if (pendingCount > 0) alerts.push({ message: `${pendingCount} transaction${pendingCount > 1 ? "s" : ""} still pending.`, tone: "warning" });

  return (
    <div>
      <PageHeader
        title="Cash Management"
        subtitle="Monitor, track and reconcile all cash activities"
        actions={
          <button
            onClick={() => setShowRecord(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--color-accent)] text-[#081018] text-[12px] font-medium"
          >
            <Plus size={13} /> Record Transaction
          </button>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-4">
        <MetricCard icon={Landmark} tone="neutral" label="Transactions" value={String(txns.length)} />
        <MetricCard icon={ArrowDownCircle} tone="success" label="Total In (Cash & Card)" value={kes(totalIn)} />
        <MetricCard icon={ArrowUpCircle} tone="danger" label="Total Out (Expenses)" value={kes(totalOut)} />
        <MetricCard icon={TrendingUp} tone="success" label="Net Cash Position" value={kes(net)} />
        <MetricCard icon={Target} tone="warning" label="Avg Transaction" value={kes(txns.length ? (totalIn + totalOut) / txns.length : 0)} />
        <MetricCard icon={Wallet} tone="info" label="Cash on Hand" value={kes(cashOnHand)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="xl:col-span-2 card">
          <PanelHeader title="Cash Flow Trend (Last 14 Days)" />
          <div className="p-3 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend ?? []} margin={{ left: -10, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}K`} />
                <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }} formatter={(v) => kes(Number(v))} />
                <Line type="monotone" dataKey="inflow" name="In" stroke="#17c964" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="outflow" name="Out" stroke="#f31260" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <PanelHeader title="Cash by Payment Method" />
          {byMethod.length === 0 ? (
            <div className="p-6 text-center text-[12px] text-text-faint">No inflow recorded yet.</div>
          ) : (
            <div className="p-4 flex items-center gap-4">
              <div className="w-[100px] h-[100px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byMethod} dataKey="value" innerRadius={30} outerRadius={48} paddingAngle={2} stroke="none">
                      {byMethod.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                {byMethod.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-[11.5px]">
                    <span className="flex items-center gap-1.5 text-[var(--color-text-dim)] truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="truncate">{d.name}</span>
                    </span>
                    <span className="font-mono-num shrink-0">{kes(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card">
          <PanelHeader
            title="Recent Transactions"
            action={txns.length >= limit ? "View More" : undefined}
            onAction={() => setLimit((l) => l + 20)}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-[var(--color-text-faint)] uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Description</th>
                  <th className="px-4 py-2.5 font-medium">Station</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id} className="border-t border-[var(--color-border)] hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-[var(--color-text-dim)] whitespace-nowrap">{t.date}</td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone={t.type === "Cash In" ? "success" : "danger"} label={t.type} />
                    </td>
                    <td className="px-4 py-2.5">{t.description}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-dim)]">{t.station}</td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono-num font-medium ${
                        t.amountKes >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                      }`}
                    >
                      {t.amountKes >= 0 ? "+" : ""}
                      {kes(t.amountKes)}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill
                        tone={t.status === "completed" ? "success" : "warning"}
                        label={t.status === "completed" ? "Completed" : "Pending"}
                      />
                    </td>
                  </tr>
                ))}
                {txns.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-faint)]">
                      No transactions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <PanelHeader title="Cash In vs Cash Out" />
            <div className="p-4 flex items-center gap-4">
              <div className="w-[90px] h-[90px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byType} dataKey="value" innerRadius={26} outerRadius={44} paddingAngle={2} stroke="none">
                      {byType.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                {byType.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-[11.5px]">
                    <span className="flex items-center gap-1.5 text-[var(--color-text-dim)] truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="truncate">{d.name}</span>
                    </span>
                    <span className="font-mono-num shrink-0">{kes(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-[13px] font-semibold mb-3">Alerts</h3>
            {alerts.length === 0 ? (
              <div className="flex items-center gap-2 text-[12px] text-[var(--color-text-dim)]">
                <CheckCircle2 size={14} className="text-[var(--color-success)]" /> No cash alerts right now.
              </div>
            ) : (
              <div className="space-y-2.5">
                {alerts.map((a) => (
                  <div key={a.message} className="flex items-start gap-2 text-[12px]">
                    <AlertTriangle
                      size={13}
                      className={`mt-0.5 shrink-0 ${a.tone === "danger" ? "text-[var(--color-danger)]" : "text-[var(--color-warning)]"}`}
                    />
                    <span className="text-[var(--color-text-dim)]">{a.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showRecord && (
        <RecordTransactionModal
          onClose={() => setShowRecord(false)}
          onCreated={() => {
            setShowRecord(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function RecordTransactionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<CashTxnType>("Cash In");
  const [description, setDescription] = useState("");
  const [amountKes, setAmountKes] = useState(0);
  const [method, setMethod] = useState<"Cash" | "Bank Transfer">("Cash");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/cash-management/transactions", { type, description, amountKes, method });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record the transaction.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Record Transaction" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Type">
            <select value={type} onChange={(e) => setType(e.target.value as CashTxnType)} className={inputClass}>
              <option value="Cash In">Cash In</option>
              <option value="Cash Out">Cash Out</option>
            </select>
          </FormField>
          <FormField label="Method">
            <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className={inputClass}>
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </FormField>
        </div>
        <FormField label="Description">
          <input
            required
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Bank deposit, Fuel supplier payment"
            className={inputClass}
          />
        </FormField>
        <FormField label="Amount (KES)">
          <input
            required
            type="number"
            min={1}
            value={amountKes}
            onChange={(e) => setAmountKes(Number(e.target.value))}
            className={inputClass}
          />
        </FormField>
        <ModalActions onCancel={onClose} submitLabel="Record Transaction" submitting={submitting} />
      </form>
    </Modal>
  );
}