import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { Banknote, TrendingDown, TrendingUp, Percent, Landmark, Wallet, Download } from "lucide-react";
import { MetricCard, PageHeader, PanelHeader, StatusPill } from "../components/ui/primitives";
import { kes } from "../lib/format";
import { useApiData } from "../lib/useApiData";
import { exportToCsv } from "../lib/exportCsv";
import { useAuth } from "../lib/AuthContext";
import { useState } from "react";

interface FinanceSummary {
  revenue: number;
  expenses: number;
}
interface ExpenseRow {
  category: string;
  value: number;
}
interface TrendRow {
  d: string;
  revenue: number;
  expenses: number;
}
interface StationFinanceRow {
  station: string;
  revenue: number;
  expenses: number;
  profit: number;
}
interface FleetAccountRow {
  accountId: string;
  name: string;
  balanceKes: number;
  status: string;
}
interface DeliveryRow {
  costKes: number;
  status: string;
}

const EXPENSE_COLORS: Record<string, string> = {
  "Fuel Purchases": "#17c964",
  Payroll: "#38bdf8",
  Maintenance: "#f5a524",
  Utilities: "#a78bfa",
  Other: "#8b98a5",
};

const TABS = ["Overview", "By Station", "Tax"] as const;
type Tab = (typeof TABS)[number];

function nextFilingDate(): string {
  const now = new Date();
  const filingDay = 20;
  const candidate = new Date(now.getFullYear(), now.getMonth(), filingDay);
  if (now.getDate() >= filingDay) candidate.setMonth(candidate.getMonth() + 1);
  return candidate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Finance() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("Overview");
  const { data: summary } = useApiData<FinanceSummary>("/finance/summary");
  const { data: expenseRows } = useApiData<ExpenseRow[]>("/finance/expenses", []);
  const { data: trend } = useApiData<TrendRow[]>("/finance/trend", []);
  const { data: byStation } = useApiData<StationFinanceRow[]>("/finance/by-station", []);
  const { data: fleetAccounts } = useApiData<FleetAccountRow[]>("/fleet-accounts", []);
  const { data: deliveries } = useApiData<DeliveryRow[]>("/deliveries", []);

  const totalRevenue = summary?.revenue ?? 0;
  const totalExpenses = summary?.expenses ?? 0;
  const totalProfit = totalRevenue - totalExpenses;
  const margin = totalRevenue ? (totalProfit / totalRevenue) * 100 : 0;

  const expenseBreakdown = (expenseRows ?? []).map((e) => ({
    name: e.category,
    value: e.value,
    color: EXPENSE_COLORS[e.category] ?? "#8b98a5",
  }));

  // Real receivable proxy: money customers owe via Fleet Account credit.
  const accountsReceivable = (fleetAccounts ?? []).reduce((s, a) => s + Math.max(0, a.balanceKes), 0);
  // We don't track vendor invoices/payment status, so this is honestly
  // labeled as recorded delivery cost rather than claiming to be true AP.
  const recordedDeliveryCost = (deliveries ?? []).reduce((s, d) => s + d.costKes, 0);

  const taxableSalesMtd = totalRevenue;
  const vatCollectedMtd = totalRevenue - totalRevenue / 1.16;
  const canSeeAllStations = user?.role === "Administrator";

  return (
    <div>
      <PageHeader
        title="Finance"
        subtitle="Revenue, expenses, and profitability"
        actions={
          <button
            onClick={() => exportToCsv("finance-by-station", byStation ?? [])}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-bg text-[12px] font-medium"
          >
            <Download size={13} /> Export
          </button>
        }
      />

      <div className="flex items-center gap-1 mb-4 border-b border-border overflow-x-auto">
        {TABS.filter((t) => t !== "By Station" || canSeeAllStations).map((t) => (
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
        <MetricCard icon={Banknote} tone="accent" label="Total Revenue" value={kes(totalRevenue)} sub="This month" />
        <MetricCard icon={TrendingDown} tone="danger" label="Total Expenses" value={kes(totalExpenses)} sub="This month" />
        <MetricCard icon={TrendingUp} tone="success" label="Net Profit" value={kes(totalProfit)} />
        <MetricCard icon={Percent} tone="success" label="Profit Margin" value={`${margin.toFixed(1)}%`} />
        <MetricCard icon={Landmark} tone="warning" label="Fleet Receivables" value={kes(accountsReceivable)} />
        <MetricCard icon={Wallet} tone="danger" label="Recorded Delivery Cost" value={kes(recordedDeliveryCost)} />
      </div>

      {tab === "Overview" && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
            <div className="xl:col-span-2 card">
              <PanelHeader title="Revenue vs Expenses (Last 14 Days)" />
              <div className="p-3 h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend ?? []} margin={{ left: -10, right: 8, top: 8 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="d" tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}K`} />
                    <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }} formatter={(v) => kes(Number(v))} />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#17c964" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#f31260" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <PanelHeader title="Expense Breakdown" />
              {expenseBreakdown.length === 0 ? (
                <div className="p-6 text-center text-[12px] text-text-faint">No expenses recorded yet.</div>
              ) : (
                <div className="p-4 flex items-center gap-4">
                  <div className="relative w-[110px] h-[110px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={expenseBreakdown} dataKey="value" innerRadius={36} outerRadius={52} paddingAngle={2} stroke="none">
                          {expenseBreakdown.map((d) => (
                            <Cell key={d.name} fill={d.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 grid place-items-center pointer-events-none">
                      <div className="text-center">
                        <div className="text-[12px] font-semibold font-mono-num">{kes(totalExpenses)}</div>
                        <div className="text-[9px] text-text-faint">Total</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5 min-w-0">
                    {expenseBreakdown.map((d) => (
                      <div key={d.name} className="flex items-center justify-between text-[11px] gap-2">
                        <span className="flex items-center gap-1.5 min-w-0 text-text-dim">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                          <span className="truncate">{d.name}</span>
                        </span>
                        <span className="font-mono-num shrink-0">
                          {totalExpenses ? Math.round((d.value / totalExpenses) * 100) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-[13px] font-semibold mb-3">Fleet Account Balances (Receivables)</h3>
            {(fleetAccounts ?? []).length === 0 ? (
              <p className="text-[12px] text-text-faint">No fleet accounts on record.</p>
            ) : (
              <div className="space-y-2.5">
                {[...(fleetAccounts ?? [])]
                  .sort((a, b) => b.balanceKes - a.balanceKes)
                  .slice(0, 6)
                  .map((a) => (
                    <div key={a.accountId} className="flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-2 text-text-dim">
                        {a.name} <span className="text-text-faint">({a.accountId})</span>
                        {a.status === "Over Limit" && <StatusPill tone="danger" label="Over Limit" />}
                      </span>
                      <span className="font-mono-num font-medium">{kes(a.balanceKes)}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </>
      )}

      {tab === "By Station" && canSeeAllStations && (
        <div className="card">
          <PanelHeader title="Station Comparison (This Month)" />
          <div className="p-3 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStation ?? []} margin={{ left: -10, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="station" tick={{ fontSize: 9, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} tickFormatter={(v) => v.replace(" Service Station", "")} />
                <YAxis tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}K`} />
                <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }} formatter={(v) => kes(Number(v))} />
                <Bar dataKey="revenue" name="Revenue" fill="#17c964" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="#f9a826" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-text-faint uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Station</th>
                  <th className="px-4 py-2.5 font-medium text-right">Revenue</th>
                  <th className="px-4 py-2.5 font-medium text-right">Expenses</th>
                  <th className="px-4 py-2.5 font-medium text-right">Profit</th>
                  <th className="px-4 py-2.5 font-medium text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {(byStation ?? []).map((s) => (
                  <tr key={s.station} className="border-t border-border hover:bg-white/2">
                    <td className="px-4 py-2.5 font-medium">{s.station}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{kes(s.revenue)}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num text-text-dim">{kes(s.expenses)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono-num font-medium ${s.profit >= 0 ? "text-success" : "text-danger"}`}>
                      {kes(s.profit)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-num">
                      {s.revenue ? ((s.profit / s.revenue) * 100).toFixed(1) : "0.0"}%
                    </td>
                  </tr>
                ))}
                {(byStation ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-text-faint">
                      No station data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "Tax" && (
        <div className="card p-4 max-w-md">
          <h3 className="text-[13px] font-semibold mb-3">Tax Summary (Month to Date)</h3>
          <div className="space-y-2.5 text-[12.5px]">
            {[
              ["Tax Rate", "16%"],
              ["Taxable Sales (MTD)", kes(taxableSalesMtd)],
              ["VAT Collected (MTD)", kes(vatCollectedMtd)],
              ["Next Filing Due", nextFilingDate()],
            ].map(([l, v]) => (
              <div key={l} className="flex items-center justify-between">
                <span className="text-text-dim">{l}</span>
                <span className="font-mono-num font-medium">{v}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-text-faint mt-3">
            VAT collected is estimated as the 16% portion embedded in total taxable sales, consistent with the rate
            used elsewhere in the platform. This isn't a substitute for your actual filing calculation.
          </p>
        </div>
      )}
    </div>
  );
}