import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const tanksRouter = Router();
tanksRouter.use(requireAuth);

tanksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT t.code AS id, t.product,
              t.capacity_l::float AS capacity, t.volume_l::float AS volume,
              t.height_mm::float AS "heightMm",
              t.temperature_c::float AS temperature, t.water_level_cm::float AS "waterLevel",
              t.density::float AS density, t.atg_online AS "atgOnline", t.status,
              GREATEST(1, FLOOR((t.volume_l - t.capacity_l * 0.2) / NULLIF(t.capacity_l * 0.08, 0)))::int AS "refillDays",
              GREATEST(1, FLOOR(t.volume_l / NULLIF(t.capacity_l * 0.08, 0)))::int AS "emptyDays",
              EXISTS(SELECT 1 FROM tank_strapping_points sp WHERE sp.tank_id = t.id) AS "hasStrappingTable"
       FROM tanks t WHERE t.station_id = $1 ORDER BY t.code`,
      [stationId]
    );
    res.json(rows);
  })
);

const DEFAULT_DENSITY: Record<string, number> = {
  Petrol: 0.745,
  Diesel: 0.842,
  Kerosene: 0.819,
  LPG: 1.912,
};

const newTankSchema = z.object({
  product: z.enum(["Petrol", "Diesel", "Kerosene", "LPG"]),
  capacity: z.number().positive(),
  initialVolume: z.number().min(0).optional(),
});

tanksRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = newTankSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid tank payload");
    const stationId = req.user!.stationId;
    const { product, capacity } = parsed.data;
    const initialVolume = Math.min(parsed.data.initialVolume ?? capacity * 0.5, capacity);

    const seq = await pool.query(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\\D', '', 'g'), '')::int), 0) + 1 AS next
       FROM tanks WHERE station_id = $1`,
      [stationId]
    );
    const code = `TANK-${seq.rows[0].next}`;

    const { rows } = await pool.query(
      `INSERT INTO tanks (station_id, code, product, capacity_l, volume_l, temperature_c, water_level_cm, density, atg_online, status)
       VALUES ($1,$2,$3,$4,$5,24,0,$6,true,'healthy') RETURNING code AS id`,
      [stationId, code, product, capacity, initialVolume, DEFAULT_DENSITY[product] ?? 0.8]
    );

    res.status(201).json(rows[0]);
  })
);

/**
 * Real height-to-volume calibration for a tank, entered once from the
 * tank manufacturer's strapping certificate. Once at least 2 points exist,
 * this becomes the authoritative source for volume \u2014 see heightToVolume()
 * in utils/strapping.ts and its use in telemetryServer.ts.
 */
tanksRouter.get(
  "/:code/strapping",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const tank = await pool.query(`SELECT id FROM tanks WHERE station_id = $1 AND code = $2`, [
      stationId,
      req.params.code,
    ]);
    if (tank.rows.length === 0) throw new HttpError(404, "Tank not found");

    const { rows } = await pool.query(
      `SELECT height_mm::float AS "heightMm", volume_l::float AS "volumeL"
       FROM tank_strapping_points WHERE tank_id = $1 ORDER BY height_mm`,
      [tank.rows[0].id]
    );
    res.json(rows);
  })
);

const strappingPointsSchema = z.object({
  points: z.array(z.object({ heightMm: z.number().min(0), volumeL: z.number().min(0) })).min(2),
});

tanksRouter.put(
  "/:code/strapping",
  requireRole("Administrator", "Controller"),
  asyncHandler(async (req, res) => {
    const parsed = strappingPointsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "A strapping table needs at least 2 points");
    }
    const stationId = req.user!.stationId;
    const tank = await pool.query(`SELECT id FROM tanks WHERE station_id = $1 AND code = $2`, [
      stationId,
      req.params.code,
    ]);
    if (tank.rows.length === 0) throw new HttpError(404, "Tank not found");
    const tankId = tank.rows[0].id;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM tank_strapping_points WHERE tank_id = $1`, [tankId]);
      for (const p of parsed.data.points) {
        await client.query(
          `INSERT INTO tank_strapping_points (tank_id, height_mm, volume_l) VALUES ($1,$2,$3)`,
          [tankId, p.heightMm, p.volumeL]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    res.status(201).json({ ok: true, points: parsed.data.points.length });
  })
);

tanksRouter.delete(
  "/:code/strapping",
  requireRole("Administrator", "Controller"),
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const tank = await pool.query(`SELECT id FROM tanks WHERE station_id = $1 AND code = $2`, [
      stationId,
      req.params.code,
    ]);
    if (tank.rows.length === 0) throw new HttpError(404, "Tank not found");
    await pool.query(`DELETE FROM tank_strapping_points WHERE tank_id = $1`, [tank.rows[0].id]);
    res.status(204).end();
  })
);

tanksRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;

    const totals = await pool.query(
      `SELECT COUNT(*)::int AS "totalTanks",
              COALESCE(SUM(t.capacity_l), 0)::float AS "totalCapacity",
              COALESCE(SUM(t.volume_l), 0)::float AS "totalVolume",
              COALESCE(SUM(t.volume_l * COALESCE(fp.current_price, 0)), 0)::float AS "totalValue",
              COUNT(*) FILTER (WHERE t.water_level_cm >= 1)::int AS "waterDetectedCount",
              COUNT(*) FILTER (WHERE t.atg_online)::int AS "atgOnlineCount",
              COUNT(*) FILTER (WHERE t.status != 'offline')::int AS "activeTanks",
              MAX(t.updated_at) AS "lastSync"
       FROM tanks t
       LEFT JOIN fuel_prices fp ON fp.station_id = t.station_id AND fp.fuel_name ILIKE '%' || t.product || '%'
       WHERE t.station_id = $1`,
      [stationId]
    );

    const controllers = await pool.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'online')::int AS online
       FROM controllers WHERE station_id = $1`,
      [stationId]
    );

    const row = totals.rows[0];
    const lastSync: Date | null = row.lastSync;
    res.json({
      totalTanks: row.totalTanks,
      totalCapacity: row.totalCapacity,
      totalVolume: row.totalVolume,
      totalValue: row.totalValue,
      waterDetectedCount: row.waterDetectedCount,
      atgOnlineCount: row.atgOnlineCount,
      activeTanks: row.activeTanks,
      controllersOnline: controllers.rows[0].online,
      controllersTotal: controllers.rows[0].total,
      lastSync: lastSync ? lastSync.toISOString() : null,
      // Honest, not invented: real elapsed time since the most recent
      // telemetry update actually landed, not a hardcoded "<2s" claim.
      dataLatencySeconds: lastSync ? Math.max(0, Math.round((Date.now() - lastSync.getTime()) / 1000)) : null,
    });
  })
);

const RANGE_DAYS: Record<string, number> = { "7D": 7, "1M": 30, "3M": 90 };

tanksRouter.get(
  "/history",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const range = typeof req.query.range === "string" && RANGE_DAYS[req.query.range] ? req.query.range : "7D";
    const days = RANGE_DAYS[range];

    const tanks = await pool.query(`SELECT id, code FROM tanks WHERE station_id = $1 ORDER BY code`, [stationId]);
    if (tanks.rows.length === 0) return res.json({ series: [], tanks: [] });

    const raw = await pool.query(
      `SELECT to_char(h.recorded_at, 'Mon DD') AS d, t.code,
              ROUND(AVG(h.volume_l / NULLIF(h.capacity_l, 0) * 100)::numeric, 1)::float AS pct
       FROM tank_readings_history h
       JOIN tanks t ON t.id = h.tank_id
       WHERE t.station_id = $1 AND h.recorded_at >= now() - ($2 || ' days')::interval
       GROUP BY to_char(h.recorded_at, 'Mon DD'), date_trunc('day', h.recorded_at), t.code
       ORDER BY date_trunc('day', h.recorded_at)`,
      [stationId, days]
    );

    const tankCodes = tanks.rows.map((t) => t.code);
    const days_ = Array.from(new Set(raw.rows.map((r) => r.d)));
    const series = days_.map((d) => {
      const point: Record<string, string | number> = { d };
      for (const code of tankCodes) {
        const match = raw.rows.find((r) => r.d === d && r.code === code);
        if (match) point[code] = match.pct;
      }
      return point;
    });

    res.json({ series, tanks: tankCodes });
  })
);