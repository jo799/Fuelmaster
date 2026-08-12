import { useMemo, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, UserCheck, Star, Gift, Percent, Trophy, Plus, Award, Sliders, Download } from "lucide-react";
import { INITIAL_LOYALTY_MEMBERS } from "../data/mock";
import { MetricCard, PageHeader, PanelHeader, StatusPill, type Tone } from "../components/ui/primitives";
import { kes } from "../lib/format";
import type { LoyaltyMember, LoyaltyTier } from "../types";
import { useApiData } from "../lib/useApiData";
import { exportToCsv } from "../lib/exportCsv";
import { api, ApiError } from "../lib/api";
import Modal, { FormField, inputClass, ModalActions } from "../components/ui/Modal";
import RowActions from "../components/ui/RowActions";

const TIER_TONE: Record<LoyaltyTier, Tone> = {
  Gold: "warning",
  Silver: "info",
  Bronze: "neutral",
};

interface ActivityRow {
  member: string;
  message: string;
  points: number;
  createdAt: string;
}

export default function Loyalty() {
  const [query, setQuery] = useState("");
  const { data, refetch } = useApiData<LoyaltyMember[]>("/loyalty/members", INITIAL_LOYALTY_MEMBERS);
  const members = data ?? INITIAL_LOYALTY_MEMBERS;
  const { data: activityData } = useApiData<ActivityRow[]>("/loyalty/activity", []);
  const [showAdd, setShowAdd] = useState(false);
  const [editingMember, setEditingMember] = useState<LoyaltyMember | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(m: LoyaltyMember) {
    if (!confirm(`Delete loyalty member "${m.name}"? This can't be undone.`)) return;
    setDeletingId(m.id);
    try {
      await api.del(`/loyalty/members/${m.id}`);
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not delete the member.");
    } finally {
      setDeletingId(null);
    }
  }

  const rows = useMemo(
    () => members.filter((m) => m.name.toLowerCase().includes(query.toLowerCase())),
    [members, query]
  );

  const topMembers = useMemo(
    () => [...members].sort((a, b) => b.lifetimePoints - a.lifetimePoints).slice(0, 3),
    [members]
  );

  const overview = [
    { name: "Gold", value: members.filter((m) => m.tier === "Gold").length, color: "#f5a524" },
    { name: "Silver", value: members.filter((m) => m.tier === "Silver").length, color: "#38bdf8" },
    { name: "Bronze", value: members.filter((m) => m.tier === "Bronze").length, color: "#8b98a5" },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-full">
      <div className="flex-1 min-w-0">
        <PageHeader
          title="Loyalty"
          status={{ tone: "success", label: "All Loyalty Programs" }}
          actions={
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-bg text-[12px] font-medium"
            >
              <Plus size={13} /> Add Member
            </button>
          }
        />

        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-4">
          <MetricCard icon={Users} tone="accent" label="Total Members" value={members.length.toLocaleString()} sub="All Time" />
          <MetricCard icon={UserCheck} tone="success" label="Active Members" value={String(members.filter((m) => m.status === "Active").length)} />
          <MetricCard icon={Star} tone="warning" label="Points Issued" value={members.reduce((s, m) => s + m.lifetimePoints, 0).toLocaleString()} sub="Lifetime" />
          <MetricCard icon={Gift} tone="info" label="Points Balance" value={members.reduce((s, m) => s + m.pointsBalance, 0).toLocaleString()} sub="Current" />
          <MetricCard icon={Percent} tone="accent" label="Avg Spend / Member" value={kes(members.length ? members.reduce((s, m) => s + m.totalSpentKes, 0) / members.length : 0)} />
          <MetricCard icon={Trophy} tone="success" label="Gold Members" value={String(members.filter((m) => m.tier === "Gold").length)} />
        </div>

        <div className="card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-3 flex-wrap">
            <h3 className="text-[13.5px] font-semibold">Loyalty Members</h3>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members..."
              className="bg-white/3 border border-border rounded-lg px-3 py-1.5 text-[12px] w-[200px] focus:outline-none focus:border-accent"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-text-faint uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Member</th>
                  <th className="px-4 py-2.5 font-medium">Phone</th>
                  <th className="px-4 py-2.5 font-medium">Tier</th>
                  <th className="px-4 py-2.5 font-medium text-right">Points Balance</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total Spent</th>
                  <th className="px-4 py-2.5 font-medium">Joined</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-t border-border hover:bg-white/2">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-[#c97e14] grid place-items-center text-[10px] font-semibold text-bg shrink-0">
                          {m.name.split(" ").map((n) => n[0]).join("")}
                        </span>
                        <div>
                          <div className="font-medium">{m.name}</div>
                          <div className="text-[10.5px] text-text-faint font-mono-num">{m.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-text-dim">{m.phone}</td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone={TIER_TONE[m.tier]} label={m.tier} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-num font-medium">{m.pointsBalance.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{kes(m.totalSpentKes)}</td>
                    <td className="px-4 py-2.5 text-text-faint whitespace-nowrap">{m.joined}</td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone={m.status === "Active" ? "success" : m.status === "Pending" ? "warning" : "danger"} label={m.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <RowActions
                        onEdit={() => setEditingMember(m)}
                        onDelete={() => handleDelete(m)}
                        deleting={deletingId === m.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border text-[11.5px] text-text-faint">
            Showing {rows.length} of {members.length} members
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 mt-4">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-success-soft text-success text-[12px] font-medium"
          >
            <Plus size={13} /> Add Member
          </button>
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-[12px] text-text-dim">
            <Award size={13} /> Rewards Catalog
          </button>
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-[12px] text-text-dim">
            <Sliders size={13} /> Point Adjustments
          </button>
          <button
            onClick={() => exportToCsv("loyalty-members", rows)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-[12px] text-text-dim"
          >
            <Download size={13} /> Export Report
          </button>
        </div>
      </div>

      <div className="w-full lg:w-[300px] lg:shrink-0 space-y-4 lg:overflow-y-auto lg:pr-1">
        <div className="card">
          <PanelHeader title="Loyalty Overview" />
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
                  <div className="text-[13px] font-semibold font-mono-num">{members.length}</div>
                  <div className="text-[9px] text-text-faint">Members</div>
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

        <div className="card p-4">
          <h3 className="text-[13px] font-semibold mb-3">Points Summary</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["125,680", "Points Issued", "text-accent"],
              ["34,250", "Points Redeemed", "text-warning"],
              ["91,430", "Points Balance", "text-success"],
            ].map(([v, l, c]) => (
              <div key={l}>
                <div className={`text-[14px] font-semibold font-mono-num ${c}`}>{v}</div>
                <div className="text-[9.5px] text-text-faint mt-0.5">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <PanelHeader title="Top Members (By Points)" />
          <div className="pt-3 space-y-2">
            {topMembers.map((m, i) => (
              <div key={m.name} className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/5 grid place-items-center text-[10px] font-mono-num text-text-dim">
                    {i + 1}
                  </span>
                  {m.name}
                </span>
                <span className="font-mono-num font-medium">{m.lifetimePoints.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <PanelHeader title="Recent Loyalty Activity" />
          <div className="pt-3 space-y-2.5">
            {(activityData ?? []).map((a, i) => (
              <div key={`${a.member}-${i}`} className="flex items-start justify-between gap-2 text-[12px]">
                <span className="flex items-start gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${a.points >= 0 ? "bg-success" : "bg-warning"}`}
                  />
                  <span className="text-text-dim">
                    {a.member}: {a.message}
                  </span>
                </span>
                <span className="text-[10.5px] text-text-faint whitespace-nowrap">
                  {new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
            {(activityData ?? []).length === 0 && (
              <p className="text-[12px] text-text-faint">No recent activity.</p>
            )}
          </div>
        </div>
      </div>

      {showAdd && (
        <AddMemberModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            refetch();
          }}
        />
      )}

      {editingMember && (
        <AddMemberModal
          editing={editingMember}
          onClose={() => setEditingMember(null)}
          onCreated={() => {
            setEditingMember(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function AddMemberModal({
  editing,
  onClose,
  onCreated,
}: {
  editing?: LoyaltyMember;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [tier, setTier] = useState<LoyaltyTier>(editing?.tier ?? "Bronze");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (editing) {
        await api.patch(`/loyalty/members/${editing.id}`, { name, phone, tier });
      } else {
        await api.post("/loyalty/members", { name, phone, tier });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the member.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={editing ? "Edit Loyalty Member" : "Add Loyalty Member"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <FormField label="Name">
          <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" className={inputClass} />
        </FormField>
        <FormField label="Starting Tier">
          <select value={tier} onChange={(e) => setTier(e.target.value as LoyaltyTier)} className={inputClass}>
            <option value="Bronze">Bronze</option>
            <option value="Silver">Silver</option>
            <option value="Gold">Gold</option>
          </select>
        </FormField>
        <ModalActions onCancel={onClose} submitLabel={editing ? "Save Changes" : "Add Member"} submitting={submitting} />
      </form>
    </Modal>
  );
}