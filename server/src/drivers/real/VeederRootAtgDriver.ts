import { SerialPort } from "serialport";
import net from "node:net";
import type { AtgDriver, TankTelemetry } from "../types.js";

/**
 * Talks to a Veeder-Root TLS-3xx series tank gauge (TLS-350, TLS-450 etc.),
 * the de-facto standard ATG in most fuel retail markets. The gauge exposes
 * an RS-232 serial port speaking a simple ASCII command/response protocol;
 * on many real installs that serial port is bridged to the network via a
 * serial-to-Ethernet gateway (e.g. a Moxa NPort), which is why this driver
 * supports both a `serial` and a `tcp` transport behind one interface.
 *
 * Protocol notes (verify against YOUR gauge's Serial Interface Manual \u2014
 * exact field widths can shift slightly by firmware revision):
 *   - Commands are ASCII, terminated with \\r (carriage return).
 *   - `I201xx` requests an In-Tank Inventory report for tank `xx`
 *     (`I20100` = "all tanks" on most firmware revisions).
 *   - The gauge responds with one line per tank: a status code, product
 *     name, volume, TC volume, ullage, height, water level, and temperature,
 *     as fixed-width ASCII fields. This driver's `parseInventoryLine` is the
 *     one function you should adjust against your manual if field
 *     boundaries don't line up \u2014 everything else (transport, polling,
 *     reconnect) stays the same regardless of exact byte offsets.
 */

export interface VeederRootConfig {
  transport: "serial" | "tcp";
  // Serial transport
  serialPath?: string; // e.g. "COM3" on Windows, "/dev/ttyUSB0" on Linux
  baudRate?: number; // TLS-3xx default is almost always 9600
  // TCP transport (serial-to-Ethernet gateway)
  host?: string;
  port?: number;
  // Maps this station's tank codes (e.g. "TANK-1") to the gauge's own
  // tank index (e.g. 1) \u2014 the gauge has no idea about our station model.
  tankIndexByCode: Record<string, number>;
  // Maps gauge product names (as printed in the report) to our product
  // names, since gauges are often configured with site-specific labels.
  productNameMap?: Record<string, string>;
}

export class VeederRootAtgDriver implements AtgDriver {
  readonly name = "veeder-root-tls3xx";
  private config: VeederRootConfig;
  private serial: SerialPort | null = null;
  private socket: net.Socket | null = null;
  private buffer = "";
  private lastReport = new Map<number, TankTelemetry>();
  private pendingResolve: (() => void) | null = null;

  constructor(config: VeederRootConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.config.transport === "serial") {
      if (!this.config.serialPath) throw new Error("VeederRootAtgDriver: serialPath is required for serial transport");
      this.serial = new SerialPort({
        path: this.config.serialPath,
        baudRate: this.config.baudRate ?? 9600,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
      });
      this.serial.on("data", (chunk: Buffer) => this.onData(chunk));
      await new Promise<void>((resolve, reject) => {
        this.serial!.once("open", () => resolve());
        this.serial!.once("error", reject);
      });
      return;
    }

    if (!this.config.host || !this.config.port) {
      throw new Error("VeederRootAtgDriver: host and port are required for tcp transport");
    }
    this.socket = new net.Socket();
    this.socket.on("data", (chunk: Buffer) => this.onData(chunk));
    await new Promise<void>((resolve, reject) => {
      this.socket!.connect(this.config.port!, this.config.host!, resolve);
      this.socket!.once("error", reject);
    });
  }

  async disconnect(): Promise<void> {
    this.serial?.close();
    this.socket?.destroy();
  }

  private write(command: string) {
    const line = `${command}\r`;
    if (this.serial) this.serial.write(line);
    else if (this.socket) this.socket.write(line);
  }

  private onData(chunk: Buffer) {
    this.buffer += chunk.toString("ascii");
    // The gauge terminates each report with a line feed; process complete
    // lines as they arrive and hold any partial line for the next chunk.
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (line) this.handleLine(line);
    }
  }

  private handleLine(line: string) {
    const parsed = parseInventoryLine(line, this.config.productNameMap);
    if (!parsed) return; // not a tank-report line (e.g. a command echo) \u2014 ignore
    this.lastReport.set(parsed.tankIndex, parsed.telemetry);

    // Only resolve early once every configured tank has reported in for
    // this round \u2014 resolving on the first line would truncate the
    // result whenever the gauge sends per-tank lines as separate packets
    // instead of one batched write (both happen in practice).
    const expectedIndexes = Object.values(this.config.tankIndexByCode);
    const haveAll = expectedIndexes.every((i) => this.lastReport.has(i));
    if (haveAll) this.pendingResolve?.();
  }

  async poll(): Promise<TankTelemetry[]> {
    this.pendingResolve = null;
    this.write("I20100"); // request inventory for all configured tanks

    // Give the gauge a moment to stream back its report lines before we
    // read whatever we've accumulated. Real gauges typically respond within
    // a few hundred ms; 2s is a safe upper bound without stalling the poll
    // loop noticeably.
    await new Promise<void>((resolve) => {
      this.pendingResolve = resolve;
      setTimeout(resolve, 2000);
    });

    const results: TankTelemetry[] = [];
    for (const [code, tankIndex] of Object.entries(this.config.tankIndexByCode)) {
      const telemetry = this.lastReport.get(tankIndex);
      if (telemetry) results.push({ ...telemetry, code });
    }
    return results;
  }
}

/**
 * Parses one In-Tank Inventory report line into telemetry. This is the part
 * you MUST verify against your gauge's actual output \u2014 grab a real
 * report (e.g. via a terminal program connected to the gauge) and adjust
 * the regex/field slicing to match. The shape below follows the commonly
 * documented TLS-350 fixed-field layout as a starting point, not a
 * guarantee for your specific firmware revision.
 */
function parseInventoryLine(
  line: string,
  productNameMap?: Record<string, string>
): { tankIndex: number; telemetry: TankTelemetry } | null {
  // Expected shape (verify!): "T <tank#> <status> <product...> <volume> <tcVolume> <ullage> <height> <water> <temp>"
  const match = line.match(
    /^T\s*(\d{1,2})\s+([A-Z0]{2})\s+([A-Z0-9 ]{1,20}?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/
  );
  if (!match) return null;

  const [, tankIndexStr, , rawProduct, volumeStr, , , heightStr, waterStr, tempStr] = match;
  const product = productNameMap?.[rawProduct.trim()] ?? rawProduct.trim();

  return {
    tankIndex: Number(tankIndexStr),
    telemetry: {
      code: "", // filled in by the caller from tankIndexByCode
      product,
      volumeL: Number(volumeStr),
      heightMm: Number(heightStr),
      temperatureC: Number(tempStr),
      waterLevelCm: Number(waterStr),
      density: 0.75, // TLS-3xx inventory reports don't include density; pull
      // this from your fuel_prices/product config instead of the gauge.
      atgOnline: true,
    },
  };
}