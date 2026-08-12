import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const fleetAccountsRouter = Router();
fleetAccountsRouter.use(requireAuth);

fleetAccountsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT account_code AS "accountId", name, group_name AS group, contact_person AS contact,
              vehicles, credit_limit_kes::float AS "creditLimitKes", balance_kes::float AS "balanceKes", status
       FROM fleet_accounts ORDER BY name`
    );
    res.json(rows);
  })
);

const newAccountSchema = z.object({
  name: z.string().min(2),
  group: z.string().optional(),
  contact: z.string().optional(),
  vehicles: z.number().int().min(0).default(0),
  creditLimitKes: z.number().min(0).default(0),
});

fleetAccountsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = newAccountSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid fleet account payload");
    const { name, group, contact, vehicles, creditLimitKes } = parsed.data;

    const seq = await pool.query(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(account_code, '\\D', '', 'g'), '')::int), 1000) + 1 AS next FROM fleet_accounts`
    );
    const accountId = `FA-${seq.rows[0].next}`;

    const { rows } = await pool.query(
      `INSERT INTO fleet_accounts (account_code, name, group_name, contact_person, vehicles, credit_limit_kes, balance_kes)
       VALUES ($1,$2,$3,$4,$5,$6,0) RETURNING account_code AS "accountId", name`,
      [accountId, name, group ?? null, contact ?? null, vehicles, creditLimitKes]
    );
    res.status(201).json(rows[0]);
  })
);

const updateAccountSchema = z.object({
  name: z.string().min(2).optional(),
  group: z.string().optional(),
  contact: z.string().optional(),
  vehicles: z.number().int().min(0).optional(),
  creditLimitKes: z.number().min(0).optional(),
  status: z.enum(["Active", "Over Limit", "Inactive"]).optional(),
});

const accountColumnMap: Record<string, string> = {
  name: "name",
  group: "group_name",
  contact: "contact_person",
  vehicles: "vehicles",
  creditLimitKes: "credit_limit_kes",
  status: "status",
};

fleetAccountsRouter.patch(
  "/:accountId",
  asyncHandler(async (req, res) => {
    const parsed = updateAccountSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid update payload");
    const fields = parsed.data;
    const keys = Object.keys(fields);
    if (keys.length === 0) throw new HttpError(400, "No fields to update");

    const setClauses = keys.map((k, i) => `${accountColumnMap[k]} = $${i + 1}`);
    const values = keys.map((k) => (fields as any)[k]);

    const { rows } = await pool.query(
      `UPDATE fleet_accounts SET ${setClauses.join(", ")} WHERE account_code = $${keys.length + 1} RETURNING account_code AS "accountId", name`,
      [...values, req.params.accountId]
    );
    if (rows.length === 0) throw new HttpError(404, "Fleet account not found");
    res.json(rows[0]);
  })
);

fleetAccountsRouter.delete(
  "/:accountId",
  asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query(`DELETE FROM fleet_accounts WHERE account_code = $1`, [req.params.accountId]);
    if (rowCount === 0) throw new HttpError(404, "Fleet account not found");
    res.status(204).end();
  })
);
