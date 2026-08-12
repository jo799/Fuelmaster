import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const shiftsRouter = Router();
shiftsRouter.use(requireAuth);

shiftsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT sh.code AS id, to_char(sh.starts_at, 'Mon DD, YYYY') AS date,
              to_char(sh.starts_at, 'HH12:MI AM') || ' - ' ||
                COALESCE(to_char(sh.ends_at, 'HH12:MI AM'), 'Now') AS time,
              u.name AS cashier, s.code AS station, sh.transactions,
              sh.sales_kes::float AS "salesKes", sh.status
       FROM shifts sh JOIN stations s ON s.id = sh.station_id
       LEFT JOIN users u ON u.id = sh.cashier_id
       WHERE sh.station_id = $1 ORDER BY sh.starts_at DESC`,
      [stationId]
    );
    res.json(rows);
  })
);

shiftsRouter.get(
  "/top-cashiers",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT u.name, SUM(sh.sales_kes)::float AS "salesKes"
       FROM shifts sh JOIN users u ON u.id = sh.cashier_id
       WHERE sh.station_id = $1
       GROUP BY u.name ORDER BY "salesKes" DESC LIMIT 5`,
      [stationId]
    );
    res.json(rows);
  })
);

shiftsRouter.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;

    const totalHours = await pool.query(
      `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ends_at, now()) - starts_at)) / 3600), 0)::float AS hours
       FROM shifts WHERE station_id = $1`,
      [stationId]
    );

    // Standard shift assumed at 8 hours \u2014 anything a completed shift ran
    // beyond that counts as overtime. This is a reasonable default, not a
    // per-station configurable policy (we don't track shift length rules).
    const overtime = await pool.query(
      `SELECT COALESCE(SUM(GREATEST(0, EXTRACT(EPOCH FROM (ends_at - starts_at)) / 3600 - 8)), 0)::float AS hours
       FROM shifts WHERE station_id = $1 AND status = 'Completed' AND ends_at IS NOT NULL`,
      [stationId]
    );

    const byTimeOfDay = await pool.query(
      `SELECT
         CASE
           WHEN EXTRACT(HOUR FROM starts_at) < 6 THEN '12 AM - 6 AM'
           WHEN EXTRACT(HOUR FROM starts_at) < 12 THEN '6 AM - 12 PM'
           WHEN EXTRACT(HOUR FROM starts_at) < 18 THEN '12 PM - 6 PM'
           ELSE '6 PM - 12 AM'
         END AS t,
         COUNT(*)::int AS v
       FROM shifts WHERE station_id = $1 GROUP BY 1`,
      [stationId]
    );
    const order = ["12 AM - 6 AM", "6 AM - 12 PM", "12 PM - 6 PM", "6 PM - 12 AM"];
    const byTimeMap = new Map(byTimeOfDay.rows.map((r) => [r.t, r.v]));
    const byTimeOfDayOrdered = order.map((t) => ({ t, v: byTimeMap.get(t) ?? 0 }));

    const dailyCounts = await pool.query(
      `SELECT to_char(day, 'Dy') AS d, COALESCE(COUNT(sh.id), 0)::int AS count
       FROM generate_series(CURRENT_DATE - interval '6 days', CURRENT_DATE, interval '1 day') AS day
       LEFT JOIN shifts sh ON sh.station_id = $1 AND date_trunc('day', sh.starts_at) = day
       GROUP BY day ORDER BY day`,
      [stationId]
    );

    res.json({
      totalHours: Math.round(totalHours.rows[0].hours),
      overtimeHours: Math.round(overtime.rows[0].hours),
      byTimeOfDay: byTimeOfDayOrdered,
      dailyCounts: dailyCounts.rows,
    });
  })
);

const newShiftSchema = z.object({ cashierEmail: z.string().email() });

shiftsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = newShiftSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid shift payload");
    const stationId = req.user!.stationId;

    const cashier = await pool.query(`SELECT id FROM users WHERE email = $1`, [parsed.data.cashierEmail.toLowerCase()]);
    if (cashier.rows.length === 0) throw new HttpError(404, "Cashier not found");

    const seq = await pool.query(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\\D', '', 'g'), '')::int), 0) + 1 AS next FROM shifts`
    );
    const code = `SFT-${String(seq.rows[0].next).padStart(3, "0")}`;

    const { rows } = await pool.query(
      `INSERT INTO shifts (code, station_id, cashier_id, starts_at, status)
       VALUES ($1,$2,$3, now(), 'In Progress') RETURNING code AS id`,
      [code, stationId, cashier.rows[0].id]
    );

    res.status(201).json(rows[0]);
  })
);