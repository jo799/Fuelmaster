import { useState } from "react";
import { Fuel, Database, Tag, Check, ArrowRight, ArrowLeft, Trash2, PartyPopper } from "lucide-react";
import Modal, { FormField, inputClass } from "./ui/Modal";
import { api, ApiError } from "../lib/api";

type Step = "prices" | "pumps" | "tanks" | "done";
const STEPS: Step[] = ["prices", "pumps", "tanks", "done"];
const STEP_LABELS: Record<Step, string> = {
  prices: "Fuel Prices",
  pumps: "Pumps & Nozzles",
  tanks: "Fuel Tanks",
  done: "Done",
};

interface AddedPrice {
  fuel: string;
  price: number;
}
interface AddedPump {
  id: number;
  name: string;
  product: string;
}
interface AddedTank {
  id: string;
  product: string;
  capacity: number;
}

const COMMON_FUELS = ["Petrol (PMS 95)", "Diesel (ENS90)", "Kerosene"];

export default function StationSetupWizard({
  stationName,
  onFinish,
}: {
  stationName: string;
  onFinish: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];

  const [prices, setPrices] = useState<AddedPrice[]>([]);
  const [pumps, setPumps] = useState<AddedPump[]>([]);
  const [tanks, setTanks] = useState<AddedTank[]>([]);

  function goNext() {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }
  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <Modal title={`Set Up ${stationName}`} onClose={onFinish} width={520}>
      <div className="flex items-center gap-1.5 mb-5">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1.5 flex-1">
            <div
              className={`w-6 h-6 rounded-full grid place-items-center text-[10.5px] font-semibold shrink-0 ${
                i < stepIndex
                  ? "bg-success text-bg"
                  : i === stepIndex
                  ? "bg-accent text-bg"
                  : "bg-white/5 text-text-faint"
              }`}
            >
              {i < stepIndex ? <Check size={12} /> : i + 1}
            </div>
            <span className={`text-[10.5px] ${i === stepIndex ? "text-text" : "text-text-faint"} hidden sm:inline`}>
              {STEP_LABELS[s]}
            </span>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
          </div>
        ))}
      </div>

      {step === "prices" && (
        <PricesStep prices={prices} onAdded={(p) => setPrices((prev) => [...prev, p])} onRemoved={(fuel) => setPrices((prev) => prev.filter((p) => p.fuel !== fuel))} />
      )}
      {step === "pumps" && (
        <PumpsStep pumps={pumps} onAdded={(p) => setPumps((prev) => [...prev, p])} />
      )}
      {step === "tanks" && (
        <TanksStep tanks={tanks} onAdded={(t) => setTanks((prev) => [...prev, t])} />
      )}
      {step === "done" && <DoneStep stationName={stationName} prices={prices} pumps={pumps} tanks={tanks} />}

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
        <button
          onClick={goBack}
          disabled={stepIndex === 0}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-[12.5px] text-text-dim disabled:opacity-0 disabled:pointer-events-none"
        >
          <ArrowLeft size={13} /> Back
        </button>
        {step === "done" ? (
          <button onClick={onFinish} className="px-4 py-2 rounded-lg bg-accent text-bg text-[12.5px] font-medium">
            Finish
          </button>
        ) : (
          <div className="flex items-center gap-2.5">
            <button onClick={goNext} className="px-3.5 py-2 text-[12.5px] text-text-faint">
              Skip for now
            </button>
            <button
              onClick={goNext}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-bg text-[12.5px] font-medium"
            >
              Next <ArrowRight size={13} />
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function AddedList({ children, empty }: { children: React.ReactNode; empty: string }) {
  const hasItems = Array.isArray(children) ? children.some(Boolean) : Boolean(children);
  return (
    <div className="space-y-1.5 max-h-[160px] overflow-y-auto mb-1">
      {hasItems ? children : <p className="text-[11.5px] text-text-faint text-center py-3">{empty}</p>}
    </div>
  );
}

function PricesStep({
  prices,
  onAdded,
  onRemoved,
}: {
  prices: AddedPrice[];
  onAdded: (p: AddedPrice) => void;
  onRemoved: (fuel: string) => void;
}) {
  const [fuel, setFuel] = useState("");
  const [price, setPrice] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addPrice(fuelName: string, priceValue: number) {
    if (!fuelName.trim() || priceValue <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/price-management", { fuel: fuelName.trim(), newPrice: priceValue, reason: "Station setup" });
      onAdded({ fuel: fuelName.trim(), price: priceValue });
      setFuel("");
      setPrice(0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add this price.");
    } finally {
      setSubmitting(false);
    }
  }

  const remainingCommon = COMMON_FUELS.filter((f) => !prices.some((p) => p.fuel === f));

  return (
    <div>
      <p className="text-[12px] text-text-dim mb-3">
        Set the prices this station sells at. You'll need at least one before POS can ring up a real sale.
      </p>

      {remainingCommon.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {remainingCommon.map((f) => (
            <button
              key={f}
              onClick={() => setFuel(f)}
              className="px-2.5 py-1 rounded-md border border-border text-[11px] text-text-dim hover:border-border-strong"
            >
              + {f}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="text-[11.5px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <div className="flex items-end gap-2 mb-4">
        <div className="flex-1">
          <FormField label="Fuel / Product">
            <input value={fuel} onChange={(e) => setFuel(e.target.value)} placeholder="e.g. Petrol (PMS 95)" className={inputClass} />
          </FormField>
        </div>
        <div className="w-28">
          <FormField label="Price (KES)">
            <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))} className={inputClass} />
          </FormField>
        </div>
        <button
          onClick={() => addPrice(fuel, price)}
          disabled={submitting || !fuel.trim() || price <= 0}
          className="px-3.5 py-2 rounded-lg bg-accent text-bg text-[12px] font-medium disabled:opacity-40"
        >
          Add
        </button>
      </div>

      <AddedList empty="No prices added yet.">
        {prices.map((p) => (
          <div key={p.fuel} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/3 text-[12px]">
            <span className="flex items-center gap-2">
              <Tag size={13} className="text-accent" /> {p.fuel}
            </span>
            <span className="flex items-center gap-2">
              <span className="font-mono-num">KES {p.price.toLocaleString()}</span>
              <button onClick={() => onRemoved(p.fuel)} className="text-text-faint hover:text-danger">
                <Trash2 size={12} />
              </button>
            </span>
          </div>
        ))}
      </AddedList>
    </div>
  );
}

function PumpsStep({ pumps, onAdded }: { pumps: AddedPump[]; onAdded: (p: AddedPump) => void }) {
  const [name, setName] = useState("");
  const [product, setProduct] = useState<"Petrol" | "Diesel" | "Kerosene" | "LPG">("Petrol");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addPump() {
    setSubmitting(true);
    setError(null);
    try {
      const pump = await api.post<{ id: number; name: string }>("/dispensers", { name: name.trim() || undefined, product });
      await api.post("/nozzles", { pumpId: pump.id, product });
      onAdded({ id: pump.id, name: pump.name, product });
      setName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add this pump.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <p className="text-[12px] text-text-dim mb-3">
        Add each physical pump. A first nozzle is added automatically for the product you pick \u2014 add more nozzles
        per pump later from the Nozzles page if a pump serves more than one product.
      </p>

      {error && (
        <div className="text-[11.5px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <div className="flex items-end gap-2 mb-4">
        <div className="flex-1">
          <FormField label="Pump Name (optional)">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Auto-named if blank" className={inputClass} />
          </FormField>
        </div>
        <div className="w-32">
          <FormField label="Product">
            <select value={product} onChange={(e) => setProduct(e.target.value as typeof product)} className={inputClass}>
              <option value="Petrol">Petrol</option>
              <option value="Diesel">Diesel</option>
              <option value="Kerosene">Kerosene</option>
              <option value="LPG">LPG</option>
            </select>
          </FormField>
        </div>
        <button
          onClick={addPump}
          disabled={submitting}
          className="px-3.5 py-2 rounded-lg bg-accent text-bg text-[12px] font-medium disabled:opacity-40"
        >
          Add
        </button>
      </div>

      <AddedList empty="No pumps added yet.">
        {pumps.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/3 text-[12px]">
            <span className="flex items-center gap-2">
              <Fuel size={13} className="text-accent" /> {p.name}
            </span>
            <span className="text-text-dim">{p.product}</span>
          </div>
        ))}
      </AddedList>
    </div>
  );
}

function TanksStep({ tanks, onAdded }: { tanks: AddedTank[]; onAdded: (t: AddedTank) => void }) {
  const [product, setProduct] = useState<"Petrol" | "Diesel" | "Kerosene" | "LPG">("Petrol");
  const [capacity, setCapacity] = useState(20000);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addTank() {
    setSubmitting(true);
    setError(null);
    try {
      const tank = await api.post<{ id: string }>("/tanks", { product, capacity, initialVolume: capacity * 0.5 });
      onAdded({ id: tank.id, product, capacity });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add this tank.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <p className="text-[12px] text-text-dim mb-3">
        Add each storage tank. It starts at half full \u2014 adjust the actual level later from the Fuel Tanks page.
      </p>

      {error && (
        <div className="text-[11.5px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <div className="flex items-end gap-2 mb-4">
        <div className="w-32">
          <FormField label="Product">
            <select value={product} onChange={(e) => setProduct(e.target.value as typeof product)} className={inputClass}>
              <option value="Petrol">Petrol</option>
              <option value="Diesel">Diesel</option>
              <option value="Kerosene">Kerosene</option>
              <option value="LPG">LPG</option>
            </select>
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="Capacity (L)">
            <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className={inputClass} />
          </FormField>
        </div>
        <button
          onClick={addTank}
          disabled={submitting}
          className="px-3.5 py-2 rounded-lg bg-accent text-bg text-[12px] font-medium disabled:opacity-40"
        >
          Add
        </button>
      </div>

      <AddedList empty="No tanks added yet.">
        {tanks.map((t) => (
          <div key={t.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/3 text-[12px]">
            <span className="flex items-center gap-2">
              <Database size={13} className="text-accent" /> {t.id}
            </span>
            <span className="text-text-dim">
              {t.product} &middot; {t.capacity.toLocaleString()} L
            </span>
          </div>
        ))}
      </AddedList>
    </div>
  );
}

function DoneStep({
  stationName,
  prices,
  pumps,
  tanks,
}: {
  stationName: string;
  prices: AddedPrice[];
  pumps: AddedPump[];
  tanks: AddedTank[];
}) {
  return (
    <div className="text-center py-4">
      <div className="w-14 h-14 rounded-full bg-success-soft text-success grid place-items-center mx-auto mb-4">
        <PartyPopper size={24} />
      </div>
      <h3 className="text-[15px] font-semibold mb-1.5">{stationName} is ready</h3>
      <p className="text-[12.5px] text-text-dim mb-4">
        {prices.length} price{prices.length === 1 ? "" : "s"}, {pumps.length} pump{pumps.length === 1 ? "" : "s"}, and{" "}
        {tanks.length} tank{tanks.length === 1 ? "" : "s"} set up. You can add more anytime from the Price
        Management, Dispensers, and Fuel Tanks pages.
      </p>
    </div>
  );
}