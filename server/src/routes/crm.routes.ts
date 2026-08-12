import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const crmRouter = Router();
crmRouter.use(requireAuth);

crmRouter.get(
  "/customers",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT id, name, company, contact, segment, status,
              to_char(last_interaction_at, 'Mon DD, YYYY HH12:MI AM') AS "lastInteraction",
              total_spent_kes::float AS "totalSpentKes"
       FROM crm_customers ORDER BY total_spent_kes DESC`
    );
    res.json(rows);
  })
);

const newCustomerSchema = z.object({
  name: z.string().min(2),
  company: z.string().optional(),
  contact: z.string().optional(),
  segment: z.enum(["VIP", "Gold", "Silver", "Bronze"]).default("Bronze"),
});

crmRouter.post(
  "/customers",
  asyncHandler(async (req, res) => {
    const parsed = newCustomerSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid customer payload");
    const { name, company, contact, segment } = parsed.data;
    const { rows } = await pool.query(
      `INSERT INTO crm_customers (name, company, contact, segment, last_interaction_at)
       VALUES ($1,$2,$3,$4, now()) RETURNING id, name`,
      [name, company ?? null, contact ?? null, segment]
    );
    res.status(201).json(rows[0]);
  })
);

const updateCustomerSchema = z.object({
  name: z.string().min(2).optional(),
  company: z.string().optional(),
  contact: z.string().optional(),
  segment: z.enum(["VIP", "Gold", "Silver", "Bronze"]).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

crmRouter.patch(
  "/customers/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateCustomerSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid update payload");
    const fields = parsed.data;
    const keys = Object.keys(fields);
    if (keys.length === 0) throw new HttpError(400, "No fields to update");

    const columnMap: Record<string, string> = {
      name: "name",
      company: "company",
      contact: "contact",
      segment: "segment",
      status: "status",
    };
    const setClauses = keys.map((k, i) => `${columnMap[k]} = $${i + 1}`);
    const values = keys.map((k) => (fields as any)[k]);

    const { rows } = await pool.query(
      `UPDATE crm_customers SET ${setClauses.join(", ")} WHERE id = $${keys.length + 1} RETURNING id, name`,
      [...values, req.params.id]
    );
    if (rows.length === 0) throw new HttpError(404, "Customer not found");
    res.json(rows[0]);
  })
);

crmRouter.delete(
  "/customers/:id",
  asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query(`DELETE FROM crm_customers WHERE id = $1`, [req.params.id]);
    if (rowCount === 0) throw new HttpError(404, "Customer not found");
    res.status(204).end();
  })
);

crmRouter.get(
  "/followups",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT c.name, f.type, to_char(f.due_at, 'Mon DD, YYYY HH12:MI AM') AS date
       FROM crm_followups f JOIN crm_customers c ON c.id = f.customer_id
       WHERE f.due_at >= now() ORDER BY f.due_at LIMIT 10`
    );
    res.json(rows);
  })
);
