import webpush from "web-push";
import { pool } from "../db/pool.js";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:noreply@fuelmaster.dev";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set in .env to send push notifications.");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
}

/**
 * Sends a real, VAPID-signed push message to every browser that has
 * subscribed for this station. A subscription failing with 404/410 means
 * the browser unsubscribed or the subscription expired \u2014 that row is
 * cleaned up rather than retried forever.
 */
export async function sendPushToStation(stationId: number, payload: PushPayload): Promise<{ sentTo: number }> {
  ensureConfigured();

  const { rows } = await pool.query(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE station_id = $1`,
    [stationId]
  );

  await Promise.all(
    rows.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await pool.query(`DELETE FROM push_subscriptions WHERE id = $1`, [sub.id]);
        } else {
          console.error(`[push] failed to send to subscription ${sub.id}:`, err.message);
        }
      }
    })
  );

  return { sentTo: rows.length };
}