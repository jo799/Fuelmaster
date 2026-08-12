import "dotenv/config";
import WebSocket from "ws";
import { pool } from "../db/pool.js";
import { VeederRootAtgDriver } from "../drivers/real/VeederRootAtgDriver.js";
import { GenericFccDriver } from "../drivers/real/GenericFccDriver.js";
import { signAccessToken } from "../utils/jwt.js";
import type { FccDriver, AtgDriver } from "../drivers/types.js";

/**
 * This is edgeSimulator.ts's real-hardware sibling. Compare the two files
 * side by side: the WS connection, polling loop, and sale-reporting logic
 * are IDENTICAL \u2014 the only difference is which driver classes get
 * constructed. That's the entire point of the FccDriver/AtgDriver interface:
 * swapping simulated hardware for real hardware is a change contained to
 * this one file (plus writing the real driver classes themselves, in
 * src/drivers/real/), not a change to the WS gateway, the backend API, or
 * the frontend \u2014 none of those care whether the telemetry they're
 * receiving originated from a mock tick loop or a real serial cable.
 *
 * Run one instance of this per physical station, same as the simulator:
 *   npm run edge:live -- STN-001
 */

const WS_PORT = process.env.WS_PORT ?? "4001";
// Each station's daemon presents its OWN credential (obtained once via
// POST /api/stations/:id/edge-token/rotate as an Administrator, then
// configured here) rather than a secret shared across every station.
const EDGE_TOKEN = process.env.EDGE_STATION_TOKEN;
const STATION_CODE = process.argv[2] ?? process.env.EDGE_STATION_CODE ?? "STN-001";
const API_URL = `http://localhost:${process.env.PORT ?? "4000"}/api`;
// Set EDGE_WS_HOST/EDGE_WS_TLS if this daemon reaches the gateway over the
// network rather than on the same machine (e.g. localhost during initial
// setup, then the real gateway host once deployed on-site).
const WS_HOST = process.env.EDGE_WS_HOST ?? "localhost";
const WS_SCHEME = process.env.EDGE_WS_TLS === "true" ? "wss" : "ws";
const PRICES: Record<string, number> = { Petrol: 180, Diesel: 165, Kerosene: 150 };

async function resolveStationId(): Promise<number> {
  const { rows } = await pool.query(`SELECT id FROM stations WHERE code = $1`, [STATION_CODE]);
  if (rows.length === 0) throw new Error(`edge-service: station ${STATION_CODE} not found`);
  return rows[0].id;
}

async function resolveServiceUserId(): Promise<number> {
  const { rows } = await pool.query(`SELECT id FROM users WHERE email = 'edge-service@fuelmaster.dev'`);
  if (rows.length === 0) {
    throw new Error("edge-service: no 'edge-service@fuelmaster.dev' user found \u2014 run `npm run db:seed`.");
  }
  return rows[0].id;
}

function signServiceToken(stationId: number, serviceUserId: number) {
  return signAccessToken({
    sub: serviceUserId,
    email: "edge-service@fuelmaster.dev",
    role: "Controller",
    stationId,
    name: `Edge Service (${STATION_CODE})`,
  });
}

async function reportCompletedSale(token: string, product: string, litres: number, pumpId: number | undefined) {
  const price = PRICES[product] ?? 170;
  try {
    await fetch(`${API_URL}/pos/sale`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pumpId, nozzle: 1, items: [{ product, litres, price }], paymentMethod: "Cash" }),
    });
  } catch (err) {
    console.error("[edge-service] failed to report completed sale:", err);
  }
}

/**
 * Reads real-hardware connection details from environment variables so
 * nothing about the target IP/serial port/pump mapping is hardcoded here.
 * See the .env additions in this file's accompanying notes for the full
 * variable list.
 */
function buildFccDriver(): FccDriver {
  const pumpMapRaw = process.env.FCC_PUMP_MAP; // e.g. '{"Pump 1":1,"Pump 2":2}'
  if (!process.env.FCC_HOST || !process.env.FCC_PORT || !pumpMapRaw) {
    throw new Error(
      "edge-service: FCC_HOST, FCC_PORT, and FCC_PUMP_MAP must be set to use the real FCC driver."
    );
  }
  return new GenericFccDriver({
    host: process.env.FCC_HOST,
    port: Number(process.env.FCC_PORT),
    pumpIdByName: JSON.parse(pumpMapRaw),
  });
}

function buildAtgDriver(): AtgDriver {
  const tankMapRaw = process.env.ATG_TANK_MAP; // e.g. '{"TANK-1":1,"TANK-2":2}'
  if (!tankMapRaw) {
    throw new Error("edge-service: ATG_TANK_MAP must be set to use the real ATG driver.");
  }
  const transport = (process.env.ATG_TRANSPORT as "serial" | "tcp") ?? "serial";

  if (transport === "tcp") {
    if (!process.env.ATG_HOST || !process.env.ATG_PORT) {
      throw new Error("edge-service: ATG_HOST and ATG_PORT must be set for ATG_TRANSPORT=tcp.");
    }
    return new VeederRootAtgDriver({
      transport: "tcp",
      host: process.env.ATG_HOST,
      port: Number(process.env.ATG_PORT),
      tankIndexByCode: JSON.parse(tankMapRaw),
    });
  }

  if (!process.env.ATG_SERIAL_PATH) {
    throw new Error("edge-service: ATG_SERIAL_PATH must be set for ATG_TRANSPORT=serial (e.g. COM3 or /dev/ttyUSB0).");
  }
  return new VeederRootAtgDriver({
    transport: "serial",
    serialPath: process.env.ATG_SERIAL_PATH,
    baudRate: process.env.ATG_BAUD_RATE ? Number(process.env.ATG_BAUD_RATE) : 9600,
    tankIndexByCode: JSON.parse(tankMapRaw),
  });
}

async function main() {
  if (!EDGE_TOKEN) {
    console.error(
      `EDGE_STATION_TOKEN is not set in .env. Generate one as an Administrator via ` +
        `POST /api/stations/${"{id}"}/edge-token/rotate, then set EDGE_STATION_TOKEN to the returned value.`
    );
    process.exit(1);
  }

  const stationId = await resolveStationId();
  const serviceUserId = await resolveServiceUserId();
  const pumpRows = await pool.query(`SELECT id, name FROM pumps WHERE station_id = $1`, [stationId]);
  const pumpIdsByName = new Map<string, number>(pumpRows.rows.map((r) => [r.name, r.id]));
  await pool.end();

  const fcc = buildFccDriver();
  const atg = buildAtgDriver();
  const reporterToken = signServiceToken(stationId, serviceUserId);

  console.log(`[edge-service] connecting to real hardware for ${STATION_CODE}...`);
  await fcc.connect();
  await atg.connect();
  console.log(`[edge-service] connected \u2014 FCC via ${fcc.name}, ATG via ${atg.name}`);

  fcc.onFillComplete((pump, litres) => {
    reportCompletedSale(reporterToken, pump.product, litres, pumpIdsByName.get(pump.name));
  });

  const url = `${WS_SCHEME}://${WS_HOST}:${WS_PORT}/ws/edge?token=${encodeURIComponent(EDGE_TOKEN)}&station=${STATION_CODE}`;
  const socket = new WebSocket(url);

  socket.on("open", () => {
    console.log(`[edge-service] connected to telemetry gateway as ${STATION_CODE}`);

    setInterval(async () => {
      const pumps = await fcc.poll();
      socket.send(JSON.stringify({ type: "pump_update", stationCode: STATION_CODE, pumps }));
    }, 1000);

    setInterval(async () => {
      const tanks = await atg.poll();
      socket.send(JSON.stringify({ type: "tank_update", stationCode: STATION_CODE, tanks }));
    }, 5000);
  });

  socket.on("error", (err) => console.error("[edge-service] gateway connection error:", err.message));
  socket.on("close", () => {
    console.log("[edge-service] disconnected from gateway");
    fcc.disconnect();
    atg.disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[edge-service] fatal error:", err);
  process.exit(1);
});