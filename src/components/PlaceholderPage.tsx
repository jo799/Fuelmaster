import { Hammer } from "lucide-react";

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-3">
      <div className="w-12 h-12 rounded-[12px] bg-[var(--color-accent-soft)] text-[var(--color-accent)] grid place-items-center">
        <Hammer size={20} />
      </div>
      <h2 className="text-[16px] font-semibold">{title}</h2>
      <p className="text-[13px] text-[var(--color-text-dim)] max-w-[360px]">
        This module follows the same design system as the Dashboard and is next up to build.
      </p>
    </div>
  );
}
