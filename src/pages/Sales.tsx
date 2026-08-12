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
} from "recharts";
import { Banknote, Droplet, Receipt, TrendingUp, PiggyBank, Wallet, Download, Filter } from "lucide-react";
import { MetricCard, PageHeader, PanelHeader, StatusPill } from "../components/ui/primitives";
import { kes, litres } from "../lib/format";
import type { SaleStatus } from "../types";
import { useApiData } from "../lib/useApiData";
import { exportToCsv } from "../lib/exportCsv";

interface SaleRow {
  receipt: string;
  time: string;
  pump: string;
  nozzle: number;
  cashier: string;
  customer: string;
  product: string;
  litres: number;
  amountKes: number;
  payment: string;
  status: SaleStatus;
}

interface SalesSummary {
  totalKes: number;
  totalLitres: number;
  transactions: number;
  avgSale: number;
}

const STATUS_TONE: Record<SaleStatus, "success" | "warning" | "danger"> = {
  completed: "success",
  voided: "danger",
  refunded: "warning",
};

function DonutCard({
  title,
  total,
  totalLabel,
  data,
}: {
  title: string;
  total: string;
  totalLabel: string;
  data: { name: string; value: number; color: string }[];
}) {
  if (data.length === 0) {
    return (
      <div className="card">
        <PanelHeader title={title} />
        <div className="p-6 text-center text-[12px] text-text-faint">No data yet today.</div>
      </div>
    );
  }
  return (
    <div className="card">
      <PanelHeader title={title} />
      <div className="p-4 flex items-center gap-4">
        <div className="relative w-[110px] h-[110px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={36}
                outerRadius={52}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 grid place-items-center text-center pointer-events-none">
            <div>
              <div className="text-[13px] font-semibold font-mono-num">{total}</div>
              <div className="text-[9px] text-text-faint">{totalLabel}</div>
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          {data.map((d) => (
            <div key={d.name} className="flex items-center justify-between text-[11.5px] gap-2">
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

const PRODUCT_COLORS: Record<string, string> = { Petrol: "#f9a826", Diesel: "#38bdf8", Kerosene: "#a78bfa", LPG: "#17c964" };
const PAYMENT_COLORS: Record<string, string> = { Cash: "#17c964", Card: "#38bdf8", "Mobile Money": "#f9a826", "Fleet Account": "#a78bfa" };

export default function Sales() {
  const [query, setQuery] = useState("");

  const { data: sales } = useApiData<SaleRow[]>("/sales/transactions?limit=100", []);
  const { data: summary } = useApiData<SalesSummary>("/sales/summary");
  const { data: trend } = useApiData<{ d: string; v: number }[]>("/reports/sales-trend", []);
  const { data: fuelSplit } = useApiData<{ name: string; value: number }[]>("/reports/fuel-split", []);
  const { data: paymentSplit } = useApiData<{ name: string; value: number }[]>("/sales/payment-split", []);

  const rows = useMemo(
    () =>
      (sales ?? []).filter(
        (r) => r.customer.toLowerCase().includes(query.toLowerCase()) || r.receipt.includes(query)
      ),
    [sales, query]
  );

  const totalKes = summary?.totalKes ?? 0;
  const totalLitres = summary?.totalLitres ?? 0;
  const transactions = summary?.transactions ?? 0;

  const productData = (fuelSplit ?? []).map((d) => ({ ...d, color: PRODUCT_COLORS[d.name] ?? "#8b98a5" }));
  const paymentData = (paymentSplit ?? []).map((d) => ({ ...d, color: PAYMENT_COLORS[d.name] ?? "#8b98a5" }));

  return (
    <div>
      <PageHeader
        title="Sales"
        subtitle="Monitor and manage all fuel sales in real-time"
        status={{ tone: "success", label: "Live" }}
        actions={
          <>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] text-text-dim hover:border-border-strong">
              <Filter size={13} /> Filters
            </button>
            <button
              onClick={() => exportToCsv("sales-transactions", rows)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-bg text-[12px] font-medium"
            >
              <Download size={13} /> Export
            </button>
          </>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-4">
        <MetricCard icon={Banknote} tone="accent" label="Total Sales" value={kes(totalKes)} />
        <MetricCard icon={Droplet} tone="info" label="Fuel Sold" value={litres(totalLitres, 0)} />
        <MetricCard icon={Receipt} tone="info" label="Transactions" value={String(transactions)} />
        <MetricCard icon={TrendingUp} tone="success" label="Revenue (excl. VAT)" value={kes(totalKes / 1.16)} />
        <MetricCard icon={PiggyBank} tone="success" label="Avg Price / Litre" value={totalLitres ? kes(totalKes / totalLitres) : kes(0)} />
        <MetricCard icon={Wallet} tone="warning" label="Avg Sale Amount" value={kes(summary?.avgSale ?? 0)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="card xl:col-span-1">
          <PanelHeader title="Sales Over Time (7 Days)" />
          <div className="p-3 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend ?? []} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: "#8b98a5" }}
                  formatter={(v) => kes(Number(v))}
                />
                <Line type="monotone" dataKey="v" name="Sales" stroke="#17c964" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <DonutCard title="Sales by Product (Litres, 7d)" total={litres(totalLitres, 0)} totalLabel="Total" data={productData} />
        <DonutCard title="Payment Methods (Today)" total={String(transactions)} totalLabel="Transactions" data={paymentData} />
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-3 flex-wrap">
          <h3 className="text-[13.5px] font-semibold">Sales Transactions</h3>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search receipt or customer..."
            className="bg-white/3 border border-border rounded-lg px-3 py-1.5 text-[12px] w-[220px] focus:outline-none focus:border-accent"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[11px] text-text-faint uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Receipt</th>
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium">Pump</th>
                <th className="px-4 py-2.5 font-medium">Cashier</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 font-medium text-right">Litres</th>
                <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                <th className="px-4 py-2.5 font-medium">Payment</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.receipt} className="border-t border-border hover:bg-white/2">
                  <td className="px-4 py-2.5 font-mono-num text-accent">{r.receipt}</td>
                  <td className="px-4 py-2.5 font-mono-num text-text-dim">{r.time}</td>
                  <td className="px-4 py-2.5">
                    {r.pump}
                    <span className="text-text-faint"> / N{r.nozzle}</span>
                  </td>
                  <td className="px-4 py-2.5 text-text-dim">{r.cashier}</td>
                  <td className="px-4 py-2.5">{r.customer}</td>
                  <td className="px-4 py-2.5 text-text-dim">{r.product}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num">{litres(r.litres)}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num font-medium">{kes(r.amountKes)}</td>
                  <td className="px-4 py-2.5 text-text-dim">{r.payment}</td>
                  <td className="px-4 py-2.5">
                    <StatusPill tone={STATUS_TONE[r.status]} label={r.status[0].toUpperCase() + r.status.slice(1)} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-text-faint">
                    {sales ? `No transactions match "${query}".` : "Loading..."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border text-[11.5px] text-text-faint">
          Showing {rows.length} of {transactions} entries
        </div>
      </div>
    </div>
  );
}