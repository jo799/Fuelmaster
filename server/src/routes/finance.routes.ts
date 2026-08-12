import { Router } from "express";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const financeRouter = Router();
financeRouter.use(requireAuth);

financeRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const revenue = await pool.query(
      `SELECT COALESCE(SUM(amount_kes),0)::float AS revenue FROM sale_transactions
       WHERE station_id = $1 AND created_at >= date_trunc('month', now())`,
      [stationId]
    );
    const expenses = await pool.query(
      `SELECT COALESCE(SUM(amount_kes),0)::float AS expenses FROM expenses
       WHERE station_id = $1 AND created_at >= date_trunc('month', now())`,
      [stationId]
    );
    res.json({ revenue: revenue.rows[0].revenue, expenses: expenses.rows[0].expenses });
  })
);

financeRouter.get(
  "/expenses",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT category, SUM(amount_kes)::float AS value
       FROM expenses WHERE station_id = $1 GROUP BY category ORDER BY value DESC`,
      [stationId]
    );
    res.json(rows);
  })
);

financeRouter.get(
  "/by-station",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT s.name AS station,
              COALESCE(SUM(st.amount_kes),0)::float AS revenue
       FROM stations s LEFT JOIN sale_transactions st ON st.station_id = s.id
         AND st.created_at >= date_trunc('month', now())
       GROUP BY s.name ORDER BY revenue DESC`
    );
    res.json(rows);
  })
);
