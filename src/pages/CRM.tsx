import { useMemo, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, UserCheck, UserPlus, MessageSquare, Percent, Heart, Plus, Search, Phone, Mail, Calendar as CalendarIcon } from "lucide-react";
import { INITIAL_CRM_CUSTOMERS, CRM_UPCOMING_FOLLOWUPS } from "../data/mock";
import { MetricCard, PageHeader, PanelHeader, StatusPill, type Tone } from "../components/ui/primitives";
import { kes } from "../lib/format";
import type { CrmCustomer, CustomerSegment } from "../types";
import { useApiData } from "../lib/useApiData";
import { exportToCsv } from "../lib/exportCsv";
import { api, ApiError } from "../lib/api";
import Modal, { FormField, inputClass, ModalActions } from "../components/ui/Modal";
import RowActions from "../components/ui/RowActions";

const TABS = ["Overview", "Customers", "Contacts", "Interactions", "Leads", "Deals", "Reminders"];

const SEGMENT_TONE: Record<CustomerSegment, Tone> = {
  VIP: "accent",
  Gold: "warning",
  Silver: "info",
  Bronze: "neutral",
};


const followUpIcon: Record<string, typeof Phone> = { Call: Phone, Email: Mail, Meeting: CalendarIcon };

interface FollowUp {
  name: string;
  type: string;
  date: string;
}

export default function CRM() {
  const [tab, setTab] = useState("Overview");
  const [query, setQuery] = useState("");
  const { data, refetch } = useApiData<CrmCustomer[]>("/crm/customers", INITIAL_CRM_CUSTOMERS);
  const customers = data ?? INITIAL_CRM_CUSTOMERS;
  const { data: followUpData } = useApiData<FollowUp[]>("/crm/followups", CRM_UPCOMING_FOLLOWUPS);
  const followUps = followUpData ?? CRM_UPCOMING_FOLLOWUPS;
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CrmCustomer | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleDelete(c: CrmCustomer) {
    if (!c.id) return;
    if (!confirm(`Delete customer "${c.name}"? This can't be undone.`)) return;
    setDeletingId(c.id);
    try {
      await api.del(`/crm/customers/${c.id}`);
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not delete the customer.");
    } finally {
      setDeletingId(null);
    }
  }

  const rows = useMemo(
    () =>
      customers.filter(
        (c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.company.toLowerCase().includes(query.toLowerCase())
      ),
    [customers, query]
  );

  const topBySpend = [...customers].sort((a, b) => b.totalSpentKes - a.totalSpentKes).slice(0, 5);

  const segments = [
    { name: "VIP", value: customers.filter((c) => c.segment === "VIP").length, color: "#f9a826" },
    { name: "Gold", value: customers.filter((c) => c.segment === "Gold").length, color: "#f5a524" },
    { name: "Silver", value: customers.filter((c) => c.segment === "Silver").length, color: "#38bdf8" },
    { name: "Bronze", value: customers.filter((c) => c.segment === "Bronze").length, color: "#8b98a5" },
  ];

  return (
    <div>
      <PageHeader
        title="CRM"
        subtitle="Customer Relationship Management"
        actions={
          <button
            onClick={() => setShowNewCustomer(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-bg text-[12px] font-medium"
          >
            <Plus size={13} /> New Customer
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
        <MetricCard icon={Users} tone="accent" label="Total Customers" value={customers.length.toLocaleString()} />
        <MetricCard icon={UserCheck} tone="success" label="Active Customers" value={String(customers.filter((c) => c.status === "Active").length)} />
        <MetricCard icon={UserPlus} tone="info" label="VIP Customers" value={String(customers.filter((c) => c.segment === "VIP").length)} />
        <MetricCard icon={MessageSquare} tone="warning" label="Total Lifetime Value" value={kes(customers.reduce((s, c) => s + c.totalSpentKes, 0))} />
        <MetricCard icon={Percent} tone="accent" label="Avg Spend / Customer" value={kes(customers.length ? customers.reduce((s, c) => s + c.totalSpentKes, 0) / customers.length : 0)} />
        <MetricCard icon={Heart} tone="success" label="Inactive Customers" value={String(customers.filter((c) => c.status === "Inactive").length)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-3 flex-wrap">
            <h3 className="text-[13.5px] font-semibold">Recent Customers</h3>
            <div className="flex items-center gap-1.5 bg-white/3 border border-border rounded-lg px-2.5 py-1.5">
              <Search size={13} className="text-text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search customers..."
                className="bg-transparent text-[12px] w-[160px] focus:outline-none"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-text-faint uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Contact</th>
                  <th className="px-4 py-2.5 font-medium">Segment</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Last Interaction</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total Spent</th>
                  <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.name} className="border-t border-border hover:bg-white/2">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-[#c97e14] grid place-items-center text-[10px] font-semibold text-bg shrink-0">
                          {c.name.split(" ").map((n) => n[0]).join("")}
                        </span>
                        <div>
                          <div className="font-medium">{c.name}</div>
                          <div className="text-[10.5px] text-text-faint">{c.company}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-text-dim">{c.contact}</td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone={SEGMENT_TONE[c.segment]} label={c.segment} />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone="success" label={c.status} />
                    </td>
                    <td className="px-4 py-2.5 text-text-faint whitespace-nowrap">{c.lastInteraction}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num font-medium">{kes(c.totalSpentKes)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <RowActions
                        onEdit={() => setEditingCustomer(c)}
                        onDelete={() => handleDelete(c)}
                        deleting={deletingId === c.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border text-[11.5px] text-text-faint">
            Showing {rows.length} of {customers.length} customers
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <PanelHeader title="Customer Segments" action="View All" />
            <div className="p-4 flex items-center gap-4">
              <div className="relative w-[110px] h-[110px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={segments} dataKey="value" innerRadius={36} outerRadius={52} paddingAngle={2} stroke="none">
                      {segments.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 grid place-items-center pointer-events-none">
                  <div className="text-center">
                    <div className="text-[13px] font-semibold font-mono-num">{customers.length}</div>
                    <div className="text-[9px] text-text-faint">Customers</div>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                {segments.map((d) => (
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
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-semibold">Interaction Summary</h3>
              <span className="text-[10.5px] text-text-faint">Last 7 Days</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                ["1,256", "Calls"],
                ["842", "Emails"],
                ["783", "SMS"],
                ["761", "Meetings"],
              ].map(([v, l]) => (
                <div key={l}>
                  <div className="text-[15px] font-semibold font-mono-num">{v}</div>
                  <div className="text-[10px] text-text-faint">{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <PanelHeader title="Top Customers by Spend" />
            <div className="pt-3 space-y-2">
              {topBySpend.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between text-[12px]">
                  <span>{i + 1}. {c.name}</span>
                  <span className="font-mono-num text-text-dim">{kes(c.totalSpentKes)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <PanelHeader title="Upcoming Follow-ups" />
            <div className="pt-3 space-y-2.5">
              {followUps.map((f) => {
                const Icon = followUpIcon[f.type];
                return (
                  <div key={f.name} className="flex items-center justify-between text-[12px]">
                    <div>
                      <div className="text-text-faint text-[10.5px]">{f.date}</div>
                      <div>{f.name}</div>
                    </div>
                    <Icon size={14} className="text-accent shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 mt-4">
        <button
          onClick={() => setShowNewCustomer(true)}
          className="px-3.5 py-2 rounded-lg border border-border text-[12px] text-text-dim hover:border-border-strong hover:text-text transition-colors"
        >
          New Customer
        </button>
        {["Log Interaction", "Create Lead", "Add Note"].map((a) => (
          <button
            key={a}
            onClick={() => alert(`${a} isn't built yet \u2014 New Customer and Export are live.`)}
            className="px-3.5 py-2 rounded-lg border border-border text-[12px] text-text-dim hover:border-border-strong hover:text-text transition-colors"
          >
            {a}
          </button>
        ))}
        <button
          onClick={() => exportToCsv("crm-customers", rows)}
          className="px-3.5 py-2 rounded-lg border border-border text-[12px] text-text-dim hover:border-border-strong hover:text-text transition-colors"
        >
          Export
        </button>
      </div>

      {showNewCustomer && (
        <NewCustomerModal
          onClose={() => setShowNewCustomer(false)}
          onCreated={() => {
            setShowNewCustomer(false);
            refetch();
          }}
        />
      )}

      {editingCustomer && (
        <NewCustomerModal
          editing={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onCreated={() => {
            setEditingCustomer(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function NewCustomerModal({
  editing,
  onClose,
  onCreated,
}: {
  editing?: CrmCustomer;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [company, setCompany] = useState(editing?.company ?? "");
  const [contact, setContact] = useState(editing?.contact ?? "");
  const [segment, setSegment] = useState<CustomerSegment>(editing?.segment ?? "Bronze");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (editing?.id) {
        await api.patch(`/crm/customers/${editing.id}`, { name, company, contact, segment });
      } else {
        await api.post("/crm/customers", { name, company, contact, segment });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the customer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={editing ? "Edit Customer" : "New Customer"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <FormField label="Name">
          <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Company">
          <input value={company} onChange={(e) => setCompany(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Contact (phone)">
          <input value={contact} onChange={(e) => setContact(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Segment">
          <select value={segment} onChange={(e) => setSegment(e.target.value as CustomerSegment)} className={inputClass}>
            <option value="Bronze">Bronze</option>
            <option value="Silver">Silver</option>
            <option value="Gold">Gold</option>
            <option value="VIP">VIP</option>
          </select>
        </FormField>
        <ModalActions onCancel={onClose} submitLabel={editing ? "Save Changes" : "Create Customer"} submitting={submitting} />
      </form>
    </Modal>
  );
}