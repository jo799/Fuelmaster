import { useEffect } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

export default function Modal({
  title,
  onClose,
  children,
  width = 420,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative card p-5 w-full max-h-[85vh] overflow-y-auto"
        style={{ maxWidth: width }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg grid place-items-center text-text-dim hover:bg-white/5 transition-colors"
          >
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] text-text-faint mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export const inputClass =
  "w-full bg-white/3 border border-border rounded-lg px-3 py-2 text-[12.5px] focus:outline-none focus:border-accent";

export function ModalActions({
  onCancel,
  submitLabel,
  submitting,
}: {
  onCancel: () => void;
  submitLabel: string;
  submitting: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2.5 mt-5">
      <button
        type="button"
        onClick={onCancel}
        className="px-3.5 py-2 rounded-lg border border-border text-[12.5px] text-text-dim hover:border-border-strong transition-colors"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={submitting}
        className="px-3.5 py-2 rounded-lg bg-accent text-bg text-[12.5px] font-medium disabled:opacity-60"
      >
        {submitting ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}
