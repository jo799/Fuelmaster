import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const nozzlesRouter = Router();
nozzlesRouter.use(requireAuth);

nozzlesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT n.id, p.id AS "pumpId", p.name AS dispenser, n.nozzle_no AS "nozzleNo", n.product, n.status,
              n.flow_rate::float AS "flowRate", n.today_litres::float AS "todayLitres",
              n.today_kes::float AS "todayKes", n.last_dispensed_at AS "lastDispensed"
       FROM nozzles n JOIN pumps p ON p.id = n.pump_id
       WHERE p.station_id = $1 ORDER BY p.id, n.nozzle_no`,
      [stationId]
    );
    res.json(rows);
  })
);

const newNozzleSchema = z.object({
  pumpId: z.number().int(),
  product: z.enum(["Petrol", "Diesel", "Kerosene", "LPG"]).default("Petrol"),
});

nozzlesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = newNozzleSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid nozzle payload");
    const stationId = req.user!.stationId;
    const { pumpId, product } = parsed.data;

    const pump = await pool.query(`SELECT id FROM pumps WHERE id = $1 AND station_id = $2`, [pumpId, stationId]);
    if (pump.rows.length === 0) throw new HttpError(404, "Pump not found at this station");

    const seq = await pool.query(`SELECT COALESCE(MAX(nozzle_no), 0) + 1 AS next FROM nozzles WHERE pump_id = $1`, [
      pumpId,
    ]);
    const nozzleNo = seq.rows[0].next;

    const { rows } = await pool.query(
      `INSERT INTO nozzles (pump_id, nozzle_no, product, status)
       VALUES ($1,$2,$3,'online') RETURNING id, nozzle_no AS "nozzleNo"`,
      [pumpId, nozzleNo, product]
    );

    const controllerRow = await pool.query(`SELECT controller_id FROM pumps WHERE id = $1`, [pumpId]);
    const controllerId = controllerRow.rows[0]?.controller_id;
    if (controllerId) {
      await pool.query(`UPDATE controllers SET nozzles = nozzles + 1 WHERE id = $1`, [controllerId]);
    }

    res.status(201).json(rows[0]);
  })
);