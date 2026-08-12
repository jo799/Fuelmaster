import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const pushRouter = Router();
pushRouter.use(requireAuth);

pushRouter.get(
  "/vapid-public-key",
  asyncHandler(async (req, res) => {
    const key = process.env.VAPID_PUBLIC_KEY;
    if (!key) throw new HttpError(503, "Push notifications aren't configured on this server yet.");
    res.json({ publicKey: key });
  })
);

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

pushRouter.post(
  "/subscribe",
  asyncHandler(async (req, res) => {
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid push subscription payload");
    const stationId = req.user!.stationId;

    await pool.query(
      `INSERT INTO push_subscriptions (station_id, user_id, endpoint, p256dh, auth)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (endpoint) DO UPDATE SET station_id = $1, user_id = $2, p256dh = $4, auth = $5`,
      [stationId, req.user!.sub, parsed.data.endpoint, parsed.data.keys.p256dh, parsed.data.keys.auth]
    );

    res.status(201).json({ ok: true });
  })
);

const unsubscribeSchema = z.object({ endpoint: z.string().url() });

pushRouter.post(
  "/unsubscribe",
  asyncHandler(async (req, res) => {
    const parsed = unsubscribeSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid unsubscribe payload");
    await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [parsed.data.endpoint]);
    res.status(204).end();
  })
);

pushRouter.get(
  "/status",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM push_subscriptions WHERE user_id = $1`,
      [req.user!.sub]
    );
    res.json({ subscribed: rows[0].n > 0 });
  })
);