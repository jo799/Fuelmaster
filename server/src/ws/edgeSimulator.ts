import "dotenv/config";
import crypto from "node:crypto";
import WebSocket from "ws";
import { pool } from "../db/pool.js";
import { MockFccDriver } from "../drivers/mock/MockFccDriver.js";
import { MockAtgDriver } from "../drivers/mock/MockAtgDriver.js";
import type { PumpTelemetry, TankTelemetry } from "../drivers/types.js";
import { signAccessToken } from "../utils/jwt.js";
import { sha256Hex } from "../utils/hash.js";

/**
 * Simulates live pump/tank telemetry for one or more stations in a single
 * process.
 *
 *   npm run edge:simulate                 -> every station that has at
 *                                             least one pump or tank
 *   npm run edge:simulate -- STN-002      -> just that one station
 *
 * A real deployment would have one physical edge box per site, which is why
 * edgeService.ts (the real-hardware counterpart) still only ever handles a
 * single station per process \u2014 but for demo/dev purposes, requiring a
 * separate terminal window per station just to see every station's pumps
 * move is unnecessary friction. This runs them all concurrently instead.
 *
 * Each station authenticates its own simulated connection with its own
 * edge token (same per-station credential system real hardware daemons
 * use), auto-provisioned here since this is a trusted local dev tool with
 * direct database access \u2014 a real on-site daemon instead gets its token
 * once via POST /api/stations/:id/edge-token/rotate and configures it
 * locally, rather than minting its own.
 */

const WS_PORT = process.env.WS_PORT ?? "4001";
const REQUESTED_STATION_CODE = process.argv[2] ?? process.env.EDGE_STATION_CODE;

const API_URL = `http://localhost:${process.env.PORT ?? "4000"}/api`;
const PRICES: Record<string, number> = { Petrol: 180, Diesel: 165, Kerosene: 150 };

/** Mints a fresh edge token for this station, for this simulator run.
 * Fine for a dev/demo tool to rotate on every start; a real deployment
 * would never run this alongside real hardware for the same station. */
async function provisionEdgeToken(stationId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await pool.query(`UPDATE stations SET edge_token_hash = $1 WHERE id = $2`, [sha256Hex(token), stationId]);
  return token;
}

async function resolveServiceUserId(): Promise<number> {
  const { rows } = await pool.query(`SELECT id FROM users WHERE email = 'edge-service@fuelmaster.dev'`);
  if (rows.length === 0) {
    throw new Error(
      "edge-sim: no 'edge-service@fuelmaster.dev' user found \u2014 re-run `npm run db:seed` to create it."
    );
  }
  return rows[0].id;
}

/** Every station code that has at least one pump or tank worth animating. */
async function resolveStationsToSimulate(): Promise<string[]> {
  if (REQUESTED_STATION_CODE) return [REQUESTED_STATION_CODE];

  const { rows } = await pool.query(
    `SELECT DISTINCT s.code FROM stations s
     WHERE EXISTS (SELECT 1 FROM pumps p WHERE p.station_id = s.id)
        OR EXISTS (SELECT 1 FROM tanks t WHERE t.station_id = s.id)
     ORDER BY s.code`
  );
  return rows.map((r) => r.code);
}

async function loadInitialPumps(stationCode: string): Promise<PumpTelemetry[]> {
  const { rows } = await pool.query(
    `SELECT p.name, p.status, p.product, p.litres::float AS litres, p.amount_kes::float AS "amountKes",
            p.flow_rate::float AS "flowRate", p.elapsed_sec AS "elapsedSec", p.target_litres::float AS "targetLitres"
     FROM pumps p JOIN stations s ON s.id = p.station_id
     WHERE s.code = $1 ORDER BY p.id`,
    [stationCode]
  );
  return rows.map((r) => ({ ...r, targetLitres: r.targetLitres ?? null }));
}

async function loadInitialTanks(stationCode: string): Promise<(TankTelemetry & { capacityL: number })[]> {
  const { rows } = await pool.query(
    `SELECT t.code, t.product, t.volume_l::float AS "volumeL", t.capacity_l::float AS "capacityL",
            t.temperature_c::float AS "temperatureC",
            t.water_level_cm::float AS "waterLevelCm", t.density::float AS density, t.atg_online AS "atgOnline"
     FROM tanks t JOIN stations s ON s.id = t.station_id
     WHERE s.code = $1 ORDER BY t.code`,
    [stationCode]
  );
  return rows;
}

async function resolveStationId(stationCode: string): Promise<number> {
  const { rows } = await pool.query(`SELECT id FROM stations WHERE code = $1`, [stationCode]);
  if (rows.length === 0) throw new Error(`edge-sim: station ${stationCode} not found`);
  return rows[0].id;
}

/**
 * A real edge service authenticates as itself, not as a human user session
 * (which would otherwise silently reassign whichever admin account is used
 * here to this station any time someone is also using it interactively in a
 * browser \u2014 exactly the kind of cross-talk a dedicated service identity
 * avoids). This mints a token scoped to the simulated station directly,
 * using the real "Edge Service" user row so `cashier_id` foreign keys stay
 * valid on every reported sale.
 */
function signServiceToken(stationCode: string, stationId: number, serviceUserId: number) {
  return signAccessToken({
    sub: serviceUserId,
    email: "edge-service@fuelmaster.dev",
    role: "Controller",
    stationId,
    name: `Edge Service (${stationCode})`,
  });
}

async function resolvePumpIds(stationId: number): Promise<Map<string, number>> {
  const { rows } = await pool.query(`SELECT id, name FROM pumps WHERE station_id = $1`, [stationId]);
  return new Map(rows.map((r) => [r.name, r.id]));
}

async function reportCompletedSale(token: string, pump: PumpTelemetry, litres: number, pumpId: number | undefined) {
  const price = PRICES[pump.product] ?? 170;
  try {
    await fetch(`${API_URL}/pos/sale`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        pumpId,
        nozzle: 1,
        items: [{ product: pump.product, litres, price }],
        paymentMethod: "Cash",
      }),
    });
  } catch (err) {
    console.error(`[edge-sim:${pump.name}] failed to report completed sale:`, err);
  }
}

/** Runs one station's simulation forever (until its socket closes). Multiple
 * calls to this run fully independently and concurrently. */
async function simulateStation(stationCode: string, serviceUserId: number): Promise<void> {
  const initialPumps = await loadInitialPumps(stationCode);
  const initialTanks = await loadInitialTanks(stationCode);
  const stationId = await resolveStationId(stationCode);

  console.log(`[edge-sim:${stationCode}] loaded ${initialPumps.length} pumps and ${initialTanks.length} tanks`);
  if (initialPumps.length === 0 && initialTanks.length === 0) {
    console.warn(`[edge-sim:${stationCode}] nothing to simulate \u2014 skipping (no pumps or tanks registered yet)`);
    return;
  }

  const fcc = new MockFccDriver(initialPumps);
  const atg = new MockAtgDriver(initialTanks);
  const reporterToken = signServiceToken(stationCode, stationId, serviceUserId);
  const edgeToken = await provisionEdgeToken(stationId);
  const pumpIdsByName = await resolvePumpIds(stationId);

  await fcc.connect();
  await atg.connect();

  fcc.onFillComplete((pump, litres) => {
    reportCompletedSale(reporterToken, pump, litres, pumpIdsByName.get(pump.name));
  });

  const url = `ws://localhost:${WS_PORT}/ws/edge?token=${encodeURIComponent(edgeToken)}&station=${stationCode}`;
  const socket = new WebSocket(url);

  socket.on("open", () => {
    console.log(`[edge-sim:${stationCode}] connected to telemetry gateway`);

    setInterval(async () => {
      const pumps = await fcc.poll();
      socket.send(JSON.stringify({ type: "pump_update", stationCode, pumps }));
    }, 1000);

    setInterval(async () => {
      const tanks = await atg.poll();
      socket.send(JSON.stringify({ type: "tank_update", stationCode, tanks }));
    }, 5000);
  });

  socket.on("error", (err) => {
    console.error(`[edge-sim:${stationCode}] connection error:`, err.message);
  });

  socket.on("close", () => {
    console.log(`[edge-sim:${stationCode}] disconnected from gateway`);
    fcc.disconnect();
    atg.disconnect();
  });
}

async function main() {
  const serviceUserId = await resolveServiceUserId();
  const stationCodes = await resolveStationsToSimulate();
  // Note: the pool stays open for the life of this process \u2014 each
  // simulateStation() call below needs it to load its own station's pumps
  // and tanks, and since this process runs indefinitely anyway (streaming
  // telemetry forever), there's no natural point to close it early.

  if (stationCodes.length === 0) {
    console.warn("[edge-sim] no stations have any pumps or tanks yet \u2014 nothing to simulate.");
    return;
  }

  console.log(`[edge-sim] starting simulation for: ${stationCodes.join(", ")}`);
  await Promise.all(stationCodes.map((code) => simulateStation(code, serviceUserId)));
}

main().catch((err) => {
  console.error("[edge-sim] fatal error:", err);
  process.exit(1);
});