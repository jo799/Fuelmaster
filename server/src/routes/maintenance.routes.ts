import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const maintenanceRouter = Router();
maintenanceRouter.use(requireAuth);

maintenanceRouter.get(
  "/work-orders",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT code AS id, description, asset, type, priority, status, assigned_to AS "assignedTo",
              to_char(due_date, 'Mon DD, YYYY') AS "dueDate"
       FROM work_orders WHERE station_id = $1 ORDER BY due_date`,
      [stationId]
    );
    res.json(rows);
  })
);

maintenanceRouter.get(
  "/trend",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    // Only "created" is a real trend here \u2014 we don't log a separate
    // completed_at/status-change history, so "completed over time" or
    // "overdue over time" can't be reconstructed honestly from what we
    // actually store, just today's snapshot (which the KPI cards already
    // show for real).
    const { rows } = await pool.query(
      `SELECT to_char(day, 'Mon DD') AS d, COALESCE(COUNT(wo.id), 0)::int AS created
       FROM generate_series(CURRENT_DATE - interval '6 days', CURRENT_DATE, interval '1 day') AS day
       LEFT JOIN work_orders wo ON wo.station_id = $1 AND date_trunc('day', wo.created_at) = day
       GROUP BY day ORDER BY day`,
      [stationId]
    );
    res.json(rows);
  })
);

const newWorkOrderSchema = z.object({
  description: z.string().min(3),
  asset: z.string().min(1),
  type: z.enum(["Preventive", "Corrective", "Inspections", "Other"]).default("Corrective"),
  priority: z.enum(["High", "Medium", "Low"]).default("Medium"),
  dueDate: z.string(), // YYYY-MM-DD
});

maintenanceRouter.post(
  "/work-orders",
  asyncHandler(async (req, res) => {
    const parsed = newWorkOrderSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid work order payload");
    const { description, asset, type, priority, dueDate } = parsed.data;
    const stationId = req.user!.stationId;

    const seq = await pool.query(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\\D', '', 'g'), '')::int), 10000) + 1 AS next FROM work_orders`
    );
    const code = `WO-${seq.rows[0].next}`;

    const { rows } = await pool.query(
      `INSERT INTO work_orders (code, station_id, description, asset, type, priority, status, assigned_to, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,'Scheduled','Unassigned',$7) RETURNING code AS id`,
      [code, stationId, description, asset, type, priority, dueDate]
    );
    res.status(201).json(rows[0]);
  })
);

const updateWorkOrderSchema = z.object({
  status: z.enum(["Completed", "In Progress", "Scheduled", "Overdue"]).optional(),
  assignedTo: z.string().optional(),
  priority: z.enum(["High", "Medium", "Low"]).optional(),
});

const workOrderColumnMap: Record<string, string> = {
  status: "status",
  assignedTo: "assigned_to",
  priority: "priority",
};

maintenanceRouter.patch(
  "/work-orders/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateWorkOrderSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid update payload");
    const fields = parsed.data;
    const keys = Object.keys(fields);
    if (keys.length === 0) throw new HttpError(400, "No fields to update");

    const stationId = req.user!.stationId;
    const setClauses = keys.map((k, i) => `${workOrderColumnMap[k]} = $${i + 1}`);
    const values = keys.map((k) => (fields as any)[k]);

    const { rows } = await pool.query(
      `UPDATE work_orders SET ${setClauses.join(", ")} WHERE code = $${keys.length + 1} AND station_id = $${keys.length + 2}
       RETURNING code AS id, status`,
      [...values, req.params.id, stationId]
    );
    if (rows.length === 0) throw new HttpError(404, "Work order not found");
    res.json(rows[0]);
  })
);

maintenanceRouter.delete(
  "/work-orders/:id",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rowCount } = await pool.query(`DELETE FROM work_orders WHERE code = $1 AND station_id = $2`, [
      req.params.id,
      stationId,
    ]);
    if (rowCount === 0) throw new HttpError(404, "Work order not found");
    res.status(204).end();
  })
);