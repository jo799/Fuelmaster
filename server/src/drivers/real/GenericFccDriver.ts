import net from "node:net";
import type { FccDriver, PumpTelemetry, FillCompleteHandler } from "../types.js";

/**
 * Talks to a forecourt controller (FCC) over TCP.
 *
 * UNLIKE the ATG side, there is no single dominant public protocol here.
 * In practice you'll be integrating with one of:
 *   1. The site's existing FCC/POS box (Gilbarco Passport, Wayne Nucleus,
 *      Verifone Ruby/Commander, Tokheim/DOMS, etc.) via that vendor's own
 *      integration API \u2014 this is the most common real-world path, since
 *      most sites already have one of these controlling the pumps and it's
 *      the thing you actually talk to, not individual pump hardware.
 *   2. The IFSF (International Forecourt Standards Forum) FDC interface \u2014
 *      an open *standard*, but the actual spec documents are member-gated,
 *      not public domain, so this file can't reproduce its exact framing.
 *   3. A vendor-specific serial/RS-485 multidrop protocol for older sites,
 *      similar in spirit to the ATG driver but pump-specific.
 *
 * What this file gives you is the *shape* that's true regardless of which
 * of those you're integrating: a persistent TCP connection, a length- or
 * delimiter-framed message parser, a poll/subscribe loop that produces
 * `PumpTelemetry[]`, and a fill-complete callback. The `encodeCommand` /
 * `parseMessage` pair is what you replace with your vendor's actual framing
 * once you have their protocol document or SDK in hand \u2014 everything else
 * (reconnect handling, the FccDriver contract, how it plugs into the WS
 * gateway) stays identical.
 */

export interface FccConfig {
  host: string;
  port: number;
  // Maps this station's pump names (e.g. "Pump 1") to whatever identifier
  // the FCC uses for that physical dispenser (often a numeric "logical
  // pump number" configured in the FCC itself).
  pumpIdByName: Record<string, number>;
  reconnectDelayMs?: number;
}

type FccMessage =
  | { type: "status"; pumpId: number; status: "dispensing" | "idle" | "offline" | "maintenance"; product: string; litres: number; amountKes: number; flowRate: number }
  | { type: "fill_complete"; pumpId: number; litres: number };

export class GenericFccDriver implements FccDriver {
  readonly name = "generic-fcc-tcp";
  private config: FccConfig;
  private socket: net.Socket | null = null;
  private buffer = Buffer.alloc(0);
  private latest = new Map<number, PumpTelemetry>();
  private onComplete: FillCompleteHandler | null = null;
  private reconnecting = false;

  constructor(config: FccConfig) {
    this.config = config;
    // Seed a baseline snapshot so poll() never returns an empty array just
    // because no status message has arrived yet for a given pump.
    for (const [name, pumpId] of Object.entries(config.pumpIdByName)) {
      this.latest.set(pumpId, {
        name,
        status: "offline",
        product: "Petrol",
        litres: 0,
        amountKes: 0,
        flowRate: 0,
        elapsedSec: 0,
        targetLitres: null,
      });
    }
  }

  async connect(): Promise<void> {
    await this.openSocket();
  }

  private async openSocket(): Promise<void> {
    this.socket = new net.Socket();
    this.socket.on("data", (chunk: Buffer) => this.onData(Buffer.from(chunk)));
    this.socket.on("close", () => this.handleDisconnect());
    this.socket.on("error", () => this.handleDisconnect());

    await new Promise<void>((resolve, reject) => {
      this.socket!.connect(this.config.port, this.config.host, resolve);
      this.socket!.once("error", reject);
    });
  }

  private handleDisconnect() {
    if (this.reconnecting) return;
    this.reconnecting = true;
    const delay = this.config.reconnectDelayMs ?? 3000;
    console.warn(`[fcc-driver] connection lost, reconnecting in ${delay}ms`);
    setTimeout(async () => {
      this.reconnecting = false;
      try {
        await this.openSocket();
        console.log("[fcc-driver] reconnected");
      } catch (err) {
        console.error("[fcc-driver] reconnect failed:", err);
        this.handleDisconnect();
      }
    }, delay);
  }

  async disconnect(): Promise<void> {
    this.socket?.destroy();
  }

  onFillComplete(handler: FillCompleteHandler) {
    this.onComplete = handler;
  }

  /**
   * REPLACE with your vendor's actual command encoding. Many FCC protocols
   * are length-prefixed binary (e.g. a 2-byte length header followed by a
   * payload) or STX/ETX-delimited ASCII \u2014 this is a placeholder using a
   * simple newline-delimited JSON scheme so the rest of the driver has
   * something concrete to compile and run against in the meantime.
   */
  private encodeCommand(cmd: object): Buffer {
    return Buffer.from(JSON.stringify(cmd) + "\n", "utf-8");
  }

  private send(cmd: object) {
    this.socket?.write(this.encodeCommand(cmd));
  }

  /**
   * Most real FCC protocols need an explicit authorize/enable command
   * before a pump will dispense at all (as opposed to our mock, which just
   * starts dispensing on its own). Wire your protocol's actual authorize
   * command into `send()` here once you have it.
   */
  authorizePump(pumpName: string) {
    const pumpId = this.config.pumpIdByName[pumpName];
    if (pumpId === undefined) throw new Error(`GenericFccDriver: unknown pump "${pumpName}"`);
    this.send({ type: "authorize", pumpId });
  }

  /**
   * REPLACE with your vendor's actual message framing/parsing. This
   * placeholder assumes newline-delimited JSON messages matching
   * `FccMessage` above, purely so the driver is runnable end-to-end before
   * you've wired in the real protocol.
   */
  private onData(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf(0x0a)) !== -1) {
      const line = this.buffer.subarray(0, newlineIndex).toString("utf-8").trim();
      this.buffer = this.buffer.subarray(newlineIndex + 1);
      if (!line) continue;
      try {
        this.handleMessage(JSON.parse(line) as FccMessage);
      } catch (err) {
        console.error("[fcc-driver] failed to parse message:", line, err);
      }
    }
  }

  private handleMessage(msg: FccMessage) {
    const name = Object.entries(this.config.pumpIdByName).find(([, id]) => id === msg.pumpId)?.[0];
    if (!name) return; // message for a pump we don't know about \u2014 ignore

    if (msg.type === "status") {
      this.latest.set(msg.pumpId, {
        name,
        status: msg.status,
        product: msg.product,
        litres: msg.litres,
        amountKes: msg.amountKes,
        flowRate: msg.flowRate,
        elapsedSec: this.latest.get(msg.pumpId)?.elapsedSec ?? 0,
        targetLitres: this.latest.get(msg.pumpId)?.targetLitres ?? null,
      });
      return;
    }

    if (msg.type === "fill_complete") {
      const pump = this.latest.get(msg.pumpId);
      if (pump) this.onComplete?.(pump, msg.litres);
    }
  }

  async poll(): Promise<PumpTelemetry[]> {
    // Many real FCCs push status changes proactively rather than needing to
    // be polled (that's why `handleMessage` updates `latest` as messages
    // arrive independent of this call) \u2014 poll() here just returns the
    // freshest known snapshot instead of actively requesting one. If your
    // FCC requires an explicit request/response cycle instead, send that
    // request here and await the corresponding response before returning.
    return Array.from(this.latest.values());
  }
}