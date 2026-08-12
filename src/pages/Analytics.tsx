import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from "recharts";
import { Banknote, Droplet, Receipt, TicketPercent, Download, Package, Users, Percent, Calendar } from "lucide-react";
import { MetricCard, PageHeader, PanelHeader, StatusPill } from "../components/ui/primitives";
import { kes, litres } from "../lib/format";
import { INITIAL_DELIVERIES, INITIAL_INVENTORY } from "../data/mock";
import { useApiData } from "../lib/useApiData";
import { exportToCsv } from "../lib/exportCsv";

const TABS = ["Overview", "Sales", "Fuel Performance", "Customers", "Operations", "Deliveries", "Inventory", "Financial"];


function Donut({
  title,
  action,
  total,
  totalLabel,
  data,
}: {
  title: string;
  action?: string;
  total: string;
  totalLabel: string;
  data: { name: string; value: number; color: string }[];
}) {
  return (
    <div className="card">
      <PanelHeader title={title} action={action} />
      <div className="p-4 flex items-center gap-4">
        <div className="relative w-[110px] h-[110px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={36} outerRadius={52} paddingAngle={2} stroke="none">
                {data.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="text-center">
              <div className="text-[13px] font-semibold font-mono-num">{total}</div>
              <div className="text-[9px] text-text-faint">{totalLabel}</div>
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          {data.map((d) => (
            <div key={d.name} className="flex items-center justify-between text-[11px] gap-2">
              <span className="flex items-center gap-1.5 min-w-0 text-text-dim">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                <span className="truncate">{d.name}</span>
              </span>
              <span className="font-mono-num shrink-0">{d.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const PRODUCT_COLORS: Record<string, string> = {
  Diesel: "#17c964",
  Petrol: "#38bdf8",
  Kerosene: "#f5a524",
  LPG: "#a78bfa",
};
const FUEL_LINE_COLORS = ["#17c964", "#38bdf8", "#f5a524", "#a78bfa", "#f31260"];
const PAYMENT_COLORS: Record<string, string> = {
  Cash: "#17c964",
  Card: "#38bdf8",
  "Mobile Money": "#f9a826",
  "Fleet Account": "#a78bfa",
};
const HEAT_HOURS = Array.from({ length: 24 }, (_, i) => i);
const HEAT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface OverviewData {
  range: { start: string; end: string; prevStart: string; prevEnd: string };
  summary: {
    current: { revenue: number; litres: number; transactions: number; avgTicket: number };
    previous: { revenue: number; litres: number; transactions: number; avgTicket: number };
    activeCustomers: number;
  };
  trend: { d: string; current: number; previous: number }[];
  byFuel: { name: string; value: number }[];
  heatmap: { day: string; hour: number; value: number }[];
  fuelTrend: Record<string, string | number>[];
  products: string[];
  topProducts: { name: string; value: number }[];
  byPaymentMethod: { name: string; value: number }[];
}

function pctChange(current: number, previous: number): number {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function DeltaBadge({ pct }: { pct: number }) {
  const positive = pct >= 0;
  return (
    <span className={`text-[10.5px] font-medium ${positive ? "text-success" : "text-danger"}`}>
      {positive ? "\u2191" : "\u2193"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function OverviewTab({ start, end }: { start: string; end: string }) {
  const { data } = useApiData<OverviewData>(`/analytics/overview?start=${start}&end=${end}`, undefined, [start, end]);
  const { data: topCustomersData } = useApiData<{ name: string; value: number }[]>("/analytics/top-customers", []);
  const topCustomers = topCustomersData ?? [];

  const cur = data?.summary.current ?? { revenue: 0, litres: 0, transactions: 0, avgTicket: 0 };
  const prev = data?.summary.previous ?? { revenue: 0, litres: 0, transactions: 0, avgTicket: 0 };
  const avgPricePerLitre = cur.litres ? cur.revenue / cur.litres : 0;
  const prevAvgPricePerLitre = prev.litres ? prev.revenue / prev.litres : 0;

  const byFuelColored = (data?.byFuel ?? []).map((f) => ({ ...f, color: PRODUCT_COLORS[f.name] ?? "#8b98a5" }));
  const byPaymentColored = (data?.byPaymentMethod ?? []).map((p) => ({ ...p, color: PAYMENT_COLORS[p.name] ?? "#8b98a5" }));
  const maxProductVolume = Math.max(1, ...(data?.topProducts ?? []).map((p) => p.value));

  // Real 24x7 grid: fill every cell with 0 by default, then overlay the
  // actual (day, hour) revenue buckets returned by the backend.
  const heatByCell = new Map((data?.heatmap ?? []).map((h) => [`${h.day}-${h.hour}`, h.value]));
  const maxHeat = Math.max(1, ...(data?.heatmap ?? []).map((h) => h.value));

  const revenueDelta = pctChange(cur.revenue, prev.revenue);
  const litresDelta = pctChange(cur.litres, prev.litres);
  const txnDelta = pctChange(cur.transactions, prev.transactions);
  const ticketDelta = pctChange(cur.avgTicket, prev.avgTicket);

  const insights: string[] = [];
  if (data) {
    insights.push(
      `Revenue ${revenueDelta >= 0 ? "increased" : "decreased"} by ${Math.abs(revenueDelta).toFixed(1)}% compared to the previous period.`
    );
    if (byFuelColored.length > 0) {
      const totalFuelVol = byFuelColored.reduce((s, f) => s + f.value, 0);
      const top = byFuelColored[0];
      insights.push(
        `${top.name} sales contributed ${totalFuelVol ? Math.round((top.value / totalFuelVol) * 100) : 0}% of total fuel volume.`
      );
    }
    insights.push(`Average ticket size ${ticketDelta >= 0 ? "improved" : "declined"} by ${Math.abs(ticketDelta).toFixed(1)}%.`);
    if (byPaymentColored.length > 0) {
      insights.push(`${byPaymentColored[0].name} is the leading payment method this period.`);
    }
  }

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-4">
        <MetricCard icon={Banknote} tone="accent" label="Total Revenue (KES)" value={kes(cur.revenue)} delta={{ value: `${Math.abs(revenueDelta).toFixed(1)}%`, positive: revenueDelta >= 0 }} />
        <MetricCard icon={Droplet} tone="info" label="Total Liters (L)" value={litres(cur.litres, 0)} delta={{ value: `${Math.abs(litresDelta).toFixed(1)}%`, positive: litresDelta >= 0 }} />
        <MetricCard icon={Receipt} tone="info" label="Total Transactions" value={String(cur.transactions)} delta={{ value: `${Math.abs(txnDelta).toFixed(1)}%`, positive: txnDelta >= 0 }} />
        <MetricCard icon={TicketPercent} tone="warning" label="Average Ticket (KES)" value={kes(cur.avgTicket)} delta={{ value: `${Math.abs(ticketDelta).toFixed(1)}%`, positive: ticketDelta >= 0 }} />
        <MetricCard icon={Users} tone="success" label="Active Customers" value={String(data?.summary.activeCustomers ?? 0)} />
        <MetricCard
          icon={Percent}
          tone="success"
          label="Avg Price / Litre"
          value={kes(avgPricePerLitre)}
          delta={{
            value: `${Math.abs(pctChange(avgPricePerLitre, prevAvgPricePerLitre)).toFixed(1)}%`,
            positive: pctChange(avgPricePerLitre, prevAvgPricePerLitre) >= 0,
          }}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="card">
          <PanelHeader title="Sales Over Time (KES)" />
          <div className="p-3 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.trend ?? []} margin={{ left: -10, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}K`} />
                <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }} formatter={(v) => kes(Number(v))} />
                <Line type="monotone" dataKey="current" name="This Period" stroke="#17c964" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="previous" name="Previous Period" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <Donut
          title="Sales by Fuel Type (L)"
          total={(data?.byFuel ?? []).reduce((s, f) => s + f.value, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          totalLabel="Total"
          data={byFuelColored}
        />

        <div className="card">
          <PanelHeader title="Sales by Time of Day" />
          <div className="p-3">
            <div className="grid grid-flow-col auto-cols-fr gap-0.5 mb-1">
              {HEAT_DAYS.map((day) => (
                <div key={day} className="flex flex-col gap-0.5">
                  {HEAT_HOURS.map((h) => {
                    const v = heatByCell.get(`${day}-${h}`) ?? 0;
                    const intensity = maxHeat ? v / maxHeat : 0;
                    return (
                      <div
                        key={h}
                        title={`${day} ${h}:00 \u2014 ${kes(v)}`}
                        className="h-1.5 rounded-[1px]"
                        style={{ background: v ? `rgba(23,201,100,${0.1 + intensity * 0.85})` : "var(--chart-grid)" }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] text-text-faint">
              {HEAT_DAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-text-faint">
              <span>Low</span>
              <div className="flex-1 h-1.5 rounded-full" style={{ background: "linear-gradient(90deg, rgba(23,201,100,0.1), rgba(23,201,100,0.95))" }} />
              <span>High</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <div className="card">
          <PanelHeader title="Sales by Fuel (Trend)" />
          <div className="p-3 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.fuelTrend ?? []} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 9, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}K`} />
                <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }} formatter={(v) => kes(Number(v))} />
                {(data?.products ?? []).map((p, i) => (
                  <Line key={p} type="monotone" dataKey={p} stroke={FUEL_LINE_COLORS[i % FUEL_LINE_COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <PanelHeader title="Top Products by Volume (L)" />
          <div className="p-4 space-y-2.5">
            {(data?.topProducts ?? []).map((p) => (
              <div key={p.name}>
                <div className="flex items-center justify-between text-[11.5px] mb-1">
                  <span className="text-text-dim">{p.name}</span>
                  <span className="font-mono-num">{p.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-success" style={{ width: `${(p.value / maxProductVolume) * 100}%` }} />
                </div>
              </div>
            ))}
            {(data?.topProducts ?? []).length === 0 && <p className="text-[12px] text-text-faint">No sales in this range.</p>}
          </div>
        </div>

        <Donut
          title="Revenue by Payment Method (KES)"
          total={kes((data?.byPaymentMethod ?? []).reduce((s, p) => s + p.value, 0))}
          totalLabel="Total"
          data={byPaymentColored}
        />

        <div className="card">
          <PanelHeader title="Top Customers by Spend (KES)" />
          <div className="p-4 space-y-3">
            {topCustomers.map((c, i) => (
              <div key={c.name} className="flex items-center justify-between text-[12.5px]">
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-white/5 grid place-items-center text-[10.5px] font-mono-num text-text-dim shrink-0">
                    {i + 1}
                  </span>
                  <span className="truncate">{c.name}</span>
                </span>
                <span className="font-mono-num font-medium shrink-0">{kes(c.value)}</span>
              </div>
            ))}
            {topCustomers.length === 0 && <p className="text-[12px] text-text-faint">No customer spend recorded yet.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card">
          <PanelHeader title="Performance Summary" />
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-text-faint uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Metric</th>
                  <th className="px-4 py-2.5 font-medium text-right">This Period</th>
                  <th className="px-4 py-2.5 font-medium text-right">Previous Period</th>
                  <th className="px-4 py-2.5 font-medium text-right">% Change</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { m: "Total Sales (KES)", c: kes(cur.revenue), p: kes(prev.revenue), delta: revenueDelta },
                  { m: "Total Liters (L)", c: litres(cur.litres, 0), p: litres(prev.litres, 0), delta: litresDelta },
                  { m: "Average Ticket (KES)", c: kes(cur.avgTicket), p: kes(prev.avgTicket), delta: ticketDelta },
                  { m: "Transactions", c: String(cur.transactions), p: String(prev.transactions), delta: txnDelta },
                ].map((row) => (
                  <tr key={row.m} className="border-t border-border hover:bg-white/2">
                    <td className="px-4 py-2.5 font-medium">{row.m}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{row.c}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num text-text-dim">{row.p}</td>
                    <td className="px-4 py-2.5 text-right">
                      <DeltaBadge pct={row.delta} />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone={row.delta >= 0 ? "success" : "danger"} label={row.delta >= 0 ? "On Track" : "Behind"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-[13px] font-semibold mb-3">Insights</h3>
          {insights.length === 0 ? (
            <p className="text-[12px] text-text-faint">Not enough data yet to generate insights.</p>
          ) : (
            <div className="space-y-3">
              {insights.map((text) => (
                <div key={text} className="flex items-start gap-2.5 text-[12px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 shrink-0" />
                  <span className="text-text-dim leading-snug">{text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

interface TopProductDetail {
  name: string;
  kes: number;
  litres: number;
}

function SalesTab({ start, end }: { start: string; end: string }) {
  const { data: byHour } = useApiData<{ h: string; v: number }[]>(`/analytics/sales-by-hour?start=${start}&end=${end}`, [], [start, end]);
  const { data: topProductsDetail } = useApiData<TopProductDetail[]>(`/analytics/top-products-detail?start=${start}&end=${end}`, [], [start, end]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 card">
        <PanelHeader title="Sales by Hour" />
        <div className="p-3 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byHour ?? []} margin={{ left: -10, right: 8, top: 8 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="h" tick={{ fontSize: 9, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}K`} />
              <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }} formatter={(v) => kes(Number(v))} />
              <Bar dataKey="v" fill="#17c964" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <PanelHeader title="Top Products" />
        <div className="p-4 space-y-3">
          {(topProductsDetail ?? []).map((p) => (
            <div key={p.name} className="flex items-center justify-between text-[12.5px]">
              <span>{p.name}</span>
              <div className="text-right">
                <div className="font-mono-num font-medium">{kes(p.kes)}</div>
                <div className="font-mono-num text-text-faint text-[10.5px]">{litres(p.litres, 0)}</div>
              </div>
            </div>
          ))}
          {(topProductsDetail ?? []).length === 0 && <p className="text-[12px] text-text-faint">No sales in this range.</p>}
        </div>
      </div>
    </div>
  );
}

function FuelPerformanceTab({ start, end }: { start: string; end: string }) {
  const { data: fuelData } = useApiData<{ trend: Record<string, string | number>[]; products: string[] }>(
    `/analytics/fuel-litres-trend?start=${start}&end=${end}`,
    { trend: [], products: [] },
    [start, end]
  );
  const { data: topPumps } = useApiData<{ name: string; litres: number }[]>(`/analytics/top-pumps?start=${start}&end=${end}`, [], [start, end]);
  const maxPumpLitres = Math.max(1, ...(topPumps ?? []).map((p) => p.litres));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 card">
        <PanelHeader title="Fuel Sold Over Time (L)" />
        <div className="p-3 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={fuelData?.trend ?? []} margin={{ left: -10, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="fuelFill0" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#17c964" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#17c964" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="d" tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }} formatter={(v) => litres(Number(v), 1)} />
              {(fuelData?.products ?? []).map((p, i) => (
                <Area
                  key={p}
                  type="monotone"
                  dataKey={p}
                  name={p}
                  stroke={FUEL_LINE_COLORS[i % FUEL_LINE_COLORS.length]}
                  strokeWidth={2}
                  fill={i === 0 ? "url(#fuelFill0)" : "transparent"}
                  fillOpacity={i === 0 ? 1 : 0}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <PanelHeader title="Top Performing Pumps (L)" />
        <div className="p-4 space-y-3">
          {(topPumps ?? []).map((p) => (
            <div key={p.name}>
              <div className="flex items-center justify-between text-[12px] mb-1">
                <span>{p.name}</span>
                <span className="font-mono-num text-text-dim">{litres(p.litres, 0)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(p.litres / maxPumpLitres) * 100}%` }} />
              </div>
            </div>
          ))}
          {(topPumps ?? []).length === 0 && <p className="text-[12px] text-text-faint">No sales in this range.</p>}
        </div>
      </div>
    </div>
  );
}

interface CrmCustomerRow {
  segment: "VIP" | "Gold" | "Silver" | "Bronze";
  totalSpentKes: number;
}

function CustomersTab() {
  const { data: customers } = useApiData<CrmCustomerRow[]>("/crm/customers", []);
  const list = customers ?? [];

  const SEGMENT_COLORS: Record<string, string> = { VIP: "#f9a826", Gold: "#f5a524", Silver: "#38bdf8", Bronze: "#8b98a5" };
  const segmentOrder: CrmCustomerRow["segment"][] = ["VIP", "Gold", "Silver", "Bronze"];

  const segments = segmentOrder.map((s) => ({
    name: s,
    value: list.filter((c) => c.segment === s).length,
    color: SEGMENT_COLORS[s],
  }));
  const spendBySegment = segmentOrder.map((s) => ({
    name: s,
    value: list.filter((c) => c.segment === s).reduce((sum, c) => sum + c.totalSpentKes, 0),
    color: SEGMENT_COLORS[s],
  }));
  const maxSpend = Math.max(1, ...spendBySegment.map((s) => s.value));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 card">
        <PanelHeader title="Total Spend by Segment (KES)" />
        <div className="p-4 space-y-3">
          {spendBySegment.map((s) => (
            <div key={s.name}>
              <div className="flex items-center justify-between text-[12.5px] mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span className="font-mono-num">{kes(s.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(s.value / maxSpend) * 100}%`, background: s.color }} />
              </div>
            </div>
          ))}
          <p className="text-[10.5px] text-text-faint pt-1">
            Customer records don't carry a join date, so this shows lifetime spend by segment rather than a
            new-customer trend over time.
          </p>
        </div>
      </div>
      <Donut title="Customer Segments" total={list.length.toLocaleString()} totalLabel="Customers" data={segments} />
    </div>
  );
}

interface OperationsData {
  activeHoursByPump: { name: string; hours: number }[];
  kpis: {
    controllersOnline: string;
    avgControllerUptimeDays: number;
    pumpsOperational: string;
    nozzlesActive: string;
  };
}

function OperationsTab({ start, end }: { start: string; end: string }) {
  const { data } = useApiData<OperationsData>(`/analytics/operations?start=${start}&end=${end}`, undefined, [start, end]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 card">
        <PanelHeader title="Active Hours by Pump (This Period)" />
        <div className="p-3 h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.activeHoursByPump ?? []} margin={{ left: -10, right: 8, top: 8 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} unit="h" />
              <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="hours" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card p-4">
        <PanelHeader title="Operational KPIs" />
        <div className="pt-3 space-y-2.5 text-[12.5px]">
          {[
            ["Controllers Online", data?.kpis.controllersOnline ?? "\u2014"],
            ["Avg Controller Uptime", data ? `${data.kpis.avgControllerUptimeDays} days` : "\u2014"],
            ["Pumps Operational", data?.kpis.pumpsOperational ?? "\u2014"],
            ["Nozzles Active", data?.kpis.nozzlesActive ?? "\u2014"],
          ].map(([l, v]) => (
            <div key={l} className="flex items-center justify-between">
              <span className="text-text-dim">{l}</span>
              <span className="font-mono-num font-medium">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface DeliveryRow {
  supplier: string;
  quantityL: number;
  costKes: number;
  status: string;
}

function DeliveriesTab() {
  const { data } = useApiData<DeliveryRow[]>("/deliveries", INITIAL_DELIVERIES);
  const deliveries = data ?? INITIAL_DELIVERIES;

  const bySupplier = useMemo(() => {
    const map = new Map<string, number>();
    deliveries.forEach((d) => map.set(d.supplier, (map.get(d.supplier) ?? 0) + d.quantityL));
    return Array.from(map, ([name, v]) => ({ name, v }));
  }, [deliveries]);

  const received = deliveries.filter((d) => d.status === "Received").length;
  const totalCost = deliveries.reduce((s, d) => s + d.costKes, 0);
  const totalVolume = deliveries.reduce((s, d) => s + d.quantityL, 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 card">
        <PanelHeader title="Quantity by Supplier (L)" />
        <div className="p-3 h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bySupplier} margin={{ left: -10, right: 8, top: 8 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }} formatter={(v) => litres(Number(v), 0)} />
              <Bar dataKey="v" fill="#f9a826" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card p-4">
        <PanelHeader title="Delivery KPIs" />
        <div className="pt-3 space-y-2.5 text-[12.5px]">
          {[
            ["Total Deliveries", String(deliveries.length)],
            ["Received", String(received)],
            ["Total Volume", litres(totalVolume, 0)],
            ["Total Cost", kes(totalCost)],
          ].map(([l, v]) => (
            <div key={l} className="flex items-center justify-between">
              <span className="text-text-dim">{l}</span>
              <span className="font-mono-num font-medium">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface InventoryItemRow {
  category: string;
  valueKes: number;
  quantity: number;
  name: string;
  status: string;
}

function InventoryTab() {
  const { data } = useApiData<InventoryItemRow[]>("/inventory", INITIAL_INVENTORY);
  const items = data ?? INITIAL_INVENTORY;

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((i) => map.set(i.category, (map.get(i.category) ?? 0) + i.valueKes));
    const colors: Record<string, string> = { Fuel: "#17c964", Lubricants: "#38bdf8", "Other Products": "#a78bfa" };
    return Array.from(map, ([name, value]) => ({ name, value, color: colors[name] ?? "#8b98a5" }));
  }, [items]);

  const totalValue = items.reduce((s, i) => s + i.valueKes, 0);
  const lowStock = items.filter((i) => i.status === "Low Stock" || i.status === "Out of Stock");

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <Donut title="Stock Value by Category (KES)" total={kes(totalValue)} totalLabel="Total" data={byCategory} />
      <div className="xl:col-span-2 card">
        <PanelHeader title="Low Stock Items" />
        <div className="p-4 space-y-3">
          {lowStock.length === 0 && <p className="text-[12px] text-text-faint">Nothing is low on stock right now.</p>}
          {lowStock.map((i) => (
            <div key={i.name} className="flex items-center justify-between text-[12.5px]">
              <span className="flex items-center gap-2">
                <Package size={14} className="text-warning" />
                {i.name}
              </span>
              <span className="font-mono-num font-medium text-warning">{i.quantity}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface FinanceTrendRow {
  d: string;
  revenue: number;
  expenses: number;
}

function FinancialTab({ start, end }: { start: string; end: string }) {
  const { data: summary } = useApiData<{ revenue: number; expenses: number }>("/finance/summary");
  const { data: trend } = useApiData<FinanceTrendRow[]>("/finance/trend");
  void start;
  void end;

  const revenue = summary?.revenue ?? 0;
  const expenses = summary?.expenses ?? 0;
  const profit = revenue - expenses;
  const margin = revenue ? (profit / revenue) * 100 : 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 card">
        <PanelHeader title="Revenue vs Expenses (KES)" />
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
      <div className="card p-4">
        <PanelHeader title="Margin Summary (This Month)" />
        <div className="pt-3 space-y-2.5 text-[12.5px]">
          {[
            ["Gross Revenue", kes(revenue)],
            ["Total Expenses", kes(expenses)],
            ["Gross Profit", kes(profit)],
            ["Gross Margin", `${margin.toFixed(1)}%`],
          ].map(([l, v]) => (
            <div key={l} className="flex items-center justify-between">
              <span className="text-text-dim">{l}</span>
              <span className="font-mono-num font-medium">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function defaultRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 6 * 86400_000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default function Analytics() {
  const [tab, setTab] = useState("Overview");
  const [{ start, end }, setRange] = useState(defaultRange());
  const { data: overviewForExport } = useApiData<{ topProducts: { name: string; value: number }[] }>(
    `/analytics/overview?start=${start}&end=${end}`,
    undefined,
    [start, end]
  );

  function renderTab() {
    switch (tab) {
      case "Overview":
        return <OverviewTab start={start} end={end} />;
      case "Sales":
        return <SalesTab start={start} end={end} />;
      case "Fuel Performance":
        return <FuelPerformanceTab start={start} end={end} />;
      case "Customers":
        return <CustomersTab />;
      case "Operations":
        return <OperationsTab start={start} end={end} />;
      case "Deliveries":
        return <DeliveriesTab />;
      case "Inventory":
        return <InventoryTab />;
      case "Financial":
        return <FinancialTab start={start} end={end} />;
      default:
        return null;
    }
  }

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Data insights for smarter decisions"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-[12px] text-text-dim">
              <Calendar size={13} className="text-text-faint" />
              <input
                type="date"
                value={start}
                max={end}
                onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
                className="bg-transparent focus:outline-none"
              />
              <span className="text-text-faint">to</span>
              <input
                type="date"
                value={end}
                min={start}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
                className="bg-transparent focus:outline-none"
              />
            </label>
            <button
              onClick={() => exportToCsv("analytics-top-products", overviewForExport?.topProducts ?? [])}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-bg text-[12px] font-medium"
            >
              <Download size={13} /> Export
            </button>
          </div>
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

      {renderTab()}
    </div>
  );
}