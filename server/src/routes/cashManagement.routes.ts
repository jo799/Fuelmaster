import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const cashManagementRouter = Router();
cashManagementRouter.use(requireAuth);

cashManagementRouter.get(
  "/transactions",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const { rows } = await pool.query(
      `SELECT ct.reference AS id, to_char(ct.created_at, 'Mon DD, YYYY HH12:MI AM') AS date,
              ct.type, ct.description, s.name AS station,
              ct.amount_kes::float AS "amountKes", ct.method, ct.reference, ct.status
       FROM cash_transactions ct JOIN stations s ON s.id = ct.station_id
       WHERE ct.station_id = $1 ORDER BY ct.created_at DESC LIMIT $2`,
      [stationId, limit]
    );
    res.json(rows);
  })
);

const newTxnSchema = z.object({
  type: z.enum(["Cash In", "Cash Out"]),
  description: z.string().min(2),
  amountKes: z.number().positive(),
  method: z.enum(["Cash", "Bank Transfer"]),
});

cashManagementRouter.post(
  "/transactions",
  asyncHandler(async (req, res) => {
    const parsed = newTxnSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid transaction payload");
    const { type, description, amountKes, method } = parsed.data;
    const stationId = req.user!.stationId;
    const signedAmount = type === "Cash In" ? amountKes : -amountKes;

    const seq = await pool.query(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(reference, '\\D', '', 'g'), '')::int), 500000) + 1 AS next FROM cash_transactions`
    );
    const reference = `CT-${seq.rows[0].next}`;

    const { rows } = await pool.query(
      `INSERT INTO cash_transactions (station_id, type, description, amount_kes, method, reference, status)
       VALUES ($1,$2,$3,$4,$5,$6,'completed') RETURNING reference AS id`,
      [stationId, type, description, signedAmount, method, reference]
    );

    res.status(201).json(rows[0]);
  })
);

cashManagementRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT
         COALESCE(SUM(amount_kes) FILTER (WHERE amount_kes > 0), 0)::float AS "totalIn",
         COALESCE(ABS(SUM(amount_kes) FILTER (WHERE amount_kes < 0)), 0)::float AS "totalOut"
       FROM cash_transactions WHERE station_id = $1 AND created_at >= CURRENT_DATE`,
      [stationId]
    );
    res.json(rows[0]);
  })
);

cashManagementRouter.get(
  "/trend",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT to_char(day, 'Mon DD') AS d,
              COALESCE(SUM(ct.amount_kes) FILTER (WHERE ct.amount_kes > 0), 0)::float AS inflow,
              COALESCE(ABS(SUM(ct.amount_kes) FILTER (WHERE ct.amount_kes < 0)), 0)::float AS outflow
       FROM generate_series(CURRENT_DATE - interval '13 days', CURRENT_DATE, interval '1 day') AS day
       LEFT JOIN cash_transactions ct
         ON ct.station_id = $1 AND date_trunc('day', ct.created_at) = day
       GROUP BY day ORDER BY day`,
      [stationId]
    );
    res.json(rows);
  })
);