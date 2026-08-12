import { Router } from "express";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const salesRouter = Router();
salesRouter.use(requireAuth);

salesRouter.get(
  "/transactions",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { rows } = await pool.query(
      `SELECT st.receipt_no AS receipt, to_char(st.created_at, 'HH12:MI:SS') AS time,
              p.name AS pump, st.nozzle_no AS nozzle, u.name AS cashier,
              COALESCE(st.customer_name, 'Walk-in') AS customer, st.product,
              st.litres::float AS litres, st.price::float AS price,
              st.amount_kes::float AS "amountKes", st.payment_method AS payment, st.status
       FROM sale_transactions st
       LEFT JOIN pumps p ON p.id = st.pump_id
       LEFT JOIN users u ON u.id = st.cashier_id
       WHERE st.station_id = $1
       ORDER BY st.created_at DESC LIMIT $2`,
      [stationId, limit]
    );
    res.json(rows);
  })
);

salesRouter.get(
  "/payment-split",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT payment_method AS name, COUNT(*)::int AS value
       FROM sale_transactions WHERE station_id = $1 AND created_at >= CURRENT_DATE
       GROUP BY payment_method ORDER BY value DESC`,
      [stationId]
    );
    res.json(rows);
  })
);

salesRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(amount_kes),0)::float AS "totalKes",
              COALESCE(SUM(litres),0)::float AS "totalLitres",
              COUNT(*)::int AS transactions,
              COALESCE(AVG(amount_kes),0)::float AS "avgSale"
       FROM sale_transactions WHERE station_id = $1 AND created_at >= CURRENT_DATE`,
      [stationId]
    );
    res.json(rows[0]);
  })
);
