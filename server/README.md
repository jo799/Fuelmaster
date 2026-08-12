# FuelMaster API

Express + TypeScript backend for FuelMaster: JWT auth, a full PostgreSQL schema
covering all 27 dashboard modules, and a WebSocket telemetry gateway that a
real on-site edge service can plug straight into.

## Architecture

```
Browser (Dashboard)  <--REST (JWT)-->  Express API  <-->  PostgreSQL
        |                                    |
        '--------WS /ws/dashboard----->  WS Gateway  <---WS /ws/edge---  Edge Service
                                                                          (real hardware
                                                                           poller, or
                                                                           edgeSimulator.ts
                                                                           for local dev)
```

The WebSocket gateway (`src/ws/telemetryServer.ts`) is protocol-first: an edge
service authenticates with `EDGE_SERVICE_TOKEN`, pushes `pump_update` frames,
and the gateway persists them to Postgres and broadcasts to any subscribed
dashboard clients for that station. `src/ws/edgeSimulator.ts` speaks that same
protocol so you get live-feeling data locally — swap it for your real
Waspan-style edge service later with zero changes on the backend or frontend
side, since they both just speak the WS protocol, not to the simulator itself.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ running locally (or update `DATABASE_URL` to point elsewhere)

## Setup

```bash
cd server
npm install

# Create the database (adjust user/password to match your local Postgres)
psql -U postgres -c "CREATE DATABASE fuelmaster;"

# Copy/edit .env — a working dev default is already included, just change
# DATABASE_URL if your local Postgres user/password differ
# (see .env in this folder)

npm run db:migrate   # creates all 24 tables
npm run db:seed      # populates realistic starter data + 7 dev users
```

## Running

You need **three processes** running for the full live experience (four
counting the frontend):

```bash
# Terminal 1 — API + WebSocket gateway
npm run dev

# Terminal 2 — edge service simulator (optional but recommended;
# without it pumps just sit at their seeded values, no live movement)
npm run edge:simulate

# Terminal 3 — frontend (from the project root, not server/)
cd ..
npm run dev
```

Then open the frontend (usually `http://localhost:5173`) and log in.

## Dev login

Every seeded user's password is `password123`. Try:

| Email | Role |
|---|---|
| `admin@fuelmaster.dev` | Administrator |
| `john.kamau@fuelmaster.dev` | Manager |
| `amina.juma@fuelmaster.dev` | Controller |
| `david.kimani@fuelmaster.dev` | Cashier |

## Project layout

```
src/
  index.ts                 Express app bootstrap, mounts all routers + starts WS gateway
  db/
    schema.sql               Full schema — 24 tables, run via db:migrate
    pool.ts                  pg connection pool
    migrate.ts               Applies schema.sql (idempotent, CREATE TABLE IF NOT EXISTS)
    seed.ts                  Wipes + repopulates all tables with realistic data
  middleware/
    auth.ts                   requireAuth / requireRole JWT middleware
    errorHandler.ts            asyncHandler wrapper + centralized error responses
  utils/jwt.ts                Access/refresh token signing & verification
  routes/                    One file per module (auth, dashboard, sales, pos,
                              dispensers, nozzles, tanks, controllers, inventory,
                              deliveries, priceManagement, fleetAccounts, loyalty,
                              crm, cashManagement, shifts, maintenance, finance,
                              alerts, auditLogs, users, reports, systemHealth, settings)
  ws/
    telemetryServer.ts        WS gateway: /ws/dashboard (browser) + /ws/edge (hardware)
    edgeSimulator.ts          Local dev stand-in for a real edge service
```

## Auth model

- `POST /api/auth/login` — returns a short-lived access token (15 min) in the
  response body and sets an httpOnly refresh-token cookie (7 days)
- `POST /api/auth/refresh` — silently exchanges the refresh cookie for a new
  access token; the frontend's `apiFetch` calls this automatically on a 401
- `POST /api/auth/logout` — revokes the refresh token
- Every other route requires `Authorization: Bearer <accessToken>` via
  `requireAuth`; some (creating users, changing prices) additionally require
  `requireRole(...)`

## What's live vs. still illustrative

All 27 sidebar modules render real backend data for their primary table/list.
A few secondary widgets on some pages are still local mock data because they'd
need either multi-station aggregation (this backend is single-station-scoped
per logged-in user) or additional endpoints that weren't essential to prove
the architecture out:

- **Cash Management** — the multi-station "Cash Position by Station" comparison bars
- **Finance** — the "Revenue vs Expenses over time" trend line and the multi-station comparison table/chart
- **Maintenance** — "Upcoming Preventive Maintenance" list and "Assets by Status" bars
- **Price Management** — the 7-day multi-fuel price trend line
- **Reports / Analytics** — most sub-tab charts (Sales Overview's trend + fuel-split are live via `/reports/*`; the rest still use the original mock data)
- **Settings** — reads/writes a JSONB blob per station (`GET`/`PUT /api/settings`) but the form fields aren't wired to it yet — still display-only

Everything else — Dashboard, Live Forecourt (WebSocket), Sales, POS (real
transaction creation), Dispensers, Nozzles, Fuel Tanks, Tank Gauges,
Controllers, Deliveries, Fleet Accounts, Inventory, Loyalty, CRM, Shifts,
Users, Administration, Alerts (with working Acknowledge/Resolve actions),
Audit Logs, and System Health — is fully wired to Postgres.
