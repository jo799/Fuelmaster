import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const loyaltyRouter = Router();
loyaltyRouter.use(requireAuth);

loyaltyRouter.get(
  "/members",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT member_code AS id, name, phone, tier, points_balance AS "pointsBalance",
              lifetime_points AS "lifetimePoints", total_spent_kes::float AS "totalSpentKes",
              to_char(joined_at, 'Mon DD, YYYY') AS joined, status
       FROM loyalty_members ORDER BY lifetime_points DESC`
    );
    res.json(rows);
  })
);

const newMemberSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  tier: z.enum(["Gold", "Silver", "Bronze"]).default("Bronze"),
});

loyaltyRouter.post(
  "/members",
  asyncHandler(async (req, res) => {
    const parsed = newMemberSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid member payload");
    const { name, phone, tier } = parsed.data;

    const seq = await pool.query(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(member_code, '\\D', '', 'g'), '')::bigint), 1001000)::bigint + 1 AS next FROM loyalty_members`
    );
    const memberCode = `LM-${seq.rows[0].next}`;

    const { rows } = await pool.query(
      `INSERT INTO loyalty_members (member_code, name, phone, tier, status)
       VALUES ($1,$2,$3,$4,'Active') RETURNING member_code AS id, name`,
      [memberCode, name, phone ?? null, tier]
    );
    res.status(201).json(rows[0]);
  })
);

const updateMemberSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  tier: z.enum(["Gold", "Silver", "Bronze"]).optional(),
  status: z.enum(["Active", "Pending", "Inactive"]).optional(),
});

const memberColumnMap: Record<string, string> = {
  name: "name",
  phone: "phone",
  tier: "tier",
  status: "status",
};

loyaltyRouter.patch(
  "/members/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateMemberSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid update payload");
    const fields = parsed.data;
    const keys = Object.keys(fields);
    if (keys.length === 0) throw new HttpError(400, "No fields to update");

    const setClauses = keys.map((k, i) => `${memberColumnMap[k]} = $${i + 1}`);
    const values = keys.map((k) => (fields as any)[k]);

    const { rows } = await pool.query(
      `UPDATE loyalty_members SET ${setClauses.join(", ")} WHERE member_code = $${keys.length + 1} RETURNING member_code AS id, name`,
      [...values, req.params.id]
    );
    if (rows.length === 0) throw new HttpError(404, "Member not found");
    res.json(rows[0]);
  })
);

loyaltyRouter.delete(
  "/members/:id",
  asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query(`DELETE FROM loyalty_members WHERE member_code = $1`, [req.params.id]);
    if (rowCount === 0) throw new HttpError(404, "Member not found");
    res.status(204).end();
  })
);

loyaltyRouter.get(
  "/activity",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT lm.name AS member, la.message, la.points, la.created_at AS "createdAt"
       FROM loyalty_activity la JOIN loyalty_members lm ON lm.id = la.member_id
       ORDER BY la.created_at DESC LIMIT 10`
    );
    res.json(rows);
  })
);
