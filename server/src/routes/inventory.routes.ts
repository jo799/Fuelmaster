import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const inventoryRouter = Router();
inventoryRouter.use(requireAuth);

inventoryRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT id, name, category, location, unit, quantity::float AS quantity,
              cost_kes::float AS "costKes", value_kes::float AS "valueKes", status
       FROM inventory_items WHERE station_id = $1 ORDER BY name`,
      [stationId]
    );
    res.json(rows);
  })
);

const newItemSchema = z.object({
  name: z.string().min(2),
  category: z.enum(["Fuel", "Lubricants", "Other Products"]),
  location: z.string().optional(),
  unit: z.string().min(1),
  quantity: z.number().min(0).default(0),
  costKes: z.number().min(0).default(0),
});

inventoryRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = newItemSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid item payload");
    const { name, category, location, unit, quantity, costKes } = parsed.data;
    const stationId = req.user!.stationId;
    const valueKes = quantity * costKes;
    const status = quantity <= 0 ? "Out of Stock" : quantity < 20 ? "Low Stock" : "In Stock";

    const { rows } = await pool.query(
      `INSERT INTO inventory_items (station_id, name, category, location, unit, quantity, cost_kes, value_kes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, name`,
      [stationId, name, category, location ?? null, unit, quantity, costKes, valueKes, status]
    );
    res.status(201).json(rows[0]);
  })
);

const updateItemSchema = z.object({
  name: z.string().min(2).optional(),
  category: z.enum(["Fuel", "Lubricants", "Other Products"]).optional(),
  location: z.string().optional(),
  unit: z.string().optional(),
  quantity: z.number().min(0).optional(),
  costKes: z.number().min(0).optional(),
});

inventoryRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateItemSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid update payload");
    const fields = parsed.data;

    const current = await pool.query(
      `SELECT quantity::float AS quantity, cost_kes::float AS "costKes", name, category, location, unit
       FROM inventory_items WHERE id = $1`,
      [req.params.id]
    );
    if (current.rows.length === 0) throw new HttpError(404, "Item not found");
    const existing = current.rows[0];

    const quantity = fields.quantity ?? existing.quantity;
    const costKes = fields.costKes ?? existing.costKes;
    const valueKes = quantity * costKes;
    const status = quantity <= 0 ? "Out of Stock" : quantity < 20 ? "Low Stock" : "In Stock";
    const name = fields.name ?? existing.name;
    const category = fields.category ?? existing.category;
    const location = fields.location ?? existing.location;
    const unit = fields.unit ?? existing.unit;

    const { rows } = await pool.query(
      `UPDATE inventory_items
       SET name = $1, category = $2, location = $3, unit = $4, quantity = $5, cost_kes = $6, value_kes = $7, status = $8
       WHERE id = $9 RETURNING id, name`,
      [name, category, location, unit, quantity, costKes, valueKes, status, req.params.id]
    );
    res.json(rows[0]);
  })
);

inventoryRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query(`DELETE FROM inventory_items WHERE id = $1`, [req.params.id]);
    if (rowCount === 0) throw new HttpError(404, "Item not found");
    res.status(204).end();
  })
);

inventoryRouter.get(
  "/movements",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT i.name AS item, m.delta::float AS delta, i.unit, m.reason, m.created_at AS "createdAt"
       FROM inventory_movements m JOIN inventory_items i ON i.id = m.item_id
       WHERE i.station_id = $1 ORDER BY m.created_at DESC LIMIT 10`,
      [stationId]
    );
    res.json(rows);
  })
);
