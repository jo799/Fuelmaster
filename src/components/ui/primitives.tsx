import type { LucideIcon } from "lucide-react";

export type Tone = "success" | "warning" | "danger" | "info" | "accent" | "neutral";

export const TONE_CLASS: Record<Tone, string> = {
  success: "text-[var(--color-success)] bg-[var(--color-success-soft)]",
  warning: "text-[var(--color-warning)] bg-[var(--color-warning-soft)]",
  danger: "text-[var(--color-danger)] bg-[var(--color-danger-soft)]",
  info: "text-[var(--color-info)] bg-[var(--color-info-soft)]",
  accent: "text-[var(--color-accent)] bg-[var(--color-accent-soft)]",
  neutral: "text-[var(--color-text-dim)] bg-white/[0.04]",
};

export const TONE_TEXT: Record<Tone, string> = {
  success: "text-[var(--color-success)]",
  warning: "text-[var(--color-warning)]",
  danger: "text-[var(--color-danger)]",
  info: "text-[var(--color-info)]",
  accent: "text-[var(--color-accent)]",
  neutral: "text-[var(--color-text-dim)]",
};

export const TONE_DOT: Record<Tone, string> = {
  success: "bg-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]",
  danger: "bg-[var(--color-danger)]",
  info: "bg-[var(--color-info)]",
  accent: "bg-[var(--color-accent)]",
  neutral: "bg-[var(--color-text-faint)]",
};

export function MetricCard({
  icon: Icon,
  tone = "neutral",
  label,
  value,
  sub,
  delta,
}: {
  icon: LucideIcon;
  tone?: Tone;
  label: string;
  value: string;
  sub?: string;
  delta?: { value: string; positive: boolean };
}) {
  return (
    <div className="card px-4 py-3.5 flex items-center gap-3 min-w-0">
      <div className={`w-9 h-9 rounded-[9px] grid place-items-center shrink-0 ${TONE_CLASS[tone]}`}>
        <Icon size={17} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-[var(--color-text-faint)] truncate">{label}</div>
        <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[16px] font-semibold font-mono-num leading-tight whitespace-nowrap">
            {value}
          </span>
          {sub && <span className="text-[11.5px] text-[var(--color-text-dim)]">{sub}</span>}
          {delta && (
            <span
              className={`text-[10.5px] font-medium font-mono-num ${
                delta.positive ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
              }`}
            >
              {delta.positive ? "\u2191" : "\u2193"} {delta.value}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap text-[11.5px] font-medium ${TONE_TEXT[tone]}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[tone]}`} />
      {label}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  status,
  actions,
}: {
  title: string;
  subtitle?: string;
  status?: { tone: Tone; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-[19px] font-semibold">{title}</h1>
          {status && <StatusPill tone={status.tone} label={status.label} />}
        </div>
        {subtitle && (
          <p className="text-[12.5px] text-[var(--color-text-faint)] mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function PanelHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
      <h3 className="text-[13.5px] font-semibold">{title}</h3>
      {action &&
        (onAction ? (
          <button onClick={onAction} className="text-[11.5px] text-[var(--color-accent)] hover:underline">
            {action}
          </button>
        ) : (
          <span className="text-[11.5px] text-[var(--color-text-faint)]">{action}</span>
        ))}
    </div>
  );
}