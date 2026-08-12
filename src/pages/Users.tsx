import { useMemo, useState } from "react";
import { Users as UsersIcon, UserCheck, ShieldCheck, KeyRound, Plus, Search } from "lucide-react";
import { INITIAL_ADMIN_USERS } from "../data/mock";
import { MetricCard, PageHeader, PanelHeader, StatusPill, type Tone } from "../components/ui/primitives";
import type { AdminUser, UserRole, UserStatus } from "../types";
import { useApiData } from "../lib/useApiData";
import { api, ApiError } from "../lib/api";
import Modal, { FormField, inputClass, ModalActions } from "../components/ui/Modal";
import RowActions from "../components/ui/RowActions";

const STATUS_TONE: Record<UserStatus, Tone> = {
  Active: "success",
  Suspended: "danger",
  Invited: "info",
};

const ROLE_DESC: Record<UserRole, string> = {
  Administrator: "Full access to every module and system setting",
  Manager: "Station operations, reports, staff, and pricing",
  Supervisor: "Shift oversight, approvals, and cash management",
  Controller: "Forecourt hardware, dispensers, and tank gauges",
  Cashier: "POS sales, shift open/close, and till reconciliation",
  Viewer: "Read-only access to dashboards and reports",
};

export default function Users() {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "All">("All");
  const { data, refetch } = useApiData<AdminUser[]>("/users", INITIAL_ADMIN_USERS);
  const users = data ?? INITIAL_ADMIN_USERS;
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);

  async function handleDelete(u: AdminUser) {
    if (!confirm(`Delete user "${u.name}"? This can't be undone.`)) return;
    setDeletingEmail(u.email);
    try {
      await api.del(`/users/${encodeURIComponent(u.email)}`);
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not delete the user.");
    } finally {
      setDeletingEmail(null);
    }
  }

  const rows = useMemo(
    () =>
      users.filter(
        (u) =>
          (roleFilter === "All" || u.role === roleFilter) &&
          u.name.toLowerCase().includes(query.toLowerCase())
      ),
    [users, query, roleFilter]
  );

  const roles = Object.keys(ROLE_DESC) as UserRole[];
  const invitedUsers = users.filter((u) => u.status === "Invited");

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-full">
      <div className="flex-1 min-w-0">
        <PageHeader
          title="Users"
          subtitle="Manage station staff, roles, and access"
          actions={
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-bg text-[12px] font-medium"
            >
              <Plus size={13} /> Add User
            </button>
          }
        />

        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-4">
          <MetricCard icon={UsersIcon} tone="accent" label="Total Users" value={String(users.length)} />
          <MetricCard icon={UserCheck} tone="success" label="Active Users" value={String(users.filter((u) => u.status === "Active").length)} />
          <MetricCard icon={ShieldCheck} tone="warning" label="Roles in Use" value={String(new Set(users.map((u) => u.role)).size)} />
          <MetricCard icon={KeyRound} tone="info" label="Suspended" value={String(users.filter((u) => u.status === "Suspended").length)} />
        </div>

        <div className="card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-3 flex-wrap">
            <h3 className="text-[13.5px] font-semibold">Roster</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white/3 border border-border rounded-lg px-2.5 py-1.5">
                <Search size={13} className="text-text-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search users..."
                  className="bg-transparent text-[12px] w-[160px] focus:outline-none"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as UserRole | "All")}
                className="bg-white/3 border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-text-dim focus:outline-none"
              >
                <option value="All">All Roles</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-text-faint uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">User</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Station</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Last Login</th>
                  <th className="px-4 py-2.5 font-medium">Created On</th>
                  <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.name} className="border-t border-border hover:bg-white/2">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-[#c97e14] grid place-items-center text-[10px] font-semibold text-bg shrink-0">
                          {u.name.split(" ").map((n) => n[0]).join("")}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate">{u.name}</div>
                          <div className="text-[10.5px] text-text-faint truncate">
                            {u.email}
                            {u.phone && <span> &middot; {u.phone}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-text-dim">{u.role}</td>
                    <td className="px-4 py-2.5 text-text-dim">{u.station}</td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone={STATUS_TONE[u.status]} label={u.status} />
                    </td>
                    <td className="px-4 py-2.5 text-text-faint whitespace-nowrap">{u.lastLogin}</td>
                    <td className="px-4 py-2.5 text-text-faint whitespace-nowrap">{u.createdOn}</td>
                    <td className="px-4 py-2.5 text-right">
                      <RowActions
                        onEdit={() => setEditingUser(u)}
                        onDelete={() => handleDelete(u)}
                        deleting={deletingEmail === u.email}
                      />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-text-faint">
                      No users match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border text-[11.5px] text-text-faint">
            Showing {rows.length} of {users.length} users
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[300px] lg:shrink-0 space-y-4 lg:overflow-y-auto lg:pr-1">
        <div className="card p-4">
          <PanelHeader title="Roles &amp; Permissions" />
          <div className="pt-3 space-y-3">
            {roles.map((r) => (
              <div key={r} className="pb-3 border-b border-border last:border-0 last:pb-0">
                <div className="flex items-center justify-between text-[12.5px] mb-0.5">
                  <span className="font-medium">{r}</span>
                  <span className="font-mono-num text-text-dim">
                    {users.filter((u) => u.role === r).length} user{users.filter((u) => u.role === r).length === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="text-[11px] text-text-faint leading-snug">{ROLE_DESC[r]}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-[13px] font-semibold mb-3">Pending Invites</h3>
          {invitedUsers.length === 0 ? (
            <p className="text-[12px] text-text-faint">No pending invitations right now.</p>
          ) : (
            <div className="space-y-2">
              {invitedUsers.map((u) => (
                <div key={u.email} className="flex items-center justify-between text-[12px]">
                  <span className="text-text-dim">{u.name}</span>
                  <span className="text-text-faint">{u.email}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <AddUserModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            refetch();
          }}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdated={() => {
            setEditingUser(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function EditUserModal({
  user,
  onClose,
  onUpdated,
}: {
  user: AdminUser;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [status, setStatus] = useState<UserStatus>(user.status);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/users/${encodeURIComponent(user.email)}/status`, {
        role,
        status,
        phone: phone.trim() || null,
      });
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the user.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Edit ${user.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <p className="text-[12px] text-text-faint">{user.email}</p>
        <FormField label="Role">
          <select autoFocus value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputClass}>
            <option value="Cashier">Cashier</option>
            <option value="Supervisor">Supervisor</option>
            <option value="Controller">Controller</option>
            <option value="Manager">Manager</option>
            <option value="Administrator">Administrator</option>
            <option value="Viewer">Viewer</option>
          </select>
        </FormField>
        <FormField label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as UserStatus)} className={inputClass}>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
            <option value="Invited">Invited</option>
          </select>
        </FormField>
        <FormField label="Phone (for SMS notifications)">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+254712345678"
            className={inputClass}
          />
        </FormField>
        <ModalActions onCancel={onClose} submitLabel="Save Changes" submitting={submitting} />
      </form>
    </Modal>
  );
}function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("Cashier");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/users", { name, email, phone: phone.trim() || undefined, password, role });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the user.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Add User" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <FormField label="Full Name">
          <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Email">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Phone (optional, for SMS notifications)">
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254712345678" className={inputClass} />
        </FormField>
        <FormField label="Temporary Password">
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className={inputClass}
          />
        </FormField>
        <FormField label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputClass}>
            <option value="Cashier">Cashier</option>
            <option value="Supervisor">Supervisor</option>
            <option value="Controller">Controller</option>
            <option value="Manager">Manager</option>
            <option value="Administrator">Administrator</option>
            <option value="Viewer">Viewer</option>
          </select>
        </FormField>
        <p className="text-[11px] text-text-faint">
          Only Administrators can create users. If you're logged in as a different role, this will fail with a
          permissions error.
        </p>
        <ModalActions onCancel={onClose} submitLabel="Create User" submitting={submitting} />
      </form>
    </Modal>
  );
}