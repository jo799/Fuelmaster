import type { AtgDriver, TankTelemetry } from "../types.js";
import { volumeToHeightApprox } from "../../utils/strapping.js";

/**
 * Simulates an Automatic Tank Gauge (ATG) — e.g. a Veeder-Root TLS-350 —
 * reporting volume, temperature, water level, and density per probe. A real
 * driver implements the same AtgDriver interface against the actual serial
 * or TCP protocol the gauge speaks, and is a drop-in replacement here.
 */
export class MockAtgDriver implements AtgDriver {
  readonly name = "mock-atg";
  private tanks: TankTelemetry[];
  private capacityByCode = new Map<string, number>();

  constructor(initialTanks: (TankTelemetry & { capacityL?: number })[]) {
    for (const t of initialTanks) {
      if (t.capacityL) this.capacityByCode.set(t.code, t.capacityL);
    }
    this.tanks = initialTanks;
  }

  async connect() {
    /* no-op for the mock; a real driver opens the serial/TCP link to the gauge here */
  }

  async disconnect() {
    /* no-op for the mock */
  }

  async poll(): Promise<TankTelemetry[]> {
    this.tanks = this.tanks.map((t) => {
      // Slow natural drift: tiny random draw-down (dispensing elsewhere on
      // the forecourt) plus thermal noise on temperature. Volume never goes
      // below ~5% so the tank doesn't simulate running bone dry.
      // Scaled to stay consistent with the pump driver's real-world pacing
      // (a station realistically moves maybe 30\u201340L/min *total* across
      // all its pumps, not per tank-poll-tick) \u2014 this poll runs every 5s,
      // so 0\u20130.5L per tick keeps tank depletion roughly in line with what
      // the pumps are actually dispensing instead of draining faster than
      // the visible pump activity would suggest.
      const drawDown = Math.random() * 0.5; // litres this tick
      const nextVolume = Math.max(t.volumeL * 0.05, t.volumeL - drawDown);
      const nextTemp = t.temperatureC + (Math.random() * 0.4 - 0.2);

      // Rare, brief water-level blips (simulating condensation/probe noise)
      // that mostly settle back down — mirrors real ATG behavior enough to
      // exercise the low-stock / water-alarm UI without being alarming.
      const waterDrift = Math.random() < 0.02 ? Math.random() * 0.3 : -0.02;
      const nextWater = Math.max(0, Math.min(2.5, t.waterLevelCm + waterDrift));

      const capacity = this.capacityByCode.get(t.code) ?? 20000;
      const heightMm = volumeToHeightApprox(capacity, nextVolume);

      return {
        ...t,
        volumeL: nextVolume,
        heightMm,
        temperatureC: Math.round(nextTemp * 10) / 10,
        waterLevelCm: Math.round(nextWater * 10) / 10,
      };
    });

    return this.tanks;
  }
}