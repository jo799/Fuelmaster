import { Router } from "express";
import os from "node:os";
import fs from "node:fs";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const systemHealthRouter = Router();
systemHealthRouter.use(requireAuth);

const startedAt = Date.now();

systemHealthRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const dbStart = Date.now();
    let dbHealthy = true;
    try {
      await pool.query("SELECT 1");
    } catch {
      dbHealthy = false;
    }
    const dbLatency = Date.now() - dbStart;

    const controllers = await pool.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'online')::int AS online FROM controllers`
    );
    const tanks = await pool.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE atg_online)::int AS online FROM tanks`
    );

    const load = os.loadavg()[0];
    const cpuPct = Math.min(99, Math.round((load / os.cpus().length) * 100));
    const memPct = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);

    // Real disk usage for the filesystem this process runs on \u2014
    // fs.statfsSync has been available since Node 18.15, no extra package
    // needed.
    let diskPct = 0;
    try {
      const stats = fs.statfsSync(".");
      const used = stats.blocks - stats.bfree;
      diskPct = Math.round((used / stats.blocks) * 100);
    } catch {
      diskPct = 0;
    }

    const allServicesHealthy =
      dbHealthy &&
      controllers.rows[0].online === controllers.rows[0].total &&
      tanks.rows[0].online === tanks.rows[0].total;

    res.json({
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      resources: { cpu: cpuPct, ram: memPct, disk: diskPct },
      dbConnections: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount },
      overallHealthy: allServicesHealthy,
      services: [
        { name: "PostgreSQL", status: dbHealthy ? "Healthy" : "Down", detail: `${dbLatency} ms query` },
        { name: "REST API", status: "Healthy", detail: "Express + Node" },
        { name: "Controllers", status: controllers.rows[0].online === controllers.rows[0].total ? "Healthy" : "Degraded", detail: `${controllers.rows[0].online} / ${controllers.rows[0].total} online` },
        { name: "Tank Gauges (ATG)", status: tanks.rows[0].online === tanks.rows[0].total ? "Healthy" : "Degraded", detail: `${tanks.rows[0].online} / ${tanks.rows[0].total} online` },
      ],
    });
  })
);