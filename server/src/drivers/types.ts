/**
 * Driver contracts for forecourt hardware.
 *
 * This mirrors the Waspan driver-core pattern: define the interface once,
 * ship a mock implementation for local dev, and let real hardware drivers
 * (IFSF/OPT for FCCs, TLS-350 serial/TCP for Veeder-Root ATGs, etc.) plug in
 * later as drop-in replacements — the edge service and everything upstream
 * of it (WS gateway, backend, frontend) never needs to change.
 */

export interface PumpTelemetry {
  name: string;
  status: "dispensing" | "idle" | "offline" | "maintenance";
  product: string;
  litres: number;
  amountKes: number;
  flowRate: number;
  elapsedSec: number;
  targetLitres: number | null;
}

export interface TankTelemetry {
  code: string;
  product: string;
  volumeL: number;
  temperatureC: number;
  waterLevelCm: number;
  density: number;
  atgOnline: boolean;
}

/** Fires when a fill completes, so the caller can report it as a real sale. */
export type FillCompleteHandler = (pump: PumpTelemetry, litres: number) => void;

export interface FccDriver {
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Advance simulated/polled state by one tick and return the current snapshot. */
  poll(): Promise<PumpTelemetry[]>;
  onFillComplete(handler: FillCompleteHandler): void;
}

export interface AtgDriver {
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  poll(): Promise<TankTelemetry[]>;
}
