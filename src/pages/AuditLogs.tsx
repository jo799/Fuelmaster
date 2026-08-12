import { useMemo, useState } from "react";
import { ScrollText, ShieldAlert, Info, Download, Search } from "lucide-react";
import { INITIAL_AUDIT_LOGS } from "../data/mock";
import { MetricCard, PageHeader, StatusPill, type Tone } from "../components/ui/primitives";
import type { AuditLogEntry, AuditSeverity } from "../types";
import { useApiData } from "../lib/useApiData";
import { exportToCsv } from "../lib/exportCsv";

const SEVERITY_TONE: Record<AuditSeverity, Tone> = {
  info: "info",
  warning: "warning",
  danger: "danger",
};

const SEVERITY_LABEL: Record<AuditSeverity, string> = {
  info: "Info",
  warning: "Warning",
  danger: "Critical",
};

export default function AuditLogs() {
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<AuditSeverity | "All">("All");
  const { data } = useApiData<AuditLogEntry[]>("/audit-logs", INITIAL_AUDIT_LOGS);
  const logs = data ?? INITIAL_AUDIT_LOGS;

  const rows = useMemo(
    () =>
      logs.filter(
        (l) =>
          (severity === "All" || l.severity === severity) &&
          (l.user.toLowerCase().includes(query.toLowerCase()) ||
            l.action.toLowerCase().includes(query.toLowerCase()) ||
            l.target.toLowerCase().includes(query.toLowerCase()))
      ),
    [logs, query, severity]
  );

  const criticalCount = logs.filter((l) => l.severity === "danger").length;
  const warningCount = logs.filter((l) => l.severity === "warning").length;

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="A complete record of actions taken across the platform"
        actions={
          <button
            onClick={() => exportToCsv("audit-logs", rows)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] text-text-dim hover:border-border-strong"
          >
            <Download size={13} /> Export
          </button>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-4">
        <MetricCard icon={ScrollText} tone="accent" label="Total Events" value={String(logs.length)} sub="Last 7 days" />
        <MetricCard icon={Info} tone="info" label="Informational" value={String(logs.length - criticalCount - warningCount)} />
        <MetricCard icon={ShieldAlert} tone="warning" label="Warnings" value={String(warningCount)} />
        <MetricCard icon={ShieldAlert} tone="danger" label="Critical" value={String(criticalCount)} />
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-3 flex-wrap">
          <h3 className="text-[13.5px] font-semibold">Event Log</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white/3 border border-border rounded-lg px-2.5 py-1.5">
              <Search size={13} className="text-text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search user, action, target..."
                className="bg-transparent text-[12px] w-[220px] focus:outline-none"
              />
            </div>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as AuditSeverity | "All")}
              className="bg-white/3 border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-text-dim focus:outline-none"
            >
              <option value="All">All Severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="danger">Critical</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[11px] text-text-faint uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Event ID</th>
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium">User</th>
                <th className="px-4 py-2.5 font-medium">Action</th>
                <th className="px-4 py-2.5 font-medium">Target</th>
                <th className="px-4 py-2.5 font-medium">IP Address</th>
                <th className="px-4 py-2.5 font-medium">Severity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-t border-border hover:bg-white/2">
                  <td className="px-4 py-2.5 font-mono-num text-accent">{l.id}</td>
                  <td className="px-4 py-2.5 text-text-faint whitespace-nowrap">{l.time}</td>
                  <td className="px-4 py-2.5">{l.user}</td>
                  <td className="px-4 py-2.5 text-text-dim">{l.action}</td>
                  <td className="px-4 py-2.5 text-text-dim">{l.target}</td>
                  <td className="px-4 py-2.5 font-mono-num text-text-faint">{l.ip}</td>
                  <td className="px-4 py-2.5">
                    <StatusPill tone={SEVERITY_TONE[l.severity]} label={SEVERITY_LABEL[l.severity]} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-faint">
                    No events match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border text-[11.5px] text-text-faint">
          Showing {rows.length} of {logs.length} events
        </div>
      </div>
    </div>
  );
}
