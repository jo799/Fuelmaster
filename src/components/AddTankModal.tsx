import { useState } from "react";
import Modal, { FormField, inputClass, ModalActions } from "./ui/Modal";
import { api, ApiError } from "../lib/api";

export default function AddTankModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [product, setProduct] = useState<"Petrol" | "Diesel" | "Kerosene" | "LPG">("Petrol");
  const [capacity, setCapacity] = useState(20000);
  const [initialVolume, setInitialVolume] = useState(10000);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/tanks", { product, capacity, initialVolume });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the tank.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Add Tank" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <FormField label="Product">
          <select autoFocus value={product} onChange={(e) => setProduct(e.target.value as typeof product)} className={inputClass}>
            <option value="Petrol">Petrol</option>
            <option value="Diesel">Diesel</option>
            <option value="Kerosene">Kerosene</option>
            <option value="LPG">LPG</option>
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Capacity (L)">
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className={inputClass}
            />
          </FormField>
          <FormField label="Starting Volume (L)">
            <input
              type="number"
              min={0}
              max={capacity}
              value={initialVolume}
              onChange={(e) => setInitialVolume(Number(e.target.value))}
              className={inputClass}
            />
          </FormField>
        </div>
        <p className="text-[11px] text-text-faint">
          The tank code (e.g. TANK-1) is assigned automatically for this station.
        </p>
        <ModalActions onCancel={onClose} submitLabel="Add Tank" submitting={submitting} />
      </form>
    </Modal>
  );
}