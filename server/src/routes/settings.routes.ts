import { Router } from "express";
import { spawn } from "node:child_process";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

const DEFAULTS = {
  general: {
    stationName: "",
    timezone: "Africa/Nairobi",
    currency: "KES (KSh)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12 Hour",
    language: "English",
    businessType: "Fuel Station",
    fiscalYearStart: "January",
    financialPeriod: "Monthly",
    taxRate: 16,
    roundOff: "Nearest 0.01",
    fuelPriceManagementEnabled: true,
    allowPriceOverrides: true,
    lowStockAlertPct: 10,
    autoFuelReorder: true,
    fuelReorderThresholdL: 500,
    defaultFuelType: "Diesel (ENS90)",
    autoSync: true,
    offlineMode: true,
    systemLogs: true,
    dataBackup: true,
    userActivityLogging: true,
    maintenanceReminders: true,
    dashboardLayout: "Standard",
    defaultDateRange: "Last 7 Days",
    itemsPerPage: 25,
    volumeUnit: "Liters (L)",
    temperatureUnit: "Celsius (\u00b0C)",
    pressureUnit: "Bar",
    distanceUnit: "Kilometers (km)",
  },
  fuelPricing: {
    priceRounding: "Nearest 1.00",
    minMarginThresholdPct: 8,
    requireApprovalForPriceChanges: true,
    regionalPricing: false,
    priceEffectiveDelay: "Immediate",
    scheduledUpdatesEnabled: true,
    updateTime: "10:00 AM Daily",
    priceSource: "Manual Entry",
    notifyCashiersOnPriceChange: true,
    lowMarginAlerts: true,
    marginAlertThresholdPct: 5,
    competitorPriceTracking: false,
    autoSuggestPriceAdjustments: false,
  },
  devices: {
    controllerPollingIntervalMs: 500,
    controllerCommandTimeoutMs: 3000,
    autoReconnectOnFailure: true,
    failoverToBackupController: true,
    atgPollingIntervalSec: 30,
    waterAlarmThresholdCm: 1.0,
    autoSyncVolumeReadings: true,
    temperatureCompensation: true,
  },
  integrations: {
    "kra-etims": { connected: false, label: "" },
    "mpesa-daraja": { connected: false, label: "" },
    "sms-gateway": { connected: false, label: "" },
    "email-provider": { connected: false, label: "" },
    "accounting-export": { connected: false, label: "" },
  } as Record<string, { connected: boolean; label: string }>,
  notifications: {
    lowFuelAlerts: true,
    maintenanceReminders: true,
    tankLevelAlerts: true,
    systemUpdates: true,
    salesRevenueAlerts: true,
    securityAlerts: true,
    fleetAccountOverLimit: true,
    deliveryStatusChanges: true,
    channelInApp: true,
    channelEmail: true,
    channelSms: false,
    channelPush: true,
    digestFrequency: "Real-time",
  },
  security: {
    passwordPolicy: "Strong",
    sessionTimeoutMinutes: 30,
    twoFactorEnabled: false,
    requirePinForCriticalActions: true,
    maxLoginAttempts: 5,
    apiAccessEnabled: true,
    apiRateLimit: 120,
    ipAllowlistEnabled: false,
    deviceSessionTracking: true,
    fullAuditLogging: true,
    logRetentionMonths: 12,
    alertOnSuspiciousActivity: true,
  },
  backup: {
    automaticDailyBackup: true,
    backupTime: "02:00 AM",
    retentionDays: 90,
    lastBackupAt: null as string | null,
  },
  appearance: {
    mode: "Dark",
    accentColor: "#f9a826",
    dashboardDensity: "Comfortable",
    sidebarDefaultState: "Expanded",
    showKpiDeltas: true,
    baseFontSize: "Medium",
    numberFormat: "1,234.56",
    useMonospaceForFigures: true,
  },
};

function mergeDefaults(saved: any) {
  // Deep-ish merge so a settings blob saved before a new field existed still
  // gets a sane default for that field instead of `undefined` in the UI.
  const merged: any = {};
  for (const section of Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]) {
    merged[section] = { ...(DEFAULTS[section] as object), ...(saved?.[section] ?? {}) };
  }
  return merged;
}

settingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(`SELECT data FROM station_settings WHERE station_id = $1`, [stationId]);
    res.json(mergeDefaults(rows[0]?.data));
  })
);

// Lightweight endpoint for applying the saved theme immediately on app
// load, without fetching (and merging defaults for) the entire settings
// blob just to read two fields.
settingsRouter.get(
  "/appearance",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(`SELECT data FROM station_settings WHERE station_id = $1`, [stationId]);
    const merged = mergeDefaults(rows[0]?.data);
    res.json(merged.appearance);
  })
);

settingsRouter.put(
  "/",
  requireRole("Manager", "Administrator"),
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `INSERT INTO station_settings (station_id, data, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (station_id) DO UPDATE SET data = $2, updated_at = now()
       RETURNING data`,
      [stationId, JSON.stringify(req.body ?? {})]
    );
    res.json(mergeDefaults(rows[0].data));
  })
);

/**
 * Runs a real `pg_dump` against this database and streams it back as a
 * downloadable .sql file. This is a genuine logical backup, not a simulated
 * one \u2014 restoring it is a real `psql < backup.sql` away. It dumps the
 * whole database rather than just this station's rows, since a partial
 * per-station SQL dump that still respects foreign keys (users, controllers,
 * etc. are shared/referenced across stations) isn't a meaningfully restorable
 * artifact on its own.
 */
settingsRouter.get(
  "/backup",
  requireRole("Administrator"),
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new HttpError(500, "DATABASE_URL is not configured");

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    res.setHeader("Content-Type", "application/sql");
    res.setHeader("Content-Disposition", `attachment; filename="fuelmaster-backup-${stamp}.sql"`);

    const dump = spawn("pg_dump", [databaseUrl]);
    dump.stdout.pipe(res);
    dump.stderr.on("data", (chunk) => console.error("[pg_dump]", chunk.toString()));
    dump.on("error", (err) => {
      console.error("[pg_dump] failed to start:", err);
      if (!res.headersSent) res.status(500).json({ error: "Backup failed to start" });
    });

    dump.on("close", async (code) => {
      if (code === 0) {
        // Record that a backup actually happened, for real, in the
        // System Information panel \u2014 not a hardcoded timestamp.
        await pool.query(
          `UPDATE station_settings
           SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{backup,lastBackupAt}', to_jsonb(now()::text), true)
           WHERE station_id = $1`,
          [stationId]
        );
      }
    });
  })
);