export default function StatusFooter() {
  return (
    <footer className="h-9 shrink-0 flex items-center justify-between px-5 border-t border-[var(--color-border)] bg-[var(--color-panel)] text-[11px] text-[var(--color-text-faint)]">
      <span>&copy; 2026 FuelMaster Forecourt Management System</span>
      <div className="flex items-center gap-4">
        <span>v2.5.0</span>
        <span className="inline-flex items-center gap-1.5 text-[var(--color-success)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
          All Systems Operational
        </span>
      </div>
    </footer>
  );
}
