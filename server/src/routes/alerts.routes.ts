import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const alertsRouter = Router();
alertsRouter.use(requireAuth);

alertsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT code AS id, module, message, severity, status,
              to_char(created_at, 'Mon DD, YYYY HH12:MI AM') AS time
       FROM alerts WHERE station_id = $1 ORDER BY created_at DESC`,
      [stationId]
    );
    res.json(rows);
  })
);

const statusSchema = z.object({ status: z.enum(["Active", "Acknowledged", "Resolved"]) });

alertsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid status");
    const { rows } = await pool.query(
      `UPDATE alerts SET status = $1 WHERE code = $2 RETURNING code AS id, status`,
      [parsed.data.status, req.params.id]
    );
    if (rows.length === 0) throw new HttpError(404, "Alert not found");
    res.json(rows[0]);
  })
);
