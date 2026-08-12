import { Router } from "express";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

reportsRouter.get(
  "/sales-trend",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT to_char(d.day, 'Mon DD') AS d,
              COALESCE(SUM(st.amount_kes), 0)::float AS v
       FROM generate_series(CURRENT_DATE - interval '6 days', CURRENT_DATE, interval '1 day') AS d(day)
       LEFT JOIN sale_transactions st ON st.station_id = $1 AND st.created_at::date = d.day
       GROUP BY d.day ORDER BY d.day`,
      [stationId]
    );
    res.json(rows);
  })
);

reportsRouter.get(
  "/fuel-split",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { rows } = await pool.query(
      `SELECT product AS name, SUM(litres)::float AS value
       FROM sale_transactions WHERE station_id = $1 AND created_at >= CURRENT_DATE - interval '7 days'
       GROUP BY product ORDER BY value DESC`,
      [stationId]
    );
    res.json(rows);
  })
);

reportsRouter.get(
  "/by-station",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT s.name, COALESCE(SUM(st.amount_kes), 0)::float AS v
       FROM stations s LEFT JOIN sale_transactions st ON st.station_id = s.id
         AND st.created_at >= CURRENT_DATE - interval '7 days'
       GROUP BY s.name ORDER BY v DESC`
    );
    res.json(rows);
  })
);

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

/** Parses ?start=YYYY-MM-DD&end=YYYY-MM-DD, defaulting to the last 7 days
 * (inclusive of today) to match a sensible "This Period" default. */
function parseRange(req: import("express").Request): { start: string; end: string } {
  const end = typeof req.query.end === "string" ? req.query.end : new Date().toISOString().slice(0, 10);
  const start =
    typeof req.query.start === "string"
      ? req.query.start
      : new Date(Date.now() - 6 * 86400_000).toISOString().slice(0, 10);
  return { start, end };
}

/** The immediately-preceding period of the same length, for "vs Previous
 * Period" comparisons \u2014 e.g. May 19\u201325 compares against May 12\u201318. */
function previousRange(start: string, end: string): { prevStart: string; prevEnd: string } {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const rangeDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400_000) + 1;
  const prevEnd = new Date(startDate.getTime() - 86400_000);
  const prevStart = new Date(prevEnd.getTime() - (rangeDays - 1) * 86400_000);
  return { prevStart: prevStart.toISOString().slice(0, 10), prevEnd: prevEnd.toISOString().slice(0, 10) };
}

analyticsRouter.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { start, end } = parseRange(req);
    const { prevStart, prevEnd } = previousRange(start, end);

    const periodTotals = async (s: string, e: string) => {
      const { rows } = await pool.query(
        `SELECT COALESCE(SUM(amount_kes),0)::float AS revenue, COALESCE(SUM(litres),0)::float AS litres,
                COUNT(*)::int AS transactions
         FROM sale_transactions
         WHERE station_id = $1 AND status = 'completed' AND created_at::date BETWEEN $2 AND $3`,
        [stationId, s, e]
      );
      return rows[0];
    };
    const current = await periodTotals(start, end);
    const previous = await periodTotals(prevStart, prevEnd);
    const activeCustomers = await pool.query(`SELECT COUNT(*)::int AS n FROM crm_customers WHERE status = 'Active'`);

    // This vs Previous Period, aligned by day-offset within the range (not
    // by calendar date) so a Monday lines up with the prior period's Monday
    // regardless of which actual dates they fall on.
    const trend = await pool.query(
      `SELECT to_char(gs.day, 'Mon DD') AS d,
              COALESCE(cur.revenue, 0)::float AS current,
              COALESCE(prev.revenue, 0)::float AS previous
       FROM generate_series($2::date, $3::date, interval '1 day') AS gs(day)
       LEFT JOIN (
         SELECT created_at::date AS day, SUM(amount_kes) AS revenue FROM sale_transactions
         WHERE station_id = $1 AND status = 'completed' AND created_at::date BETWEEN $2 AND $3
         GROUP BY 1
       ) cur ON cur.day = gs.day
       LEFT JOIN (
         SELECT (created_at::date + ($3::date - $2::date) + 1) AS day, SUM(amount_kes) AS revenue
         FROM sale_transactions
         WHERE station_id = $1 AND status = 'completed' AND created_at::date BETWEEN $4 AND $5
         GROUP BY 1
       ) prev ON prev.day = gs.day
       ORDER BY gs.day`,
      [stationId, start, end, prevStart, prevEnd]
    );

    const byFuel = await pool.query(
      `SELECT product AS name, SUM(litres)::float AS value
       FROM sale_transactions
       WHERE station_id = $1 AND status = 'completed' AND created_at::date BETWEEN $2 AND $3
       GROUP BY product ORDER BY value DESC`,
      [stationId, start, end]
    );

    // Real day-of-week x hour-of-day heatmap of revenue \u2014 168 real cells
    // from actual sale_transactions timestamps, not illustrative data.
    const heatmap = await pool.query(
      `SELECT to_char(created_at, 'Dy') AS day, EXTRACT(HOUR FROM created_at)::int AS hour,
              SUM(amount_kes)::float AS value
       FROM sale_transactions
       WHERE station_id = $1 AND status = 'completed' AND created_at::date BETWEEN $2 AND $3
       GROUP BY 1, 2`,
      [stationId, start, end]
    );

    const fuelTrendRaw = await pool.query(
      `SELECT to_char(created_at::date, 'Mon DD') AS d, product, SUM(amount_kes)::float AS value
       FROM sale_transactions
       WHERE station_id = $1 AND status = 'completed' AND created_at::date BETWEEN $2 AND $3
       GROUP BY 1, product ORDER BY 1`,
      [stationId, start, end]
    );

    const topProducts = await pool.query(
      `SELECT product AS name, SUM(litres)::float AS value
       FROM sale_transactions
       WHERE station_id = $1 AND status = 'completed' AND created_at::date BETWEEN $2 AND $3
       GROUP BY product ORDER BY value DESC LIMIT 8`,
      [stationId, start, end]
    );

    const byPaymentMethod = await pool.query(
      `SELECT payment_method AS name, SUM(amount_kes)::float AS value
       FROM sale_transactions
       WHERE station_id = $1 AND status = 'completed' AND created_at::date BETWEEN $2 AND $3
       GROUP BY payment_method ORDER BY value DESC`,
      [stationId, start, end]
    );

    // Wide-format pivot for the multi-line "Sales by Fuel (Trend)" chart \u2014
    // one row per day, one column per product actually sold in the range.
    const products = Array.from(new Set(fuelTrendRaw.rows.map((r) => r.product)));
    const days = Array.from(new Set(fuelTrendRaw.rows.map((r) => r.d)));
    const fuelTrend = days.map((d) => {
      const row: Record<string, string | number> = { d };
      for (const p of products) {
        row[p] = fuelTrendRaw.rows.find((r) => r.d === d && r.product === p)?.value ?? 0;
      }
      return row;
    });

    res.json({
      range: { start, end, prevStart, prevEnd },
      summary: {
        current: { ...current, avgTicket: current.transactions ? current.revenue / current.transactions : 0 },
        previous: { ...previous, avgTicket: previous.transactions ? previous.revenue / previous.transactions : 0 },
        activeCustomers: activeCustomers.rows[0].n,
      },
      trend: trend.rows,
      byFuel: byFuel.rows,
      heatmap: heatmap.rows,
      fuelTrend,
      products,
      topProducts: topProducts.rows,
      byPaymentMethod: byPaymentMethod.rows,
    });
  })
);

analyticsRouter.get(
  "/top-customers",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT name, total_spent_kes::float AS value FROM crm_customers ORDER BY total_spent_kes DESC LIMIT 5`
    );
    res.json(rows);
  })
);

analyticsRouter.get(
  "/sales-by-hour",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { start, end } = parseRange(req);
    const { rows } = await pool.query(
      `SELECT h AS hour, COALESCE(SUM(st.amount_kes), 0)::float AS v
       FROM generate_series(0, 23) AS h
       LEFT JOIN sale_transactions st
         ON st.station_id = $1 AND st.status = 'completed' AND st.created_at::date BETWEEN $2 AND $3
         AND EXTRACT(HOUR FROM st.created_at)::int = h
       GROUP BY h ORDER BY h`,
      [stationId, start, end]
    );
    res.json(rows.map((r) => ({ h: `${r.hour}:00`, v: r.v })));
  })
);

analyticsRouter.get(
  "/top-products-detail",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { start, end } = parseRange(req);
    const { rows } = await pool.query(
      `SELECT product AS name, SUM(amount_kes)::float AS kes, SUM(litres)::float AS litres
       FROM sale_transactions
       WHERE station_id = $1 AND status = 'completed' AND created_at::date BETWEEN $2 AND $3
       GROUP BY product ORDER BY kes DESC LIMIT 8`,
      [stationId, start, end]
    );
    res.json(rows);
  })
);

analyticsRouter.get(
  "/fuel-litres-trend",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { start, end } = parseRange(req);
    const raw = await pool.query(
      `SELECT to_char(created_at::date, 'Mon DD') AS d, product, SUM(litres)::float AS value
       FROM sale_transactions
       WHERE station_id = $1 AND status = 'completed' AND created_at::date BETWEEN $2 AND $3
       GROUP BY 1, product ORDER BY 1`,
      [stationId, start, end]
    );
    const products = Array.from(new Set(raw.rows.map((r) => r.product)));
    const days = Array.from(new Set(raw.rows.map((r) => r.d)));
    const trend = days.map((d) => {
      const row: Record<string, string | number> = { d };
      for (const p of products) {
        row[p] = raw.rows.find((r) => r.d === d && r.product === p)?.value ?? 0;
      }
      return row;
    });
    res.json({ trend, products });
  })
);

analyticsRouter.get(
  "/top-pumps",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { start, end } = parseRange(req);
    const { rows } = await pool.query(
      `SELECT p.name, SUM(st.litres)::float AS litres
       FROM sale_transactions st JOIN pumps p ON p.id = st.pump_id
       WHERE st.station_id = $1 AND st.status = 'completed' AND st.created_at::date BETWEEN $2 AND $3
       GROUP BY p.name ORDER BY litres DESC LIMIT 8`,
      [stationId, start, end]
    );
    res.json(rows);
  })
);

analyticsRouter.get(
  "/operations",
  asyncHandler(async (req, res) => {
    const stationId = req.user!.stationId;
    const { start, end } = parseRange(req);

    const controllers = await pool.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'online')::int AS online,
              COALESCE(AVG(uptime_seconds), 0)::float AS "avgUptimeSeconds"
       FROM controllers WHERE station_id = $1`,
      [stationId]
    );
    const pumps = await pool.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status IN ('dispensing','idle'))::int AS operational
       FROM pumps WHERE station_id = $1`,
      [stationId]
    );
    const nozzles = await pool.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE n.status IN ('online','dispensing'))::int AS active
       FROM nozzles n JOIN pumps p ON p.id = n.pump_id WHERE p.station_id = $1`,
      [stationId]
    );
    const activeHoursByPump = await pool.query(
      `SELECT p.name, COUNT(DISTINCT date_trunc('hour', st.created_at))::int AS hours
       FROM sale_transactions st JOIN pumps p ON p.id = st.pump_id
       WHERE st.station_id = $1 AND st.status = 'completed' AND st.created_at::date BETWEEN $2 AND $3
       GROUP BY p.name ORDER BY hours DESC LIMIT 8`,
      [stationId, start, end]
    );

    const c = controllers.rows[0];
    const avgUptimeDays = Math.round((c.avgUptimeSeconds / 86400) * 10) / 10;

    res.json({
      activeHoursByPump: activeHoursByPump.rows,
      kpis: {
        controllersOnline: `${c.online} / ${c.total}`,
        avgControllerUptimeDays: avgUptimeDays,
        pumpsOperational: `${pumps.rows[0].operational} / ${pumps.rows[0].total}`,
        nozzlesActive: `${nozzles.rows[0].active} / ${nozzles.rows[0].total}`,
      },
    });
  })
);