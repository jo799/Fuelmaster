import { useEffect, useMemo, useState } from "react";
import {
  Fuel,
  ShoppingBag,
  Trash2,
  Banknote,
  CreditCard,
  Smartphone,
  Building2,
  Star,
  X,
  Pause,
  RotateCcw,
  Receipt as ReceiptIcon,
} from "lucide-react";
import { PageHeader, PanelHeader } from "../components/ui/primitives";
import { kes, litres } from "../lib/format";
import { api, ApiError } from "../lib/api";
import { useApiData } from "../lib/useApiData";
import Receipt, { type ReceiptData } from "../components/Receipt";
import type { Nozzle, FuelPriceRow, InventoryItem, FleetAccountRow, LoyaltyMember } from "../types";
import { findFuelPrice } from "../lib/fuelPrice";

interface LineItem {
  key: string;
  product: string;
  litres: number;
  price: number;
  amount: number;
}

interface HeldSale {
  id: string;
  label: string;
  items: LineItem[];
  heldAt: string;
}

const TAX_RATE = 0.16;
type PaymentMethod = "Cash" | "Card" | "Mobile Money" | "Fleet Account";

export default function POS() {
  const { data: nozzleData, loading: nozzlesLoading } = useApiData<Nozzle[]>("/nozzles", []);
  const nozzles = nozzleData ?? [];
  const { data: priceData } = useApiData<FuelPriceRow[]>("/price-management", []);
  const prices = priceData ?? [];
  const { data: inventoryData } = useApiData<InventoryItem[]>("/inventory", []);
  const shopItems = (inventoryData ?? []).filter((i) => i.category !== "Fuel" && i.status !== "Out of Stock");
  const { data: fleetData } = useApiData<FleetAccountRow[]>("/fleet-accounts", []);
  const fleetAccounts = fleetData ?? [];
  const { data: loyaltyData } = useApiData<LoyaltyMember[]>("/loyalty/members", []);
  const loyaltyMembers = loyaltyData ?? [];

  const [tab, setTab] = useState<"fuel" | "shop">("fuel");
  const [items, setItems] = useState<LineItem[]>([]);
  const [selectedNozzleId, setSelectedNozzleId] = useState<number | null>(null);
  const [fuelLitres, setFuelLitres] = useState("");

  const [payment, setPayment] = useState<PaymentMethod>("Cash");
  const [fleetAccountId, setFleetAccountId] = useState("");
  const [loyaltyQuery, setLoyaltyQuery] = useState("");
  const [loyaltyMemberId, setLoyaltyMemberId] = useState<string | null>(null);
  const [amountReceived, setAmountReceived] = useState(0);

  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const selectedNozzle = nozzles.find((n) => n.id === selectedNozzleId) ?? null;
  const autoPrice = selectedNozzle ? findFuelPrice(prices, selectedNozzle.product) : null;
  const [priceOverride, setPriceOverride] = useState("");

  // Auto-fill the price field whenever the selected nozzle (and therefore
  // its product) changes, while still leaving it open for the cashier to
  // manually adjust \u2014 e.g. a promotional rate or a temporary correction.
  useEffect(() => {
    setPriceOverride(autoPrice !== null ? String(autoPrice) : "");
  }, [selectedNozzleId, autoPrice]);

  const fuelPrice = priceOverride ? Number(priceOverride) : null;

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.amount, 0), [items]);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;
  const change = payment === "Cash" ? Math.max(0, amountReceived - total) : 0;
  const totalLitres = items.reduce((s, i) => s + i.litres, 0);

  const selectedFleetAccount = fleetAccounts.find((a) => a.accountId === fleetAccountId);
  const matchedLoyaltyMembers = loyaltyQuery.length >= 2
    ? loyaltyMembers.filter(
        (m) => m.name.toLowerCase().includes(loyaltyQuery.toLowerCase()) || m.phone.includes(loyaltyQuery)
      )
    : [];
  const selectedLoyaltyMember = loyaltyMembers.find((m) => m.id === loyaltyMemberId);

  function addFuelItem() {
    if (!selectedNozzle || fuelPrice === null) return;
    const litresNum = Number(fuelLitres);
    if (!litresNum || litresNum <= 0) return;
    setItems((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        product: selectedNozzle.product,
        litres: litresNum,
        price: fuelPrice,
        amount: litresNum * fuelPrice,
      },
    ]);
    setFuelLitres("");
  }

  function addShopItem(item: InventoryItem) {
    setItems((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        product: item.name,
        litres: 1,
        price: item.costKes,
        amount: item.costKes,
      },
    ]);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function updateItemQuantity(key: string, newLitres: number) {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, litres: newLitres, amount: newLitres * i.price } : i))
    );
  }

  function resetSaleState() {
    setItems([]);
    setPayment("Cash");
    setFleetAccountId("");
    setLoyaltyMemberId(null);
    setLoyaltyQuery("");
    setAmountReceived(0);
    setFeedback(null);
  }

  function holdSale() {
    if (items.length === 0) return;
    setHeldSales((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: `${items.length} item${items.length > 1 ? "s" : ""} \u2013 ${kes(total)}`,
        items,
        heldAt: new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    resetSaleState();
  }

  function resumeHeldSale(id: string) {
    const held = heldSales.find((h) => h.id === id);
    if (!held) return;
    setItems(held.items);
    setHeldSales((prev) => prev.filter((h) => h.id !== id));
  }

  function cancelSale() {
    if (items.length === 0) return;
    if (!confirm("Cancel this sale? All items will be cleared.")) return;
    resetSaleState();
  }

  function newSale() {
    if (items.length > 0 && !confirm("Start a new sale? The current, unsaved items will be cleared.")) return;
    resetSaleState();
    setSelectedNozzleId(null);
  }

  async function completeSale() {
    if (items.length === 0) {
      setFeedback({ type: "error", message: "Add at least one item before completing the sale." });
      return;
    }
    if (payment === "Cash" && amountReceived < total) {
      setFeedback({ type: "error", message: "Amount received is less than the total due." });
      return;
    }
    if (payment === "Fleet Account" && !fleetAccountId) {
      setFeedback({ type: "error", message: "Select a fleet account for this payment method." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await api.post<ReceiptData>("/pos/sale", {
        pumpId: selectedNozzle?.pumpId,
        nozzle: selectedNozzle?.nozzleNo ?? 1,
        items: items.map((i) => ({ product: i.product, litres: i.litres, price: i.price })),
        paymentMethod: payment,
        fleetAccountId: payment === "Fleet Account" ? fleetAccountId : undefined,
        loyaltyMemberId: loyaltyMemberId ?? undefined,
      });
      setReceipt(res);
      resetSaleState();
      setSelectedNozzleId(null);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof ApiError ? err.message : "Could not complete the sale. Try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  // Real keyboard shortcuts behind the F2/F3/F4/F9 labels on the buttons
  // below \u2014 previously those were just text with no listener at all.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        holdSale();
      } else if (e.key === "F3") {
        e.preventDefault();
        cancelSale();
      } else if (e.key === "F4") {
        e.preventDefault();
        newSale();
      } else if (e.key === "F9") {
        e.preventDefault();
        if (!submitting) completeSale();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-full">
      <div className="flex-1 min-w-0 flex flex-col">
        <PageHeader
          title="New Sale"
          status={{ tone: "success", label: "Ready" }}
          actions={
            <>
              <button
                onClick={holdSale}
                disabled={items.length === 0}
                title="F2 \u2014 Suspend this sale so you can serve another customer, then resume it later"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-border text-[12px] text-text-dim disabled:opacity-40"
              >
                <Pause size={13} /> Hold (F2)
              </button>
              <button
                onClick={cancelSale}
                disabled={items.length === 0}
                title="F3 \u2014 Discard this sale and clear the till"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-danger/30 text-[12px] text-danger disabled:opacity-40"
              >
                <X size={13} /> Cancel (F3)
              </button>
              <button
                onClick={newSale}
                title="F4 \u2014 Clear the till to start ringing up the next customer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-info text-bg text-[12px] font-medium"
              >
                <RotateCcw size={13} /> New Sale (F4)
              </button>
            </>
          }
        />

        {heldSales.length > 0 && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-[11px] text-text-faint">Held sales:</span>
            {heldSales.map((h) => (
              <button
                key={h.id}
                onClick={() => resumeHeldSale(h.id)}
                className="px-2.5 py-1 rounded-md bg-warning-soft text-warning text-[11px] font-medium"
              >
                {h.heldAt} &middot; {h.label}
              </button>
            ))}
          </div>
        )}

        <div className="card p-4 mb-4">
          <div className="flex items-center gap-1 mb-3 border-b border-border">
            <button
              onClick={() => setTab("fuel")}
              className={`px-3.5 py-2 text-[12.5px] flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${
                tab === "fuel" ? "border-accent text-accent font-medium" : "border-transparent text-text-dim"
              }`}
            >
              <Fuel size={13} /> Fuel
            </button>
            <button
              onClick={() => setTab("shop")}
              className={`px-3.5 py-2 text-[12.5px] flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${
                tab === "shop" ? "border-accent text-accent font-medium" : "border-transparent text-text-dim"
              }`}
            >
              <ShoppingBag size={13} /> Shop Items
            </button>
          </div>

          {tab === "fuel" ? (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div className="sm:col-span-2">
                  <div className="text-[10.5px] text-text-faint uppercase tracking-wide mb-1">Pump / Nozzle</div>
                  <select
                    value={selectedNozzleId ?? ""}
                    onChange={(e) => setSelectedNozzleId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-white/3 border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-accent"
                  >
                    <option value="">Select a pump &amp; nozzle&hellip;</option>
                    {nozzles.map((n) => (
                      <option key={n.id} value={n.id} disabled={n.status === "offline"}>
                        {n.dispenser} &middot; Nozzle {n.nozzleNo ?? "?"} &middot; {n.product}
                        {n.status === "offline" ? " (Offline)" : n.status === "dispensing" ? " (Dispensing now)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-[10.5px] text-text-faint uppercase tracking-wide mb-1">Price / Litre</div>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={priceOverride}
                    onChange={(e) => setPriceOverride(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder={"\u2014"}
                    className="w-full bg-white/3 border border-border rounded-lg px-3 py-2 text-[13px] font-mono-num focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
              <div className="flex items-end gap-2.5">
                <div className="flex-1">
                  <div className="text-[10.5px] text-text-faint uppercase tracking-wide mb-1">Litres to Charge</div>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={fuelLitres}
                    onChange={(e) => setFuelLitres(e.target.value)}
                    placeholder="e.g. 20.00"
                    className="w-full bg-white/3 border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-accent"
                  />
                </div>
                <button
                  onClick={addFuelItem}
                  disabled={!selectedNozzle || fuelPrice === null || !Number(fuelLitres)}
                  className="px-4 py-2 rounded-lg bg-accent text-bg text-[12.5px] font-medium disabled:opacity-40"
                >
                  Add to Sale
                </button>
              </div>
              {nozzles.length === 0 && (
                <p className="text-[11.5px] text-warning mt-2">
                  {nozzlesLoading
                    ? "Loading pumps and nozzles\u2026"
                    : "This station has no pumps or nozzles registered yet \u2014 switch to a station with configured hardware, or add them via Administration."}
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {shopItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => addShopItem(item)}
                  className="rounded-[10px] border border-border hover:border-border-strong bg-white/2 p-3 text-left transition-colors"
                >
                  <div className="text-[12.5px] font-medium truncate">{item.name}</div>
                  <div className="text-[10.5px] text-text-faint">{item.category}</div>
                  <div className="text-[11px] text-accent font-mono-num mt-1">{kes(item.costKes)}</div>
                </button>
              ))}
              {shopItems.length === 0 && (
                <p className="col-span-full text-[11.5px] text-text-faint py-4 text-center">
                  No shop items available right now.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="card flex-1 flex flex-col min-h-0">
          <PanelHeader title="Current Sale Items" />
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-text-faint uppercase tracking-wide">
                  <th className="px-4 py-2 font-medium">#</th>
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 font-medium text-right">Qty</th>
                  <th className="px-4 py-2 font-medium text-right">Price</th>
                  <th className="px-4 py-2 font-medium text-right">Amount</th>
                  <th className="px-4 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i, idx) => (
                  <tr key={i.key} className="border-t border-border">
                    <td className="px-4 py-2.5 text-text-faint">{idx + 1}</td>
                    <td className="px-4 py-2.5 font-medium">{i.product}</td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={i.litres}
                        onChange={(e) => updateItemQuantity(i.key, Math.max(0, Number(e.target.value) || 0))}
                        onFocus={(e) => e.target.select()}
                        className="w-20 bg-white/3 border border-border rounded-md px-2 py-1 text-right font-mono-num text-[12.5px] focus:outline-none focus:border-accent"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-num text-text-dim">{kes(i.price)}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num font-medium">{kes(i.amount)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => removeItem(i.key)} className="text-danger hover:opacity-75">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-text-faint">
                      No items yet &mdash; add fuel or shop items above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-4 py-3 border-t border-border text-[12.5px]">
            <div>
              <div className="text-[10.5px] text-text-faint">Total Litres</div>
              <div className="font-mono-num font-medium">{litres(totalLitres)}</div>
            </div>
            <div>
              <div className="text-[10.5px] text-text-faint">Total Amount</div>
              <div className="font-mono-num font-medium text-success">{kes(subtotal)}</div>
            </div>
            <div>
              <div className="text-[10.5px] text-text-faint">Tax (16%)</div>
              <div className="font-mono-num font-medium">{kes(tax)}</div>
            </div>
            <div>
              <div className="text-[10.5px] text-text-faint">Net Amount</div>
              <div className="font-mono-num font-medium">{kes(subtotal - tax)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[300px] lg:shrink-0 space-y-4 lg:overflow-y-auto lg:pr-1">
        <div className="card p-4">
          <h3 className="text-[13px] font-semibold mb-3">Payment Method</h3>
          <div className="grid grid-cols-3 gap-2 mb-2.5">
            {(
              [
                { id: "Cash", label: "Cash", icon: Banknote },
                { id: "Card", label: "Card", icon: CreditCard },
                { id: "Mobile Money", label: "Mobile Money", icon: Smartphone },
              ] as { id: PaymentMethod; label: string; icon: typeof Banknote }[]
            ).map((m) => {
              const Icon = m.icon;
              const active = payment === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setPayment(m.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-[9px] py-3 text-[10.5px] font-medium border transition-colors ${
                    active ? "border-success bg-success-soft text-success" : "border-border text-text-dim"
                  }`}
                >
                  <Icon size={16} />
                  {m.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setPayment("Fleet Account")}
            className={`w-full flex items-center justify-center gap-1.5 rounded-[9px] py-2.5 text-[11px] font-medium border transition-colors ${
              payment === "Fleet Account" ? "border-info bg-info-soft text-info" : "border-border text-text-dim"
            }`}
          >
            <Building2 size={14} /> Fleet Account
          </button>

          {payment === "Fleet Account" && (
            <div className="mt-2.5">
              <select
                value={fleetAccountId}
                onChange={(e) => setFleetAccountId(e.target.value)}
                className="w-full bg-white/3 border border-border rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:border-accent"
              >
                <option value="">Select fleet account&hellip;</option>
                {fleetAccounts.map((a) => (
                  <option key={a.accountId} value={a.accountId}>
                    {a.name} ({a.accountId})
                  </option>
                ))}
              </select>
              {selectedFleetAccount && (
                <div className="text-[10.5px] text-text-faint mt-1.5 flex justify-between">
                  <span>Balance: {kes(selectedFleetAccount.balanceKes)}</span>
                  <span>Limit: {kes(selectedFleetAccount.creditLimitKes)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card p-4">
          <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-1.5">
            <Star size={13} className="text-accent" /> Loyalty (Optional)
          </h3>
          {selectedLoyaltyMember ? (
            <div className="flex items-center justify-between text-[12px]">
              <div>
                <div className="font-medium">{selectedLoyaltyMember.name}</div>
                <div className="text-text-faint text-[10.5px]">{selectedLoyaltyMember.pointsBalance} pts balance</div>
              </div>
              <button
                onClick={() => {
                  setLoyaltyMemberId(null);
                  setLoyaltyQuery("");
                }}
                className="text-danger text-[11px]"
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <input
                value={loyaltyQuery}
                onChange={(e) => setLoyaltyQuery(e.target.value)}
                placeholder="Search name or phone..."
                className="w-full bg-white/3 border border-border rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:border-accent"
              />
              {matchedLoyaltyMembers.length > 0 && (
                <div className="mt-1.5 space-y-1 max-h-[120px] overflow-y-auto">
                  {matchedLoyaltyMembers.slice(0, 5).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setLoyaltyMemberId(m.id);
                        setLoyaltyQuery("");
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-white/5 text-[12px] flex justify-between"
                    >
                      <span>{m.name}</span>
                      <span className="text-text-faint">{m.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card p-4">
          {payment === "Cash" && (
            <>
              <div className="text-[10.5px] text-text-faint mb-1">Amount Received</div>
              <input
                type="number"
                value={amountReceived}
                onChange={(e) => setAmountReceived(Number(e.target.value) || 0)}
                onFocus={(e) => e.target.select()}
                className="w-full bg-white/3 border border-border rounded-lg px-3 py-2 text-[18px] font-mono-num font-semibold focus:outline-none focus:border-accent mb-3"
              />
              <div className="flex items-center justify-between text-[12.5px] mb-3">
                <span className="text-text-dim">Change</span>
                <span className="font-mono-num font-semibold text-success">{kes(change)}</span>
              </div>
            </>
          )}
          {payment !== "Cash" && (
            <div className="flex items-center justify-between text-[12.5px] mb-3">
              <span className="text-text-dim">Amount to Charge</span>
              <span className="font-mono-num font-semibold text-accent">{kes(total)}</span>
            </div>
          )}
          <button
            onClick={completeSale}
            disabled={submitting}
            title="F9 \u2014 Finalize this sale, charge the payment method selected, and print the receipt"
            className="w-full py-3 rounded-[9px] bg-accent text-bg font-semibold text-[13px] flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <ReceiptIcon size={15} /> {submitting ? "Completing..." : "Complete Sale (F9)"}
          </button>
          {feedback && (
            <div
              className={`mt-3 text-[11.5px] rounded-lg px-3 py-2 border ${
                feedback.type === "success"
                  ? "text-success bg-success-soft border-success/20"
                  : "text-danger bg-danger-soft border-danger/20"
              }`}
            >
              {feedback.message}
            </div>
          )}
        </div>

        <div className="card p-4">
          <h3 className="text-[13px] font-semibold mb-2.5">Transaction Preview</h3>
          <div className="space-y-1.5">
            {items.map((i) => (
              <div key={i.key} className="flex items-center justify-between text-[12px]">
                <span className="text-text-dim">
                  {i.product} <span className="text-text-faint">{i.litres.toFixed(2)}</span>
                </span>
                <span className="font-mono-num">{kes(i.amount)}</span>
              </div>
            ))}
            {items.length === 0 && <p className="text-[11.5px] text-text-faint">No items yet.</p>}
          </div>
          <div className="border-t border-border mt-3 pt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[12px] text-text-dim">
              <span>Subtotal</span>
              <span className="font-mono-num">{kes(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-[12px] text-text-dim">
              <span>Tax</span>
              <span className="font-mono-num">{kes(tax)}</span>
            </div>
            <div className="flex items-center justify-between text-[14px] font-semibold pt-1">
              <span>Total</span>
              <span className="font-mono-num text-accent">{kes(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {receipt && <Receipt data={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}