import { Router } from "express";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { sendTestNotification } from "../services/notifications.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.post(
  "/test",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    if (!stationId) throw new HttpError(400, "No station in context");

    const { rows } = await pool.query(`SELECT name, email, phone FROM users WHERE id = $1`, [req.user!.sub]);
    if (rows.length === 0) throw new HttpError(404, "User not found");

    const result = await sendTestNotification(stationId, rows[0]);
    res.json(result);
  })
);