import { useEffect, useState } from "react";
import { Plus, Trash2, Info } from "lucide-react";
import Modal, { ModalActions } from "./ui/Modal";
import { api, ApiError } from "../lib/api";

interface StrappingPoint {
  heightMm: number;
  volumeL: number;
}

export default function StrappingTableModal({
  tankId,
  onClose,
  onSaved,
}: {
  tankId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [points, setPoints] = useState<StrappingPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<StrappingPoint[]>(`/tanks/${encodeURIComponent(tankId)}/strapping`)
      .then((existing) => setPoints(existing.length > 0 ? existing : [{ heightMm: 0, volumeL: 0 }, { heightMm: 0, volumeL: 0 }]))
      .catch(() => setPoints([{ heightMm: 0, volumeL: 0 }, { heightMm: 0, volumeL: 0 }]))
      .finally(() => setLoading(false));
  }, [tankId]);

  function updatePoint(index: number, field: keyof StrappingPoint, value: number) {
    setPoints((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function addRow() {
    setPoints((prev) => [...prev, { heightMm: 0, volumeL: 0 }]);
  }

  function removeRow(index: number) {
    setPoints((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const validPoints = points.filter((p) => p.heightMm >= 0 && p.volumeL >= 0);
    if (validPoints.length < 2) {
      setError("At least 2 points are needed to build a calibration curve.");
      return;
    }
    setSubmitting(true);
    try {
      await api.put(`/tanks/${encodeURIComponent(tankId)}/strapping`, { points: validPoints });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the strapping table.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveTable() {
    setSubmitting(true);
    setError(null);
    try {
      await api.del(`/tanks/${encodeURIComponent(tankId)}/strapping`);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the strapping table.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Strapping Table \u2014 ${tankId}`} onClose={onClose} width={480}>
      <form onSubmit={handleSave} className="space-y-3.5">
        <div className="flex items-start gap-2 text-[11.5px] text-text-dim bg-white/3 border border-border rounded-lg px-3 py-2.5">
          <Info size={14} className="shrink-0 mt-0.5 text-info" />
          <span>
            Enter the height-to-volume points from this tank's manufacturer calibration certificate. Once at least 2
            points are saved, volume is calculated from the probe's real height reading using this table instead of
            an estimated tank shape.
          </span>
        </div>

        {error && (
          <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-[12.5px] text-text-faint py-4 text-center">Loading&hellip;</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_28px] gap-2 text-[10.5px] text-text-faint uppercase tracking-wide px-0.5">
              <span>Height (mm)</span>
              <span>Volume (L)</span>
              <span />
            </div>
            <div className="max-h-[240px] overflow-y-auto space-y-1.5">
              {points.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_28px] gap-2 items-center">
                  <input
                    type="number"
                    min={0}
                    value={p.heightMm}
                    onChange={(e) => updatePoint(i, "heightMm", Number(e.target.value))}
                    className="bg-white/3 border border-border rounded-lg px-2.5 py-1.5 text-[12.5px] font-mono-num focus:outline-none focus:border-accent"
                  />
                  <input
                    type="number"
                    min={0}
                    value={p.volumeL}
                    onChange={(e) => updatePoint(i, "volumeL", Number(e.target.value))}
                    className="bg-white/3 border border-border rounded-lg px-2.5 py-1.5 text-[12.5px] font-mono-num focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    disabled={points.length <= 2}
                    className="w-7 h-7 rounded-md grid place-items-center text-text-faint hover:text-danger hover:bg-white/5 transition-colors disabled:opacity-30"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 text-[11.5px] text-accent hover:underline"
            >
              <Plus size={12} /> Add point
            </button>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleRemoveTable}
            disabled={submitting}
            className="text-[11.5px] text-danger hover:underline disabled:opacity-50"
          >
            Remove table (use estimated geometry instead)
          </button>
        </div>

        <ModalActions onCancel={onClose} submitLabel="Save Strapping Table" submitting={submitting} />
      </form>
    </Modal>
  );
}