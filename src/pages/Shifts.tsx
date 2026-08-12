import { useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { Calendar, Clock, Receipt, Banknote, TrendingUp, TrendingDown, Plus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { INITIAL_SHIFTS, TOP_CASHIERS } from "../data/mock";
import { MetricCard, PageHeader, PanelHeader, StatusPill, type Tone } from "../components/ui/primitives";
import { kes } from "../lib/format";
import type { ShiftRow, ShiftStatus, AdminUser } from "../types";
import { useApiData } from "../lib/useApiData";
import { api, ApiError } from "../lib/api";
import Modal, { FormField, inputClass, ModalActions } from "../components/ui/Modal";

const STATUS_TONE: Record<ShiftStatus, Tone> = {
  Completed: "success",
  "In Progress": "warning",
  Scheduled: "info",
  Cancelled: "danger",
};

interface CashierRow {
  name: string;
  salesKes: number;
}
interface ShiftStats {
  totalHours: number;
  overtimeHours: number;
  byTimeOfDay: { t: string; v: number }[];
  dailyCounts: { d: string; count: number }[];
}

export default function Shifts() {
  const { data, refetch } = useApiData<ShiftRow[]>("/shifts", INITIAL_SHIFTS);
  const shifts = data ?? INITIAL_SHIFTS;
  const { data: cashierData } = useApiData<CashierRow[]>("/shifts/top-cashiers", TOP_CASHIERS);
  const topCashiers = cashierData ?? TOP_CASHIERS;
  const maxCashierSales = Math.max(1, ...topCashiers.map((c) => c.salesKes));
  const { data: stats } = useApiData<ShiftStats>("/shifts/stats");
  const [showNewShift, setShowNewShift] = useState(false);

  const totalTransactions = shifts.reduce((s, x) => s + x.transactions, 0);
  const totalSales = shifts.reduce((s, x) => s + x.salesKes, 0);
  const avgSalesPerShift = shifts.length ? totalSales / shifts.length : 0;
  const avgTxnsPerShift = shifts.length ? Math.round(totalTransactions / shifts.length) : 0;
  const completedCount = shifts.filter((s) => s.status === "Completed").length;
  const inProgressCount = shifts.filter((s) => s.status === "In Progress").length;
  const completionRate = shifts.length ? Math.round((completedCount / shifts.length) * 100) : 0;

  const statusSplit = [
    { name: "Completed", value: completedCount, color: "#17c964" },
    { name: "In Progress", value: inProgressCount, color: "#f5a524" },
    { name: "Scheduled", value: shifts.filter((s) => s.status === "Scheduled").length, color: "#38bdf8" },
    { name: "Cancelled", value: shifts.filter((s) => s.status === "Cancelled").length, color: "#f31260" },
  ];

  const upcomingShifts = shifts
    .filter((s) => s.status === "Scheduled")
    .slice(0, 5);

  // Real, derived alerts \u2014 no more literal fake messages referencing
  // shift IDs that may not even exist in the current data.
  const alerts: { message: string; tone: Tone }[] = [];
  const longRunning = shifts.filter((s) => s.status === "In Progress");
  if (longRunning.length > 0) {
    alerts.push({
      message: `${longRunning.length} shift${longRunning.length > 1 ? "s" : ""} currently in progress.`,
      tone: "warning",
    });
  }
  const cancelledRecent = shifts.filter((s) => s.status === "Cancelled").length;
  if (cancelledRecent > 0) {
    alerts.push({ message: `${cancelledRecent} cancelled shift${cancelledRecent > 1 ? "s" : ""} on record.`, tone: "danger" });
  }
  if ((stats?.overtimeHours ?? 0) > 0) {
    alerts.push({ message: `${stats!.overtimeHours} total overtime hours recorded across completed shifts.`, tone: "info" });
  }

  return (
    <div>
      <PageHeader
        title="Shifts"
        subtitle="Manage and monitor shifts and cashier performance"
        actions={
          <button
            onClick={() => setShowNewShift(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-bg text-[12px] font-medium"
          >
            <Plus size={13} /> New Shift
          </button>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-4">
        <MetricCard icon={Calendar} tone="accent" label="Total Shifts" value={String(shifts.length)} />
        <MetricCard icon={Clock} tone="info" label="Completed" value={String(completedCount)} />
        <MetricCard icon={Receipt} tone="info" label="Total Transactions" value={totalTransactions.toLocaleString()} />
        <MetricCard icon={Banknote} tone="success" label="Total Sales" value={kes(totalSales)} />
        <MetricCard icon={TrendingUp} tone="success" label="Average Sales / Shift" value={kes(avgSalesPerShift)} />
        <MetricCard icon={TrendingDown} tone="danger" label="In Progress" value={String(inProgressCount)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="card">
          <PanelHeader title="Shifts Started (Last 7 Days)" />
          <div className="p-3 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.dailyCounts ?? []} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }} />
                <Line type="monotone" dataKey="count" name="Shifts" stroke="#17c964" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <PanelHeader title="Shift Status" />
          <div className="p-4 flex items-center gap-4">
            <div className="relative w-[110px] h-[110px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusSplit} dataKey="value" innerRadius={36} outerRadius={52} paddingAngle={2} stroke="none">
                    {statusSplit.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center">
                  <div className="text-[13px] font-semibold font-mono-num">{shifts.length}</div>
                  <div className="text-[9px] text-text-faint">Total</div>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {statusSplit.map((d) => (
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

        <div className="card">
          <PanelHeader title="Shifts by Time of Day" />
          <div className="p-3 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.byTimeOfDay ?? []} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 9, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="v" fill="#17c964" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="xl:col-span-2 card">
          <PanelHeader title="Shifts List" />
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-text-faint uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Shift ID</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Cashier</th>
                  <th className="px-4 py-2.5 font-medium">Station</th>
                  <th className="px-4 py-2.5 font-medium text-right">Transactions</th>
                  <th className="px-4 py-2.5 font-medium text-right">Sales</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s.id} className="border-t border-border hover:bg-white/2">
                    <td className="px-4 py-2.5 font-mono-num text-accent">{s.id}</td>
                    <td className="px-4 py-2.5 text-text-dim whitespace-nowrap">
                      {s.date}
                      <div className="text-[10.5px] text-text-faint">{s.time}</div>
                    </td>
                    <td className="px-4 py-2.5">{s.cashier}</td>
                    <td className="px-4 py-2.5 text-text-dim">{s.station}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{s.transactions}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num font-medium">{kes(s.salesKes)}</td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone={STATUS_TONE[s.status]} label={s.status} />
                    </td>
                  </tr>
                ))}
                {shifts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-text-faint">
                      No shifts recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border text-[11.5px] text-text-faint">
            Showing all {shifts.length} shifts
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-[13px] font-semibold mb-3">Shift Summary</h3>
            <div className="space-y-2 text-[12.5px]">
              {[
                ["Total Shifts", String(shifts.length)],
                ["Total Hours", `${stats?.totalHours ?? 0} hrs`],
                ["Total Transactions", totalTransactions.toLocaleString()],
                ["Total Sales", kes(totalSales)],
                ["Average Sales / Shift", kes(avgSalesPerShift)],
              ].map(([l, v]) => (
                <div key={l} className="flex items-center justify-between">
                  <span className="text-text-dim">{l}</span>
                  <span className="font-mono-num font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-[13px] font-semibold mb-3">Upcoming Shifts</h3>
            {upcomingShifts.length === 0 ? (
              <p className="text-[12px] text-text-faint">No scheduled shifts on record.</p>
            ) : (
              <div className="space-y-2.5 text-[12px]">
                {upcomingShifts.map((s) => (
                  <div key={s.id} className="flex items-start justify-between gap-2">
                    <span className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-info mt-1.5 shrink-0" />
                      <span className="text-text-dim">
                        {s.date} {s.time}
                      </span>
                    </span>
                    <span className="shrink-0">{s.cashier}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card p-4">
          <h3 className="text-[13px] font-semibold mb-3">Shift Performance</h3>
          <div className="grid grid-cols-2 gap-3 text-[12.5px]">
            {[
              ["Completion Rate", `${completionRate}%`],
              ["Avg. Sales / Shift", kes(avgSalesPerShift)],
              ["Transactions / Shift", String(avgTxnsPerShift)],
              ["Overtime Hours", `${stats?.overtimeHours ?? 0} hrs`],
            ].map(([l, v]) => (
              <div key={l}>
                <div className="text-[10.5px] text-text-faint">{l}</div>
                <div className="font-mono-num font-semibold text-[14px] mt-0.5">{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <PanelHeader title="Top Cashiers (by Sales)" />
          {topCashiers.length === 0 ? (
            <p className="text-[12px] text-text-faint pt-3">No sales recorded yet.</p>
          ) : (
            <div className="pt-3 space-y-2.5">
              {topCashiers.map((c, i) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span>{i + 1}. {c.name}</span>
                    <span className="font-mono-num text-text-dim">{kes(c.salesKes)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-success" style={{ width: `${(c.salesKes / maxCashierSales) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4">
          <h3 className="text-[13px] font-semibold mb-3">Shift Alerts</h3>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 text-[12px] text-text-dim">
              <CheckCircle2 size={14} className="text-success" /> No shift alerts right now.
            </div>
          ) : (
            <div className="space-y-2.5 text-[12px]">
              {alerts.map((a) => (
                <div key={a.message} className="flex items-start gap-2">
                  <AlertTriangle
                    size={13}
                    className={`mt-0.5 shrink-0 ${
                      a.tone === "danger" ? "text-danger" : a.tone === "warning" ? "text-warning" : "text-info"
                    }`}
                  />
                  <span className="text-text-dim">{a.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showNewShift && (
        <NewShiftModal
          onClose={() => setShowNewShift(false)}
          onCreated={() => {
            setShowNewShift(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function NewShiftModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data: users } = useApiData<AdminUser[]>("/users", []);
  const cashiers = (users ?? []).filter((u) => u.status === "Active");
  const [cashierEmail, setCashierEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/shifts", { cashierEmail });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start the shift.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New Shift" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <FormField label="Cashier">
          <select required value={cashierEmail} onChange={(e) => setCashierEmail(e.target.value)} className={inputClass}>
            <option value="">Select a cashier&hellip;</option>
            {cashiers.map((c) => (
              <option key={c.email} value={c.email}>
                {c.name} ({c.role})
              </option>
            ))}
          </select>
        </FormField>
        <p className="text-[11px] text-text-faint">The shift starts now and stays "In Progress" until clocked out.</p>
        <ModalActions onCancel={onClose} submitLabel="Start Shift" submitting={submitting || !cashierEmail} />
      </form>
    </Modal>
  );
}