import { Router } from "express";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get(
  "/pumps",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT id, name, status, active_nozzle AS nozzle, product,
              litres::float AS litres, amount_kes::float AS "amountKes",
              flow_rate::float AS "flowRate", target_litres::float AS "targetLitres",
              elapsed_sec AS "elapsedSec", pos_x::float AS x, pos_y::float AS y,
              (SELECT code FROM controllers c WHERE c.id = pumps.controller_id) AS controller
       FROM pumps WHERE station_id = $1 ORDER BY id`,
      [stationId]
    );
    res.json(rows);
  })
);

dashboardRouter.get(
  "/kpis",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const today = await pool.query(
      `SELECT COALESCE(SUM(amount_kes),0)::float AS kes, COALESCE(SUM(litres),0)::float AS litres, COUNT(*)::int AS txns
       FROM sale_transactions WHERE station_id = $1 AND created_at >= CURRENT_DATE`,
      [stationId]
    );
    const alerts = await pool.query(
      `SELECT COUNT(*)::int AS count FROM alerts WHERE station_id = $1 AND status != 'Resolved'`,
      [stationId]
    );
    res.json({
      salesToday: today.rows[0].kes,
      litresToday: today.rows[0].litres,
      transactionsToday: today.rows[0].txns,
      activeAlerts: alerts.rows[0].count,
    });
  })
);

dashboardRouter.get(
  "/events",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT code AS id, message, severity AS level, created_at AS "createdAt"
       FROM alerts WHERE station_id = $1 ORDER BY created_at DESC LIMIT 8`,
      [stationId]
    );
    res.json(rows);
  })
);
