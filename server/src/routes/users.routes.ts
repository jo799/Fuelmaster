import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT u.name, u.email, u.phone, u.role, s.code AS station, u.status,
              to_char(u.last_login_at, 'Mon DD, YYYY HH12:MI AM') AS "lastLogin",
              to_char(u.created_at, 'Mon DD, YYYY') AS "createdOn"
       FROM users u LEFT JOIN stations s ON s.id = u.station_id
       ORDER BY u.created_at DESC`
    );
    res.json(rows);
  })
);

usersRouter.get(
  "/trend",
  asyncHandler(async (req, res) => {
    // Real trend from the genuine created_at column \u2014 daily new-user
    // count plus a running cumulative total, for the last 14 days.
    const { rows } = await pool.query(
      `SELECT to_char(gs.day, 'Mon DD') AS d,
              COALESCE(daily.added, 0)::int AS added,
              (SELECT COUNT(*) FROM users WHERE created_at <= gs.day + interval '1 day' - interval '1 second')::int AS active
       FROM generate_series(CURRENT_DATE - interval '13 days', CURRENT_DATE, interval '1 day') AS gs(day)
       LEFT JOIN (
         SELECT date_trunc('day', created_at) AS day, COUNT(*) AS added
         FROM users WHERE created_at >= CURRENT_DATE - interval '13 days'
         GROUP BY 1
       ) daily ON daily.day = gs.day
       ORDER BY gs.day`
    );
    res.json(rows);
  })
);

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7).optional(),
  password: z.string().min(8),
  role: z.enum(["Cashier", "Manager", "Supervisor", "Controller", "Administrator", "Viewer"]),
  stationId: z.number().int().optional(),
});

usersRouter.post(
  "/",
  requireRole("Administrator"),
  asyncHandler(async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid user payload");
    const { name, email, phone, password, role, stationId } = parsed.data;

    const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);
    if (existing.rows.length > 0) throw new HttpError(409, "A user with that email already exists");

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, station_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, email, role`,
      [name, email.toLowerCase(), phone ?? null, hash, role, stationId ?? req.user!.stationId]
    );

    await pool.query(
      `INSERT INTO audit_logs (code, user_id, action, target, ip_address, severity)
       VALUES ($1,$2,'Created user',$3,$4,'info')`,
      [`AUD-${Date.now().toString().slice(-6)}`, req.user!.sub, name, req.ip]
    );

    res.status(201).json(rows[0]);
  })
);

const statusSchema = z.object({
  status: z.enum(["Active", "Suspended", "Invited"]).optional(),
  role: z.enum(["Cashier", "Manager", "Supervisor", "Controller", "Administrator", "Viewer"]).optional(),
  phone: z.string().min(7).nullable().optional(),
});

usersRouter.patch(
  "/:email/status",
  requireRole("Administrator"),
  asyncHandler(async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid update");
    const { status, role, phone } = parsed.data;
    if (!status && !role && phone === undefined) throw new HttpError(400, "Nothing to update");

    const setClauses: string[] = [];
    const values: unknown[] = [];
    if (status) {
      values.push(status);
      setClauses.push(`status = $${values.length}`);
    }
    if (role) {
      values.push(role);
      setClauses.push(`role = $${values.length}`);
    }
    if (phone !== undefined) {
      values.push(phone);
      setClauses.push(`phone = $${values.length}`);
    }
    values.push(String(req.params.email).toLowerCase());

    const { rows } = await pool.query(
      `UPDATE users SET ${setClauses.join(", ")} WHERE email = $${values.length} RETURNING name, email, phone, status, role`,
      values
    );
    if (rows.length === 0) throw new HttpError(404, "User not found");
    res.json(rows[0]);
  })
);

usersRouter.delete(
  "/:email",
  requireRole("Administrator"),
  asyncHandler(async (req, res) => {
    const email = String(req.params.email).toLowerCase();
    if (email === req.user!.email.toLowerCase()) {
      throw new HttpError(400, "You cannot delete your own account");
    }
    const { rowCount } = await pool.query(`DELETE FROM users WHERE email = $1`, [email]);
    if (rowCount === 0) throw new HttpError(404, "User not found");
    res.status(204).end();
  })
);