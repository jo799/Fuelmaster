import { Router } from "express";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const auditLogsRouter = Router();
auditLogsRouter.use(requireAuth, requireRole("Manager", "Administrator", "Supervisor"));

auditLogsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT al.code AS id, to_char(al.created_at, 'Mon DD, YYYY HH12:MI AM') AS time,
              COALESCE(u.name, 'System') AS user, al.action, al.target,
              al.ip_address AS ip, al.severity
       FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC LIMIT 100`
    );
    res.json(rows);
  })
);
