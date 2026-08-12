import { Pool, type QueryResultRow } from "pg";
import "dotenv/config";

const isProd = process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Most managed Postgres providers (Railway, Render, RDS, etc.) require SSL
  // and present a certificate that isn't in Node's default trust store.
  // `rejectUnauthorized: false` still encrypts the connection, it just skips
  // CA verification \u2014 the standard approach for these providers unless
  // you're supplying their specific CA cert. Local dev Postgres has no SSL
  // configured, so this only applies in production.
  ssl: isProd ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("Unexpected error on idle Postgres client", err);
});

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]) {
  return pool.query<T>(text, params);
}