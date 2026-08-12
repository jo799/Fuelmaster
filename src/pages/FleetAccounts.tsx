import { useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Building2, ShieldCheck, Banknote, Droplet, AlertTriangle, TriangleAlert, Plus, Eye, List, Download } from "lucide-react";
import { INITIAL_FLEET_ACCOUNTS, FLEET_OVER_LIMIT, FLEET_BALANCE_TREND } from "../data/mock";
import { MetricCard, PageHeader, PanelHeader, StatusPill, type Tone } from "../components/ui/primitives";
import { kes, litres } from "../lib/format";
import type { FleetAccountRow, FleetAccountStatus } from "../types";
import { useApiData } from "../lib/useApiData";
import { exportToCsv } from "../lib/exportCsv";
import { api, ApiError } from "../lib/api";
import Modal, { FormField, inputClass, ModalActions } from "../components/ui/Modal";
import RowActions from "../components/ui/RowActions";

const STATUS_TONE: Record<FleetAccountStatus, Tone> = {
  Active: "success",
  "Over Limit": "danger",
  Inactive: "neutral",
};

export default function FleetAccounts() {
  const [query, setQuery] = useState("");
  const { data, refetch } = useApiData<FleetAccountRow[]>("/fleet-accounts", INITIAL_FLEET_ACCOUNTS);
  const accounts = data ?? INITIAL_FLEET_ACCOUNTS;
  const [showAdd, setShowAdd] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FleetAccountRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(a: FleetAccountRow) {
    if (!confirm(`Delete fleet account "${a.name}"? This can't be undone.`)) return;
    setDeletingId(a.accountId);
    try {
      await api.del(`/fleet-accounts/${a.accountId}`);
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not delete the account.");
    } finally {
      setDeletingId(null);
    }
  }

  const rows = accounts.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()));

  const overview = [
    { name: "Active", value: accounts.filter((a) => a.status === "Active").length, color: "#17c964" },
    { name: "Inactive", value: accounts.filter((a) => a.status === "Inactive").length, color: "#f5a524" },
    { name: "Over Limit", value: accounts.filter((a) => a.status === "Over Limit").length, color: "#f31260" },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-full">
      <div className="flex-1 min-w-0">
        <PageHeader
          title="Fleet Accounts"
          status={{ tone: "success", label: "All Fleet Accounts" }}
          actions={
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-bg text-[12px] font-medium"
            >
              <Plus size={13} /> Add Fleet Account
            </button>
          }
        />

        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-4">
          <MetricCard icon={Building2} tone="accent" label="Total Fleet Accounts" value="48" sub="All Accounts" />
          <MetricCard icon={ShieldCheck} tone="success" label="Active Accounts" value="36" sub="75%" />
          <MetricCard icon={Banknote} tone="info" label="Total Fuel Value" value={kes(2456780)} sub="This Month" />
          <MetricCard icon={Droplet} tone="info" label="Total Volume" value={litres(18540, 0)} sub="This Month" />
          <MetricCard icon={AlertTriangle} tone="danger" label="Outstanding Balance" value={kes(645230)} sub="Across Accounts" />
          <MetricCard icon={TriangleAlert} tone="danger" label="Accounts Over Limit" value="7" sub="Alerts" />
        </div>

        <div className="card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-3 flex-wrap">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search accounts..."
              className="bg-white/3 border border-border rounded-lg px-3 py-1.5 text-[12px] w-[220px] focus:outline-none focus:border-accent"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-text-faint uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Account Name</th>
                  <th className="px-4 py-2.5 font-medium">Account ID</th>
                  <th className="px-4 py-2.5 font-medium">Group</th>
                  <th className="px-4 py-2.5 font-medium">Contact Person</th>
                  <th className="px-4 py-2.5 font-medium text-right">Vehicles</th>
                  <th className="px-4 py-2.5 font-medium text-right">Credit Limit</th>
                  <th className="px-4 py-2.5 font-medium text-right">Balance</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.accountId} className="border-t border-border hover:bg-white/2">
                    <td className="px-4 py-2.5 font-medium">{a.name}</td>
                    <td className="px-4 py-2.5 font-mono-num text-accent">{a.accountId}</td>
                    <td className="px-4 py-2.5 text-text-dim">{a.group}</td>
                    <td className="px-4 py-2.5 text-text-dim">{a.contact}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{a.vehicles}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{kes(a.creditLimitKes)}</td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono-num font-medium ${
                        a.status === "Over Limit" ? "text-danger" : ""
                      }`}
                    >
                      {kes(a.balanceKes)}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone={STATUS_TONE[a.status]} label={a.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <RowActions
                        onEdit={() => setEditingAccount(a)}
                        onDelete={() => handleDelete(a)}
                        deleting={deletingId === a.accountId}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border text-[11.5px] text-text-faint">
            Showing {rows.length} of 48 accounts
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 mt-4">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-success-soft text-success text-[12px] font-medium"
          >
            <Plus size={13} /> Quick Account
          </button>
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-[12px] text-text-dim">
            <Eye size={13} /> View All Accounts
          </button>
          <button
            onClick={() => exportToCsv("fleet-accounts", rows)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-[12px] text-text-dim"
          >
            <Download size={13} /> Export Report
          </button>
        </div>
      </div>

      <div className="w-full lg:w-[300px] lg:shrink-0 space-y-4 lg:overflow-y-auto lg:pr-1">
        <div className="card">
          <PanelHeader title="Account Overview" action="View All" />
          <div className="p-4 flex items-center gap-4">
            <div className="relative w-[110px] h-[110px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={overview} dataKey="value" innerRadius={36} outerRadius={52} paddingAngle={2} stroke="none">
                    {overview.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center">
                  <div className="text-[13px] font-semibold font-mono-num">48</div>
                  <div className="text-[9px] text-text-faint">Accounts</div>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {overview.map((d) => (
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
          <PanelHeader title="Outstanding Balance" action="View All" />
          <div className="px-4 pt-3">
            <div className="text-[20px] font-bold font-mono-num text-danger">{kes(645230)}</div>
            <div className="text-[10.5px] text-text-faint">Across all accounts</div>
          </div>
          <div className="px-2 h-[100px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={FLEET_BALANCE_TREND} margin={{ left: -10, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="fleetBalFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f31260" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f31260" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 9, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }} formatter={(v) => kes(Number(v))} />
                <Area type="monotone" dataKey="v" stroke="#f31260" strokeWidth={2} fill="url(#fleetBalFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4">
          <PanelHeader title="Top Over Limit Accounts" />
          <div className="pt-3 space-y-2">
            {FLEET_OVER_LIMIT.map((a) => (
              <div key={a.name} className="flex items-center justify-between text-[12px]">
                <span className="text-text-dim">{a.name}</span>
                <span className="font-mono-num text-danger font-medium">{kes(a.balanceKes)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <PanelHeader title="Recent Activity" />
          <div className="pt-3 space-y-2.5 text-[12px]">
            {[
              "Balance updated - Soko Express Ltd",
              "New fuel purchase - Pamoja Delivery Services",
              "Credit limit updated - Kariakoo Logistics Ltd",
              "Payment received - City Courier Ltd",
              "Fleet account created - Mwanga Transport",
            ].map((m) => (
              <div key={m} className="flex items-start gap-2">
                <List size={13} className="text-text-faint mt-0.5 shrink-0" />
                <span className="text-text-dim">{m}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAdd && (
        <AddFleetAccountModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            refetch();
          }}
        />
      )}

      {editingAccount && (
        <AddFleetAccountModal
          editing={editingAccount}
          onClose={() => setEditingAccount(null)}
          onCreated={() => {
            setEditingAccount(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function AddFleetAccountModal({
  editing,
  onClose,
  onCreated,
}: {
  editing?: FleetAccountRow;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [group, setGroup] = useState(editing?.group ?? "");
  const [contact, setContact] = useState(editing?.contact ?? "");
  const [vehicles, setVehicles] = useState(editing?.vehicles ?? 1);
  const [creditLimitKes, setCreditLimitKes] = useState(editing?.creditLimitKes ?? 100000);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (editing) {
        await api.patch(`/fleet-accounts/${editing.accountId}`, { name, group, contact, vehicles, creditLimitKes });
      } else {
        await api.post("/fleet-accounts", { name, group, contact, vehicles, creditLimitKes });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the fleet account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={editing ? "Edit Fleet Account" : "Add Fleet Account"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <FormField label="Account Name">
          <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Group">
          <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="e.g. Logistics, Transport" className={inputClass} />
        </FormField>
        <FormField label="Contact Person">
          <input value={contact} onChange={(e) => setContact(e.target.value)} className={inputClass} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Vehicles">
            <input
              type="number"
              min={0}
              value={vehicles}
              onChange={(e) => setVehicles(Number(e.target.value))}
              className={inputClass}
            />
          </FormField>
          <FormField label="Credit Limit (KES)">
            <input
              type="number"
              min={0}
              value={creditLimitKes}
              onChange={(e) => setCreditLimitKes(Number(e.target.value))}
              className={inputClass}
            />
          </FormField>
        </div>
        <ModalActions onCancel={onClose} submitLabel={editing ? "Save Changes" : "Create Account"} submitting={submitting} />
      </form>
    </Modal>
  );
}