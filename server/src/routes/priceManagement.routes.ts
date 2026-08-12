import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const priceManagementRouter = Router();
priceManagementRouter.use(requireAuth);

priceManagementRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT fuel_name AS fuel, current_price::float AS "currentPrice",
              previous_price::float AS "previousPrice",
              to_char(effective_from, 'Mon DD, YYYY HH12:MI AM') AS "effectiveFrom", status
       FROM fuel_prices WHERE station_id = $1 ORDER BY fuel_name`,
      [stationId]
    );
    res.json(rows);
  })
);

priceManagementRouter.get(
  "/history",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT to_char(changed_at, 'Mon DD, YYYY HH12:MI AM') AS date, fuel_name AS fuel,
              old_price::float AS "oldPrice", new_price::float AS "newPrice", changed_by AS "changedBy", reason
       FROM price_history WHERE station_id = $1 ORDER BY changed_at DESC LIMIT 10`,
      [stationId]
    );
    res.json(rows);
  })
);

const updateSchema = z.object({ fuel: z.string(), newPrice: z.number().positive(), reason: z.string().optional() });

priceManagementRouter.post(
  "/",
  requireRole("Manager", "Administrator"),
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid price update");
    const { fuel, newPrice, reason } = parsed.data;
    const stationId = req.user!.stationId;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query(
        `SELECT current_price FROM fuel_prices WHERE station_id = $1 AND fuel_name = $2 FOR UPDATE`,
        [stationId, fuel]
      );

      if (current.rows.length === 0) {
        // No price on record for this fuel at this station yet \u2014 this is
        // a brand-new station being onboarded, or a new product line being
        // introduced. Establish it rather than requiring a separate
        // "create" endpoint; previous_price is set equal to the new price
        // since there's no real prior price to show a change against.
        await client.query(
          `INSERT INTO fuel_prices (station_id, fuel_name, current_price, previous_price, effective_from)
           VALUES ($1,$2,$3,$3, now())`,
          [stationId, fuel, newPrice]
        );
        await client.query(
          `INSERT INTO price_history (station_id, fuel_name, old_price, new_price, changed_by, reason)
           VALUES ($1,$2,$3,$3,$4,$5)`,
          [stationId, fuel, newPrice, req.user!.name, reason ?? "Initial price set"]
        );
      } else {
        const oldPrice = current.rows[0].current_price;
        await client.query(
          `UPDATE fuel_prices SET previous_price = current_price, current_price = $1, effective_from = now()
           WHERE station_id = $2 AND fuel_name = $3`,
          [newPrice, stationId, fuel]
        );
        await client.query(
          `INSERT INTO price_history (station_id, fuel_name, old_price, new_price, changed_by, reason)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [stationId, fuel, oldPrice, newPrice, req.user!.name, reason ?? "Manual update"]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    res.status(200).json({ ok: true });
  })
);