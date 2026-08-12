import { Pencil, Trash2 } from "lucide-react";

export default function RowActions({
  onEdit,
  onDelete,
  deleting,
}: {
  onEdit: () => void;
  onDelete: () => void;
  deleting?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        onClick={onEdit}
        title="Edit"
        className="p-1.5 rounded-md border border-border text-text-dim hover:border-border-strong hover:text-accent transition-colors"
      >
        <Pencil size={12} />
      </button>
      <button
        onClick={onDelete}
        disabled={deleting}
        title="Delete"
        className="p-1.5 rounded-md border border-border text-text-dim hover:border-danger/40 hover:text-danger transition-colors disabled:opacity-50"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
