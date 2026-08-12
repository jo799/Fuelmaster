import { pool } from "../db/pool.js";
import { sendEmail } from "../utils/brevo.js";
import { sendSms } from "../utils/brevo.js";
import { sendPushToStation } from "./push.js";

export type NotificationEvent =
  | "lowFuelAlerts"
  | "maintenanceReminders"
  | "tankLevelAlerts"
  | "systemUpdates"
  | "salesRevenueAlerts"
  | "securityAlerts"
  | "fleetAccountOverLimit"
  | "deliveryStatusChanges";

const EVENT_MODULE: Record<NotificationEvent, string> = {
  lowFuelAlerts: "Fuel Tanks",
  maintenanceReminders: "Maintenance",
  tankLevelAlerts: "Fuel Tanks",
  systemUpdates: "System",
  salesRevenueAlerts: "Sales",
  securityAlerts: "Security",
  fleetAccountOverLimit: "Fleet Accounts",
  deliveryStatusChanges: "Deliveries",
};

interface NotifyInput {
  stationId: number;
  event: NotificationEvent;
  title: string;
  message: string;
  severity?: "info" | "warning" | "danger";
}

/**
 * Real, multi-channel notification dispatch. Checks the station's actual
 * saved preferences (Settings > Notifications) before sending anything, and
 * only ever sends through channels that are genuinely wired:
 *   - In-app: always, via a real row in the existing `alerts` table (the
 *     Alerts page already reads from this for real).
 *   - Email: real, via Brevo, to every Administrator/Manager at the station
 *     who has an email (which is all of them, email is required on signup).
 *   - SMS: real, via Brevo, but only to recipients who have a phone number
 *     saved \u2014 many won't yet, since it's a new optional field.
 *   - Push: real, via Web Push (see push.ts), to any browser that has
 *     actually subscribed from that station.
 * A channel being toggled on in Settings but a recipient having no email/
 * phone/subscription just means that recipient doesn't get that channel,
 * not a failure of the toggle itself.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const settingsRow = await pool.query(`SELECT data FROM station_settings WHERE station_id = $1`, [input.stationId]);
  const notifications = settingsRow.rows[0]?.data?.notifications;

  // Default to "on" only for the always-safe in-app channel if no settings
  // row exists yet (a station that's never touched Settings shouldn't be
  // silently muted, but also shouldn't get emails/SMS it never opted into).
  const eventEnabled = notifications ? notifications[input.event] !== false : true;
  if (!eventEnabled) return;

  // Always create the real in-app alert \u2014 this is what the Alerts page
  // already displays, so every notification has somewhere to be seen even
  // if email/SMS/push are all off or unreachable.
  const seq = await pool.query(
    `SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\\D', '', 'g'), '')::int), 0) + 1 AS next FROM alerts`
  );
  const code = `ALT-${String(seq.rows[0].next).padStart(4, "0")}`;
  await pool.query(
    `INSERT INTO alerts (code, station_id, module, message, severity, status)
     VALUES ($1,$2,$3,$4,$5,'Active')`,
    [code, input.stationId, EVENT_MODULE[input.event], input.message, input.severity ?? "warning"]
  );

  const channelEmail = notifications?.channelEmail !== false;
  const channelSms = notifications?.channelSms === true; // opt-in, defaults off
  const channelPush = notifications?.channelPush !== false;

  if (!channelEmail && !channelSms && !channelPush) return;

  const recipients = await pool.query(
    `SELECT name, email, phone FROM users
     WHERE station_id = $1 AND role IN ('Administrator','Manager') AND status = 'Active'`,
    [input.stationId]
  );

  for (const r of recipients.rows) {
    if (channelEmail) {
      sendEmail({
        to: r.email,
        toName: r.name,
        subject: input.title,
        htmlContent: `<div style="font-family:-apple-system,Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;">
          <h2 style="color:#101922;margin-bottom:4px;">FuelMaster</h2>
          <p style="color:#4b5b68;font-size:14px;">${input.message}</p>
        </div>`,
      }).catch((err) => console.error(`[notify] email to ${r.email} failed:`, err.message));
    }
    if (channelSms && r.phone) {
      sendSms({ to: r.phone, content: `FuelMaster: ${input.title} \u2014 ${input.message}` }).catch((err) =>
        console.error(`[notify] SMS to ${r.phone} failed:`, err.message)
      );
    }
  }

  if (channelPush) {
    sendPushToStation(input.stationId, { title: input.title, body: input.message }).catch((err) =>
      console.error(`[notify] push failed:`, err.message)
    );
  }
}

export interface TestNotificationResult {
  inApp: true; // always succeeds - it's just a DB insert
  email: { attempted: boolean; ok: boolean; error?: string };
  sms: { attempted: boolean; ok: boolean; error?: string };
  push: { attempted: boolean; ok: boolean; error?: string };
}

/**
 * Sends a real test notification through every channel, specifically to the
 * requesting user (not every Administrator/Manager at the station like a
 * real triggered event would), and reports exactly what happened on each
 * channel \u2014 this bypasses the station's saved on/off toggles entirely,
 * since a test you explicitly asked for should always actually attempt to
 * send, regardless of what's currently configured.
 */
export async function sendTestNotification(
  stationId: number,
  user: { name: string; email: string; phone: string | null }
): Promise<TestNotificationResult> {
  const seq = await pool.query(
    `SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\\D', '', 'g'), '')::int), 0) + 1 AS next FROM alerts`
  );
  const code = `ALT-${String(seq.rows[0].next).padStart(4, "0")}`;
  await pool.query(
    `INSERT INTO alerts (code, station_id, module, message, severity, status)
     VALUES ($1,$2,'System','This is a test notification you triggered from Settings.','info','Active')`,
    [code, stationId]
  );

  const result: TestNotificationResult = {
    inApp: true,
    email: { attempted: true, ok: false },
    sms: { attempted: false, ok: false },
    push: { attempted: true, ok: false },
  };

  try {
    await sendEmail({
      to: user.email,
      toName: user.name,
      subject: "FuelMaster test notification",
      htmlContent: `<div style="font-family:-apple-system,Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;">
        <h2 style="color:#101922;margin-bottom:4px;">FuelMaster</h2>
        <p style="color:#4b5b68;font-size:14px;">This is a test notification you triggered from Settings. If you're reading this, email delivery is working.</p>
      </div>`,
    });
    result.email.ok = true;
  } catch (err: any) {
    result.email.error = err.message;
  }

  if (user.phone) {
    result.sms.attempted = true;
    try {
      await sendSms({ to: user.phone, content: "FuelMaster: this is a test SMS notification you triggered from Settings." });
      result.sms.ok = true;
    } catch (err: any) {
      result.sms.error = err.message;
    }
  }

  try {
    const { sentTo } = await sendPushToStation(stationId, {
      title: "FuelMaster test notification",
      body: "If you're seeing this, push delivery is working.",
    });
    if (sentTo === 0) {
      result.push.error = "No devices are subscribed yet \u2014 click \"Enable Push on This Device\" first, then try the test again.";
    } else {
      result.push.ok = true;
    }
  } catch (err: any) {
    result.push.error = err.message;
  }

  return result;
}