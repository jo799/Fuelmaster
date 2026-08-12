import { useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { Banknote, Droplet, Truck, Users, Receipt, TrendingUp, Download, FileText, FileSpreadsheet, Search } from "lucide-react";
import { INITIAL_REPORTS } from "../data/mock";
import { MetricCard, PageHeader, PanelHeader, StatusPill } from "../components/ui/primitives";
import { kes, litres } from "../lib/format";
import { useApiData } from "../lib/useApiData";

const TABS = ["Overview", "Sales", "Fuel", "Inventory", "Deliveries", "Operations", "Financial", "Custom"];

const salesTrend = [
  { d: "Jul 11", v: 380000 }, { d: "Jul 12", v: 410000 }, { d: "Jul 13", v: 355000 },
  { d: "Jul 14", v: 470000 }, { d: "Jul 15", v: 505000 }, { d: "Jul 16", v: 520000 }, { d: "Jul 17", v: 482600 },
];

const fuelSplit = [
  { name: "Diesel (ENS90)", value: 7850, color: "#17c964" },
  { name: "Petrol (PMS95)", value: 6120, color: "#f9a826" },
  { name: "Kerosene", value: 3570, color: "#a78bfa" },
  { name: "Others", value: 1000, color: "#38bdf8" },
];

const byStation = [
  { name: "Kariakoo", v: 720000 }, { name: "Mbagala", v: 480000 }, { name: "Temeke", v: 390000 },
  { name: "Kisutu", v: 310000 }, { name: "Upanga", v: 210000 },
];

export default function Reports() {
  const [tab, setTab] = useState("Overview");
  const [query, setQuery] = useState("");
  const { data: salesSummary } = useApiData<{ totalKes: number; totalLitres: number; transactions: number }>(
    "/sales/summary"
  );
  const { data: deliveries } = useApiData<unknown[]>("/deliveries", []);
  const { data: customers } = useApiData<unknown[]>("/crm/customers", []);
  const { data: financeSummary } = useApiData<{ revenue: number; expenses: number }>("/finance/summary");

  const rows = useMemo(
    () => INITIAL_REPORTS.filter((r) => r.name.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Insights that drive better decisions"
        status={{ tone: "success", label: "Live" }}
        actions={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--color-accent)] text-[#081018] text-[12px] font-medium">
            <Download size={13} /> Export Report
          </button>
        }
      />

      <div className="flex items-center gap-1 mb-4 border-b border-[var(--color-border)] overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3.5 py-2 text-[12.5px] whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-[var(--color-accent)] text-[var(--color-accent)] font-medium"
                : "border-transparent text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-4">
        <MetricCard icon={Banknote} tone="accent" label="Total Sales" value={kes(salesSummary?.totalKes ?? 0)} />
        <MetricCard icon={Droplet} tone="info" label="Total Fuel" value={litres(salesSummary?.totalLitres ?? 0, 0)} />
        <MetricCard icon={Truck} tone="warning" label="Total Deliveries" value={String((deliveries ?? []).length)} />
        <MetricCard icon={Users} tone="success" label="Total Customers" value={String((customers ?? []).length)} />
        <MetricCard icon={Receipt} tone="info" label="Total Transactions" value={String(salesSummary?.transactions ?? 0)} />
        <MetricCard
          icon={TrendingUp}
          tone="success"
          label="Net Profit"
          value={kes((financeSummary?.revenue ?? 0) - (financeSummary?.expenses ?? 0))}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="card">
          <PanelHeader title="Sales Over Time (KES)" />
          <div className="p-3 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesTrend} margin={{ left: -10, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}K`} />
                <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }} formatter={(v) => kes(Number(v))} />
                <Line type="monotone" dataKey="v" stroke="#17c964" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <PanelHeader title="Fuel Sales by Type (L)" />
          <div className="p-4 flex items-center gap-4">
            <div className="relative w-[110px] h-[110px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={fuelSplit} dataKey="value" innerRadius={36} outerRadius={52} paddingAngle={2} stroke="none">
                    {fuelSplit.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center">
                  <div className="text-[13px] font-semibold font-mono-num">18,540</div>
                  <div className="text-[9px] text-[var(--color-text-faint)]">Total</div>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {fuelSplit.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-[11px] gap-2">
                  <span className="flex items-center gap-1.5 min-w-0 text-[var(--color-text-dim)]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="truncate">{d.name}</span>
                  </span>
                  <span className="font-mono-num shrink-0">{d.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <PanelHeader title="Sales by Station (KES)" action="View All" />
          <div className="p-3 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStation} margin={{ left: -10, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}K`} />
                <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }} formatter={(v) => kes(Number(v))} />
                <Bar dataKey="v" fill="#17c964" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] gap-3 flex-wrap">
            <h3 className="text-[13.5px] font-semibold">Reports List</h3>
            <div className="flex items-center gap-1.5 bg-white/[0.03] border border-[var(--color-border)] rounded-[8px] px-2.5 py-1.5">
              <Search size={13} className="text-[var(--color-text-faint)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search reports..."
                className="bg-transparent text-[12px] w-[160px] focus:outline-none"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-[var(--color-text-faint)] uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Report Name</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Generated On</th>
                  <th className="px-4 py-2.5 font-medium">Format</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-t border-[var(--color-border)] hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 font-medium">{r.name}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-dim)]">{r.category}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-faint)] whitespace-nowrap">{r.generatedOn}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 text-[var(--color-text-dim)]">
                        {r.format === "PDF" ? <FileText size={13} /> : <FileSpreadsheet size={13} />}
                        {r.format}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill
                        tone={r.status === "Completed" ? "success" : r.status === "Processing" ? "warning" : "danger"}
                        label={r.status}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button className="text-[var(--color-text-dim)] hover:text-[var(--color-accent)]">
                        <Download size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-[13px] font-semibold mb-3">Report Insights</h3>
          <div className="space-y-3 text-[12px]">
            {[
              { l: "Top Sales Day", v: kes(482600) },
              { l: "Highest Fuel Volume", v: litres(2980, 0) },
              { l: "Most Deliveries", v: "4 Deliveries" },
              { l: "Highest Profit Day", v: kes(126450) },
            ].map((r) => (
              <div key={r.l} className="flex items-center justify-between">
                <span className="text-[var(--color-text-dim)]">{r.l}</span>
                <span className="font-mono-num font-medium">{r.v}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-[var(--color-danger)]">
              <span>Low Inventory Alert</span>
              <span className="font-mono-num font-medium">12% Remaining</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}