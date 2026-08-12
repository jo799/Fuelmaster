import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { authRouter } from "./routes/auth.routes.js";
import { stationsRouter } from "./routes/stations.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { salesRouter } from "./routes/sales.routes.js";
import { posRouter } from "./routes/pos.routes.js";
import { dispensersRouter } from "./routes/dispensers.routes.js";
import { nozzlesRouter } from "./routes/nozzles.routes.js";
import { tanksRouter } from "./routes/tanks.routes.js";
import { controllersRouter } from "./routes/controllers.routes.js";
import { inventoryRouter } from "./routes/inventory.routes.js";
import { deliveriesRouter } from "./routes/deliveries.routes.js";
import { priceManagementRouter } from "./routes/priceManagement.routes.js";
import { fleetAccountsRouter } from "./routes/fleetAccounts.routes.js";
import { loyaltyRouter } from "./routes/loyalty.routes.js";
import { crmRouter } from "./routes/crm.routes.js";
import { cashManagementRouter } from "./routes/cashManagement.routes.js";
import { shiftsRouter } from "./routes/shifts.routes.js";
import { maintenanceRouter } from "./routes/maintenance.routes.js";
import { financeRouter } from "./routes/finance.routes.js";
import { alertsRouter } from "./routes/alerts.routes.js";
import { auditLogsRouter } from "./routes/auditLogs.routes.js";
import { usersRouter } from "./routes/users.routes.js";
import { reportsRouter, analyticsRouter } from "./routes/reports.routes.js";
import { systemHealthRouter } from "./routes/systemHealth.routes.js";
import { settingsRouter } from "./routes/settings.routes.js";
import { pushRouter } from "./routes/push.routes.js";
import { notificationsRouter } from "./routes/notifications.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { startTelemetryServer } from "./ws/telemetryServer.js";

const app = express();
const isProd = process.env.NODE_ENV === "production";

// Required for correct client IPs (and therefore correct rate limiting) when
// running behind a reverse proxy \u2014 Railway, Render, nginx, etc. all sit in
// front of the app and forward the real client IP via X-Forwarded-For.
// Without this, express-rate-limit sees the proxy's IP for every request and
// either rate-limits all users as one client or fails to limit anyone.
if (isProd) app.set("trust proxy", 1);

app.use(helmet());
const allowedOrigins = process.env.CORS_ORIGIN?.split(",");

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header (e.g. curl, server-to-server) — allow.
      if (!origin) return callback(null, true);
      // Explicit allowlist from .env, if set.
      if (allowedOrigins?.includes(origin)) return callback(null, true);
      // Local dev only: accept any localhost/127.0.0.1 port so a Vite dev
      // server that had to pick a different port (5173 was busy, etc.)
      // still works without silently failing every request. This must never
      // apply in production \u2014 it would let any local process on the
      // deployed machine's "localhost" bypass CORS, and production traffic
      // never legitimately originates from localhost anyway.
      if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(morgan(isProd ? "combined" : "dev"));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const loginRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

// /refresh fires automatically on every page load and every station switch
// (which reloads the page) \u2014 it's not a password-guessing target the way
// /login is, so it gets a much more generous ceiling. This just guards
// against a genuinely broken client hammering the endpoint in a loop, not
// normal usage.
const refreshRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many refresh attempts. Please wait a moment and try again." },
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "fuelmaster-api" }));

app.use("/api/auth/login", loginRateLimit);
app.use("/api/auth/verify-2fa", loginRateLimit);
app.use("/api/auth/resend-2fa", loginRateLimit);
app.use("/api/auth/signup", loginRateLimit);
app.use("/api/auth/verify-signup", loginRateLimit);
app.use("/api/auth/resend-signup", loginRateLimit);
app.use("/api/auth/refresh", refreshRateLimit);
app.use("/api/auth", authRouter);
app.use("/api/stations", stationsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/sales", salesRouter);
app.use("/api/pos", posRouter);
app.use("/api/dispensers", dispensersRouter);
app.use("/api/nozzles", nozzlesRouter);
app.use("/api/tanks", tanksRouter);
app.use("/api/tank-gauges", tanksRouter);
app.use("/api/controllers", controllersRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/deliveries", deliveriesRouter);
app.use("/api/price-management", priceManagementRouter);
app.use("/api/fleet-accounts", fleetAccountsRouter);
app.use("/api/loyalty", loyaltyRouter);
app.use("/api/crm", crmRouter);
app.use("/api/cash-management", cashManagementRouter);
app.use("/api/shifts", shiftsRouter);
app.use("/api/maintenance", maintenanceRouter);
app.use("/api/finance", financeRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/audit-logs", auditLogsRouter);
app.use("/api/users", usersRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/system-health", systemHealthRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/push", pushRouter);
app.use("/api/notifications", notificationsRouter);

app.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.path}` }));
app.use(errorHandler);

const PORT = Number(process.env.PORT ?? 4000);
const WS_PORT = Number(process.env.WS_PORT ?? 4001);

app.listen(PORT, () => {
  console.log(`[api] FuelMaster API listening on http://localhost:${PORT}`);
});

startTelemetryServer(WS_PORT);