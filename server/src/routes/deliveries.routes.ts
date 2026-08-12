import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { notify } from "../services/notifications.js";

export const deliveriesRouter = Router();
deliveriesRouter.use(requireAuth);

deliveriesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT code AS id, to_char(delivered_at, 'Mon DD, YYYY HH12:MI AM') AS date,
              supplier, fuel_type AS "fuelType", quantity_l::float AS "quantityL",
              cost_kes::float AS "costKes", status, note
       FROM deliveries WHERE station_id = $1 ORDER BY delivered_at DESC`,
      [stationId]
    );
    res.json(rows);
  })
);

const newDeliverySchema = z.object({
  supplier: z.string().min(2),
  fuelType: z.enum(["Petrol", "Diesel", "Kerosene", "LPG"]),
  quantityL: z.number().positive(),
  costKes: z.number().positive(),
  status: z.enum(["Received", "In Transit", "Scheduled", "Cancelled"]).default("Scheduled"),
  note: z.string().optional(),
});

deliveriesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = newDeliverySchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid delivery payload");
    const { supplier, fuelType, quantityL, costKes, status, note } = parsed.data;
    const stationId = req.user!.stationId;

    const seq = await pool.query(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\\D', '', 'g'), '')::int), 10000) + 1 AS next FROM deliveries`
    );
    const code = `DEL-${seq.rows[0].next}`;

    const { rows } = await pool.query(
      `INSERT INTO deliveries (code, station_id, supplier, fuel_type, quantity_l, cost_kes, status, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING code AS id`,
      [code, stationId, supplier, fuelType, quantityL, costKes, status, note ?? null]
    );
    res.status(201).json(rows[0]);
  })
);

const updateDeliverySchema = z.object({
  status: z.enum(["Received", "In Transit", "Scheduled", "Cancelled"]),
});

deliveriesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateDeliverySchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid status");
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `UPDATE deliveries SET status = $1 WHERE code = $2 AND station_id = $3
       RETURNING code AS id, status, supplier, fuel_type AS "fuelType"`,
      [parsed.data.status, req.params.id, stationId]
    );
    if (rows.length === 0) throw new HttpError(404, "Delivery not found");

    notify({
      stationId: stationId!,
      event: "deliveryStatusChanges",
      title: `Delivery ${rows[0].id} is now ${rows[0].status}`,
      message: `${rows[0].fuelType} delivery from ${rows[0].supplier} changed to ${rows[0].status}.`,
      severity: rows[0].status === "Cancelled" ? "warning" : "info",
    }).catch((err) => console.error("[deliveries] status-change notify failed:", err.message));

    res.json({ id: rows[0].id, status: rows[0].status });
  })
);

deliveriesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rowCount } = await pool.query(`DELETE FROM deliveries WHERE code = $1 AND station_id = $2`, [
      req.params.id,
      stationId,
    ]);
    if (rowCount === 0) throw new HttpError(404, "Delivery not found");
    res.status(204).end();
  })
);