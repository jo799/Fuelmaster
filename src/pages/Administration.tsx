import { useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { Users, UserCheck, UserPlus, ShieldCheck, KeyRound, Lock, Plus, Search } from "lucide-react";
import { INITIAL_ADMIN_USERS } from "../data/mock";
import { MetricCard, PageHeader, PanelHeader, StatusPill, type Tone } from "../components/ui/primitives";
import type { AdminUser, UserStatus, AuditLogEntry } from "../types";
import { useApiData } from "../lib/useApiData";

const STATUS_TONE: Record<UserStatus, Tone> = {
  Active: "success",
  Suspended: "danger",
  Invited: "info",
};

const SEVERITY_DOT: Record<string, string> = {
  info: "bg-[var(--color-info)]",
  warning: "bg-[var(--color-warning)]",
  danger: "bg-[var(--color-danger)]",
};

interface TrendRow {
  d: string;
  active: number;
  added: number;
}

export default function Administration({ onNavigate }: { onNavigate: (route: string) => void }) {
  const [query, setQuery] = useState("");
  const { data } = useApiData<AdminUser[]>("/users", INITIAL_ADMIN_USERS);
  const users = data ?? INITIAL_ADMIN_USERS;
  const { data: trend } = useApiData<TrendRow[]>("/users/trend", []);
  const { data: recentLogs } = useApiData<AuditLogEntry[]>("/audit-logs", []);

  const rows = useMemo(
    () => users.filter((u) => u.name.toLowerCase().includes(query.toLowerCase())),
    [users, query]
  );

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "Active").length;

  const ROLE_COLORS: Record<string, string> = {
    Cashier: "#f31260",
    Controller: "#38bdf8",
    Manager: "#f5a524",
    Administrator: "#a78bfa",
    Supervisor: "#f9a826",
    Viewer: "#8b98a5",
  };
  const roleSplit = Object.entries(
    users.reduce<Record<string, number>>((acc, u) => {
      acc[u.role] = (acc[u.role] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value, color: ROLE_COLORS[name] ?? "#8b98a5" }));

  return (
    <div>
      <PageHeader
        title="Administration"
        subtitle="Manage system users, roles, and platform configuration"
        actions={
          <button
            onClick={() => onNavigate("users")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--color-accent)] text-[#081018] text-[12px] font-medium"
          >
            <Plus size={13} /> Add New
          </button>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-4">
        <MetricCard icon={Users} tone="accent" label="Total Users" value={String(totalUsers)} />
        <MetricCard icon={UserCheck} tone="success" label="Active Users" value={String(activeUsers)} />
        <MetricCard icon={UserPlus} tone="info" label="Suspended Users" value={String(users.filter((u) => u.status === "Suspended").length)} />
        <MetricCard icon={ShieldCheck} tone="warning" label="Administrators" value={String(users.filter((u) => u.role === "Administrator").length)} />
        <MetricCard icon={KeyRound} tone="info" label="Roles in Use" value={String(new Set(users.map((u) => u.role)).size)} />
        <MetricCard icon={Lock} tone="danger" label="Invited (Pending)" value={String(users.filter((u) => u.status === "Invited").length)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="card">
          <PanelHeader title="Users Over Time" />
          <div className="p-3 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend ?? []} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, fontSize: 11 }} />
                <Line type="monotone" dataKey="active" name="Total Users" stroke="#17c964" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="added" name="New Users" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <PanelHeader title="Users by Role" action="Manage Users" onAction={() => onNavigate("users")} />
          <div className="p-4 flex items-center gap-4">
            <div className="relative w-[110px] h-[110px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={roleSplit} dataKey="value" innerRadius={36} outerRadius={52} paddingAngle={2} stroke="none">
                    {roleSplit.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center">
                  <div className="text-[13px] font-semibold font-mono-num">{totalUsers}</div>
                  <div className="text-[9px] text-[var(--color-text-faint)]">Total</div>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {roleSplit.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-[11px] gap-2">
                  <span className="flex items-center gap-1.5 min-w-0 text-[var(--color-text-dim)]">
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
          <PanelHeader title="Recent Activity" action="View All" onAction={() => onNavigate("audit-logs")} />
          <div className="p-4 space-y-3">
            {(recentLogs ?? []).slice(0, 6).map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 text-[12px]">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${SEVERITY_DOT[a.severity]}`} />
                <div className="min-w-0 flex-1">
                  <div className="leading-snug">
                    <span className="font-medium">{a.user}</span> {a.action} <span className="text-text-dim">{a.target}</span>
                  </div>
                  <div className="text-[10.5px] text-[var(--color-text-faint)] mt-0.5">{a.time}</div>
                </div>
              </div>
            ))}
            {(recentLogs ?? []).length === 0 && (
              <p className="text-[12px] text-text-faint">No recent activity recorded.</p>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] gap-3 flex-wrap">
          <h3 className="text-[13.5px] font-semibold">Users</h3>
          <div className="flex items-center gap-1.5 bg-white/[0.03] border border-[var(--color-border)] rounded-[8px] px-2.5 py-1.5">
            <Search size={13} className="text-[var(--color-text-faint)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users..."
              className="bg-transparent text-[12px] w-[160px] focus:outline-none"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[11px] text-[var(--color-text-faint)] uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">User</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Station</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Last Login</th>
                <th className="px-4 py-2.5 font-medium">Created On</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.name} className="border-t border-[var(--color-border)] hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5 flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[#c97e14] grid place-items-center text-[9.5px] font-semibold text-[#081018]">
                      {u.name.split(" ").map((n) => n[0]).join("")}
                    </span>
                    {u.name}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-text-dim)]">{u.role}</td>
                  <td className="px-4 py-2.5 text-[var(--color-text-dim)]">{u.station}</td>
                  <td className="px-4 py-2.5">
                    <StatusPill tone={STATUS_TONE[u.status]} label={u.status} />
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-text-faint)] whitespace-nowrap">{u.lastLogin}</td>
                  <td className="px-4 py-2.5 text-[var(--color-text-faint)] whitespace-nowrap">{u.createdOn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-[var(--color-border)] text-[11.5px] text-[var(--color-text-faint)]">
          Showing {rows.length} of {totalUsers} users
        </div>
      </div>
    </div>
  );
}