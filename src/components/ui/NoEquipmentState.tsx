import type { LucideIcon } from "lucide-react";
import { PageHeader } from "./primitives";

export default function NoEquipmentState({
  icon: Icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div>
      <PageHeader title={title} />
      <div className="card py-16 px-6 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-[12px] bg-white/5 text-text-dim grid place-items-center">
          <Icon size={22} />
        </div>
        <h3 className="text-[14px] font-semibold">Nothing configured for this station yet</h3>
        <p className="text-[12.5px] text-text-dim max-w-[380px]">{message}</p>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="mt-1 px-4 py-2 rounded-lg bg-accent text-bg text-[12.5px] font-medium"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}