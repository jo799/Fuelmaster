import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { sha256Hex } from "../utils/hash.js";

export const stationsRouter = Router();
stationsRouter.use(requireAuth);

stationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(`SELECT id, code, name FROM stations ORDER BY name`);
    res.json(rows);
  })
);

const newStationSchema = z.object({
  name: z.string().min(2),
});

stationsRouter.post(
  "/",
  requireRole("Administrator"),
  asyncHandler(async (req, res) => {
    const parsed = newStationSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid station payload");

    const seq = await pool.query(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\\D', '', 'g'), '')::int), 0) + 1 AS next FROM stations`
    );
    const code = `STN-${String(seq.rows[0].next).padStart(3, "0")}`;

    const { rows } = await pool.query(
      `INSERT INTO stations (code, name) VALUES ($1,$2) RETURNING id, code, name`,
      [code, parsed.data.name]
    );

    res.status(201).json(rows[0]);
  })
);

/**
 * Whether this station has an edge-daemon credential configured yet, without
 * ever exposing the hash itself (a hash isn't secret, but there's no reason
 * to send it to the client either).
 */
stationsRouter.get(
  "/:id/edge-token/status",
  requireRole("Administrator"),
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(`SELECT edge_token_hash FROM stations WHERE id = $1`, [req.params.id]);
    if (rows.length === 0) throw new HttpError(404, "Station not found");
    res.json({ configured: rows[0].edge_token_hash !== null });
  })
);

/**
 * Generates (or rotates) this station's own edge-daemon credential. The
 * plaintext is returned exactly once, here, and never again \u2014 only its
 * hash is stored, the same pattern as an API key. Rotating immediately
 * invalidates the previous token, so a compromised daemon credential can be
 * revoked without touching any other station.
 */
stationsRouter.post(
  "/:id/edge-token/rotate",
  requireRole("Administrator"),
  asyncHandler(async (req, res) => {
    const station = await pool.query(`SELECT id, code FROM stations WHERE id = $1`, [req.params.id]);
    if (station.rows.length === 0) throw new HttpError(404, "Station not found");

    const token = crypto.randomBytes(32).toString("hex");
    await pool.query(`UPDATE stations SET edge_token_hash = $1 WHERE id = $2`, [sha256Hex(token), req.params.id]);

    res.json({ token, station: station.rows[0].code });
  })
);