import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const controllersRouter = Router();
controllersRouter.use(requireAuth);

controllersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT c.code AS id, s.name AS station, c.model, c.status,
              c.pumps_total AS pumps, c.pumps_online AS "pumpsOnline",
              c.dispensers, c.nozzles,
              (c.uptime_seconds / 86400)::int AS "uptimeDays",
              ((c.uptime_seconds % 86400) / 3600)::int AS "uptimeHours",
              c.last_seen_at AS "lastSeen"
       FROM controllers c JOIN stations s ON s.id = c.station_id
       WHERE c.station_id = $1
       ORDER BY c.code`,
      [stationId]
    );
    const shaped = rows.map((r: any) => ({
      id: r.id,
      station: r.station,
      model: r.model,
      status: r.status,
      pumps: r.pumps,
      pumpsOnline: r.pumpsOnline,
      dispensers: r.dispensers,
      nozzles: r.nozzles,
      uptime: `${r.uptimeDays}d ${r.uptimeHours}h`,
      lastSeen: r.lastSeen,
    }));
    res.json(shaped);
  })
);

const newControllerSchema = z.object({
  model: z.string().min(1),
});

controllersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = newControllerSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid controller payload");
    const stationId = req.user!.stationId;

    const seq = await pool.query(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\\D', '', 'g'), '')::int), 0) + 1 AS next FROM controllers`
    );
    const code = `C-${String(seq.rows[0].next).padStart(3, "0")}`;

    const { rows } = await pool.query(
      `INSERT INTO controllers (code, station_id, model, status, pumps_total, pumps_online, dispensers, nozzles, uptime_seconds, last_seen_at)
       VALUES ($1,$2,$3,'online',0,0,0,0,0, now()) RETURNING code AS id`,
      [code, stationId, parsed.data.model]
    );

    res.status(201).json(rows[0]);
  })
);