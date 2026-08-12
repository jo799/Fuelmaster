import { WebSocketServer, WebSocket } from "ws";
import https from "node:https";
import fs from "node:fs";
import { pool } from "../db/pool.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { sha256Hex } from "../utils/hash.js";
import { notify } from "../services/notifications.js";
import { heightToVolume } from "../utils/strapping.js";

interface PumpFrame {
  name: string;
  status: "dispensing" | "idle" | "offline" | "maintenance";
  product: string;
  litres: number;
  amountKes: number;
  flowRate: number;
  elapsedSec: number;
  targetLitres?: number | null;
}

interface TankFrame {
  code: string;
  product: string;
  volumeL: number;
  heightMm?: number;
  temperatureC: number;
  waterLevelCm: number;
  density: number;
  atgOnline: boolean;
}

type EdgeMessage =
  | { type: "pump_update"; stationCode: string; pumps: PumpFrame[] }
  | { type: "tank_update"; stationCode: string; tanks: TankFrame[] };

// stationId -> set of subscribed dashboard sockets
const dashboardSubscribers = new Map<number, Set<WebSocket>>();

function subscribe(stationId: number, socket: WebSocket) {
  if (!dashboardSubscribers.has(stationId)) dashboardSubscribers.set(stationId, new Set());
  dashboardSubscribers.get(stationId)!.add(socket);
}

function unsubscribe(stationId: number, socket: WebSocket) {
  dashboardSubscribers.get(stationId)?.delete(socket);
}

function broadcast(stationId: number, payload: object) {
  const subs = dashboardSubscribers.get(stationId);
  if (!subs || subs.size === 0) return;
  const json = JSON.stringify(payload);
  for (const sock of subs) {
    if (sock.readyState === WebSocket.OPEN) sock.send(json);
  }
}

async function fetchPumps(stationId: number) {
  const { rows } = await pool.query(
    `SELECT id, name, status, active_nozzle AS nozzle, product,
            litres::float AS litres, amount_kes::float AS "amountKes",
            flow_rate::float AS "flowRate", target_litres::float AS "targetLitres",
            elapsed_sec AS "elapsedSec", pos_x::float AS x, pos_y::float AS y,
            (SELECT code FROM controllers c WHERE c.id = pumps.controller_id) AS controller
     FROM pumps WHERE station_id = $1 ORDER BY id`,
    [stationId]
  );
  return rows;
}

async function fetchTanks(stationId: number) {
  const { rows } = await pool.query(
    `SELECT code AS id, product,
            capacity_l::float AS capacity, volume_l::float AS volume,
            temperature_c::float AS temperature, water_level_cm::float AS "waterLevel",
            density::float AS density, atg_online AS "atgOnline", status,
            GREATEST(1, FLOOR((volume_l - capacity_l * 0.2) / NULLIF(capacity_l * 0.08, 0)))::int AS "refillDays",
            GREATEST(1, FLOOR(volume_l / NULLIF(capacity_l * 0.08, 0)))::int AS "emptyDays"
     FROM tanks WHERE station_id = $1 ORDER BY code`,
    [stationId]
  );
  return rows;
}

async function applyPumpUpdate(stationId: number, pumps: PumpFrame[]) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const p of pumps) {
      await client.query(
        `UPDATE pumps SET status = $1, product = $2, litres = $3, amount_kes = $4,
                flow_rate = $5, elapsed_sec = $6, target_litres = $7, updated_at = now()
         WHERE station_id = $8 AND name = $9`,
        [p.status, p.product, p.litres, p.amountKes, p.flowRate, p.elapsedSec, p.targetLitres ?? null, stationId, p.name]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function tankStatus(volumeL: number, capacityL: number, waterLevelCm: number): string {
  if (waterLevelCm >= 1) return "warning";
  if (volumeL / capacityL < 0.2) return "critical";
  if (volumeL / capacityL < 0.35) return "warning";
  return "healthy";
}

async function applyTankUpdate(stationId: number, tanks: TankFrame[]) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const t of tanks) {
      const existing = await client.query(
        `SELECT id, capacity_l::float AS capacity, status FROM tanks WHERE station_id = $1 AND code = $2`,
        [stationId, t.code]
      );
      const tankId = existing.rows[0]?.id;
      const capacity = existing.rows[0]?.capacity ?? t.volumeL;
      const previousStatus = existing.rows[0]?.status;

      // If this tank has a real strapping table on file, that calibration
      // is authoritative over whatever volume the gauge itself reported \u2014
      // a technician-verified strapping table is generally more trustworthy
      // than an uncalibrated probe's own volume estimate. Without one, we
      // just use whatever volume came in (the gauge's own figure, or the
      // mock driver's simulated drift).
      let volumeL = t.volumeL;
      if (tankId && t.heightMm !== undefined) {
        const strapped = await heightToVolume(tankId, t.heightMm);
        if (strapped > 0) volumeL = strapped;
      }

      const status = tankStatus(volumeL, capacity, t.waterLevelCm);
      await client.query(
        `UPDATE tanks SET volume_l = $1, height_mm = $2, temperature_c = $3, water_level_cm = $4,
                density = $5, atg_online = $6, status = $7, updated_at = now()
         WHERE station_id = $8 AND code = $9`,
        [volumeL, t.heightMm ?? null, t.temperatureC, t.waterLevelCm, t.density, t.atgOnline, status, stationId, t.code]
      );

      // Snapshot into history for the real "Levels Over Time" trend chart,
      // but only once every 15 minutes per tank \u2014 telemetry itself
      // updates every few seconds, which would make this table grow
      // unboundedly if we snapshotted on every poll.
      if (tankId) {
        const recent = await client.query(
          `SELECT 1 FROM tank_readings_history WHERE tank_id = $1 AND recorded_at > now() - interval '15 minutes' LIMIT 1`,
          [tankId]
        );
        if (recent.rows.length === 0) {
          await client.query(
            `INSERT INTO tank_readings_history (tank_id, volume_l, capacity_l) VALUES ($1,$2,$3)`,
            [tankId, volumeL, capacity]
          );
        }
      }

      // Only fire on the transition INTO critical, not on every 5s poll
      // while it stays there \u2014 otherwise this would spam a notification
      // roughly every 5 seconds for as long as the tank stays low.
      if (status === "critical" && previousStatus !== "critical") {
        const pct = Math.round((volumeL / capacity) * 100);
        notify({
          stationId,
          event: "lowFuelAlerts",
          title: `Low fuel: ${t.code}`,
          message: `${t.code} (${t.product}) has dropped to ${pct}% capacity (${Math.round(volumeL)} L remaining).`,
          severity: "danger",
        }).catch((err) => console.error("[telemetry] low-fuel notify failed:", err.message));
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

interface AuthResult {
  ok: boolean;
  status?: number;
  message?: string;
  kind?: "dashboard" | "edge";
  stationId?: number;
  stationCode?: string;
}

/**
 * Runs during the HTTP upgrade handshake itself (via verifyClient below),
 * before any WebSocket connection is established. This matters: the `ws`
 * library's default behavior completes the handshake and only THEN fires
 * `connection`, meaning an auth check done inside `connection` (as this used
 * to be structured) briefly hands an unauthorized client a fully-established
 * socket before closing it. Verifying here instead means a bad token gets a
 * proper HTTP 401/403 on the upgrade request and never gets a socket at all.
 */
async function verifyConnection(req: import("http").IncomingMessage): Promise<AuthResult> {
  const url = new URL(req.url ?? "", "http://localhost");

  if (url.pathname === "/ws/dashboard") {
    const token = url.searchParams.get("token");
    try {
      const stationId = token ? verifyAccessToken(token).stationId : null;
      if (!stationId) return { ok: false, status: 401, message: "Missing or invalid token" };
      return { ok: true, kind: "dashboard", stationId };
    } catch {
      return { ok: false, status: 401, message: "Invalid token" };
    }
  }

  if (url.pathname === "/ws/edge") {
    const token = url.searchParams.get("token");
    const stationCode = url.searchParams.get("station");
    if (!token || !stationCode) return { ok: false, status: 401, message: "Unauthorized edge connection" };

    const { rows } = await pool.query(`SELECT id, edge_token_hash FROM stations WHERE code = $1`, [stationCode]);
    const station = rows[0];
    if (!station) return { ok: false, status: 404, message: "Unknown station code" };

    // Each station authenticates its edge daemon with its own credential
    // (generated via POST /api/stations/:id/edge-token/rotate) rather than
    // one secret shared across every station \u2014 compromising one
    // station's daemon can't be used to impersonate telemetry for any
    // other station.
    if (!station.edge_token_hash || sha256Hex(token) !== station.edge_token_hash) {
      return { ok: false, status: 403, message: "Unauthorized edge connection" };
    }
    return { ok: true, kind: "edge", stationId: station.id, stationCode };
  }

  return { ok: false, status: 404, message: "Unknown path" };
}

export function startTelemetryServer(port: number) {
  const certPath = process.env.TLS_CERT_PATH;
  const keyPath = process.env.TLS_KEY_PATH;
  const isProd = process.env.NODE_ENV === "production";

  // Stash each request's verified auth result here, keyed by the request
  // object itself, so the `connection` handler doesn't need to re-verify
  // (and can't accidentally diverge from what verifyClient already decided).
  const verifiedAuth = new WeakMap<import("http").IncomingMessage, AuthResult>();

  function verifyClient(
    info: { req: import("http").IncomingMessage },
    callback: (verified: boolean, code?: number, message?: string) => void
  ) {
    verifyConnection(info.req).then((result) => {
      if (result.ok) {
        verifiedAuth.set(info.req, result);
        callback(true);
      } else {
        callback(false, result.status ?? 401, result.message ?? "Unauthorized");
      }
    });
  }

  let wss: WebSocketServer;
  if (certPath && keyPath) {
    const httpsServer = https.createServer({
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    });
    wss = new WebSocketServer({ server: httpsServer, verifyClient });
    httpsServer.listen(port);
    console.log(`[telemetry] WSS (TLS) gateway listening on :${port}`);
  } else {
    wss = new WebSocketServer({ port, verifyClient });
    if (isProd) {
      console.warn(
        "[telemetry] WARNING: no TLS_CERT_PATH/TLS_KEY_PATH configured \u2014 serving plain ws:// on the edge " +
          "channel. This is fine if a reverse proxy in front of this process terminates TLS; it is NOT fine if " +
          "edge daemons connect to this port directly over the public internet."
      );
    }
  }

  wss.on("connection", async (socket, req) => {
    const auth = verifiedAuth.get(req);
    if (!auth) {
      // Shouldn't happen \u2014 verifyClient rejects anything that gets here
      // without a result \u2014 but fail closed if it somehow does.
      socket.close(4000, "Unverified connection");
      return;
    }

    if (auth.kind === "dashboard") {
      const stationId = auth.stationId!;
      subscribe(stationId, socket);
      // Send an immediate snapshot of both channels on connect.
      fetchPumps(stationId).then((pumps) => socket.send(JSON.stringify({ type: "pumps", pumps })));
      fetchTanks(stationId).then((tanks) => socket.send(JSON.stringify({ type: "tanks", tanks })));

      socket.on("close", () => unsubscribe(stationId, socket));
      return;
    }

    if (auth.kind === "edge") {
      const stationId = auth.stationId!;
      const stationCode = auth.stationCode!;
      console.log(`[telemetry] edge service connected for ${stationCode}`);

      socket.on("message", async (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as EdgeMessage;

          if (msg.type === "pump_update") {
            await applyPumpUpdate(stationId, msg.pumps);
            const pumps = await fetchPumps(stationId);
            broadcast(stationId, { type: "pumps", pumps });
            return;
          }

          if (msg.type === "tank_update") {
            await applyTankUpdate(stationId, msg.tanks);
            const tanks = await fetchTanks(stationId);
            broadcast(stationId, { type: "tanks", tanks });
            return;
          }
        } catch (err) {
          console.error("[telemetry] failed to process edge message", err);
        }
      });

      socket.on("close", () => {
        console.log(`[telemetry] edge service disconnected for ${stationCode}`);
      });
      return;
    }

    socket.close(4000, "Unknown WS path");
  });

  console.log(`[telemetry] WebSocket gateway listening on :${port}`);
  return wss;
}