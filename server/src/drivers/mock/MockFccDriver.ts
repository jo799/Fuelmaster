import type { FccDriver, PumpTelemetry, FillCompleteHandler } from "../types.js";

const PRICES: Record<string, number> = { Petrol: 180, Diesel: 165, Kerosene: 150 };
const PRODUCTS = ["Petrol", "Diesel", "Kerosene"];

/**
 * Simulates a forecourt controller (FCC) speaking to N pumps. Real drivers
 * (Gilbarco/Wayne IFSF, Tatsuno, etc.) implement the same FccDriver interface
 * against actual pump hardware instead of this in-memory tick loop.
 */
export class MockFccDriver implements FccDriver {
  readonly name = "mock-fcc";
  private pumps: PumpTelemetry[];
  private onComplete: FillCompleteHandler | null = null;

  constructor(initialPumps: PumpTelemetry[]) {
    this.pumps = initialPumps;
  }

  async connect() {
    /* no-op for the mock; a real driver would open a serial/TCP connection here */
  }

  async disconnect() {
    /* no-op for the mock */
  }

  onFillComplete(handler: FillCompleteHandler) {
    this.onComplete = handler;
  }

  async poll(): Promise<PumpTelemetry[]> {
    const dispensingCount = this.pumps.filter((p) => p.status === "dispensing").length;
    const idle = this.pumps.filter((p) => p.status === "idle");
    // Real-world pacing: poll() runs once per second, and this is the
    // per-idle-pump chance *each second* that a new customer pulls up.
    // 0.004 gives an average wait of ~1/0.004 = 250s (~4 minutes) before any
    // *specific* idle pump gets used \u2014 with several idle pumps at once,
    // the station as a whole sees a new fill start every minute or so, which
    // is a reasonably busy (not frantic) forecourt. The old value of 0.15
    // gave an average 6.7-*second* wait per pump, which is why it felt like
    // a constant blur of transactions rather than real customer traffic.
    const startNew = dispensingCount < 3 && idle.length > 0 && Math.random() < 0.004;
    const startTarget = startNew ? idle[Math.floor(Math.random() * idle.length)] : null;

    this.pumps = this.pumps.map((p) => {
      if (p === startTarget) {
        const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
        return {
          ...p,
          status: "dispensing",
          product,
          litres: 0,
          amountKes: 0,
          elapsedSec: 0,
          // Real retail dispensers typically flow at ~25\u201345 L/min
          // (many jurisdictions cap nozzle flow in this band for safety).
          flowRate: 25 + Math.random() * 20,
          // A partial-to-full car tank top-up is commonly 20\u201350L.
          targetLitres: 20 + Math.random() * 30,
        };
      }

      if (p.status !== "dispensing") return p;

      // Small tick-to-tick flow variation (a real nozzle isn't perfectly
      // constant), floored at 20 L/min to stay in the realistic band above
      // rather than the old 60 L/min floor left over from the faster pacing.
      const flow = Math.max(20, p.flowRate + (Math.random() * 4 - 2));
      const litresPerTick = flow / 60;
      const price = PRICES[p.product] ?? 170;
      const nextLitres = p.litres + litresPerTick;
      const target = p.targetLitres ?? 30;

      if (nextLitres >= target) {
        this.onComplete?.(p, nextLitres);
        return { ...p, status: "idle", litres: 0, amountKes: 0, flowRate: 0, elapsedSec: 0, targetLitres: null };
      }

      return {
        ...p,
        flowRate: flow,
        litres: nextLitres,
        amountKes: p.amountKes + litresPerTick * price,
        elapsedSec: p.elapsedSec + 1,
      };
    });

    return this.pumps;
  }
}