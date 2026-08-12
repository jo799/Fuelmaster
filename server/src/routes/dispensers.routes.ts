import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const dispensersRouter = Router();
dispensersRouter.use(requireAuth);

dispensersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.status, p.active_nozzle AS nozzle, p.product,
              p.litres::float AS litres, p.amount_kes::float AS "amountKes",
              p.flow_rate::float AS "flowRate", c.code AS controller
       FROM pumps p LEFT JOIN controllers c ON c.id = p.controller_id
       WHERE p.station_id = $1 ORDER BY p.id`,
      [stationId]
    );
    res.json(rows);
  })
);

const newPumpSchema = z.object({
  name: z.string().min(1).optional(),
  product: z.enum(["Petrol", "Diesel", "Kerosene", "LPG"]).default("Petrol"),
});

dispensersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = newPumpSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid pump payload");
    const stationId = req.user!.stationId;

    const countRow = await pool.query(`SELECT COUNT(*)::int AS count FROM pumps WHERE station_id = $1`, [stationId]);
    const index = countRow.rows[0].count;
    const name = parsed.data.name?.trim() || `Pump ${index + 1}`;

    // Spread new pumps out in a simple grid so they don't overlap on the
    // Live Forecourt map before anyone manually repositions them.
    const posX = 15 + (index % 4) * 22;
    const posY = 15 + Math.floor(index / 4) * 45;

    const controllerRow = await pool.query(
      `SELECT id FROM controllers WHERE station_id = $1 ORDER BY id LIMIT 1`,
      [stationId]
    );
    const controllerId = controllerRow.rows[0]?.id ?? null;

    const { rows } = await pool.query(
      `INSERT INTO pumps (station_id, controller_id, name, status, product, pos_x, pos_y)
       VALUES ($1,$2,$3,'idle',$4,$5,$6) RETURNING id, name`,
      [stationId, controllerId, name, parsed.data.product, posX, posY]
    );

    if (controllerId) {
      await pool.query(
        `UPDATE controllers SET pumps_total = pumps_total + 1, pumps_online = pumps_online + 1 WHERE id = $1`,
        [controllerId]
      );
    }

    res.status(201).json(rows[0]);
  })
);