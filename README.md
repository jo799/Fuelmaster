# FuelMaster — Forecourt Management System

A full-stack implementation of the FuelMaster design: dark industrial
SCADA-style UI (React + TypeScript + Tailwind v4) backed by a real Express +
PostgreSQL API with JWT auth and a WebSocket telemetry gateway.

All **27 sidebar modules** are built and navigable. Most are wired to live
backend data; a handful of secondary widgets are still local mock data where
they'd need multi-station aggregation this backend doesn't do yet. Full
breakdown in `server/README.md`.

## Quick start

You need Node.js 20+ and a local PostgreSQL instance.

```bash
# 1. Backend
cd server
npm install
psql -U postgres -c "CREATE DATABASE fuelmaster;"
npm run db:migrate
npm run db:seed
npm run dev              # Terminal 1 — API on :4000, WS gateway on :4001

npm run edge:simulate    # Terminal 2 — optional live pump telemetry

# 2. Frontend
cd ..
npm install
npm run dev               # Terminal 3 — usually http://localhost:5173
```

Log in with `admin@fuelmaster.dev` / `password123` (any seeded user works —
see `server/README.md` for the full list).

## Stack

**Frontend**
- Vite + React 19 + TypeScript
- Tailwind CSS v4 (CSS-first config via `@theme` in `src/index.css`)
- recharts for all charts
- lucide-react for icons

**Backend** (`server/`)
- Express + TypeScript
- PostgreSQL (raw `pg`, no ORM — schema in `server/src/db/schema.sql`)
- JWT auth (short-lived access token + httpOnly refresh cookie)
- `ws` for the telemetry gateway

## Project structure

```
src/
  types.ts                 Shared domain types
  data/mock.ts              Fallback/seed-shaped mock data (used as initial
                             paint before the first API response lands, and
                             as a graceful fallback if a request fails)
  lib/
    api.ts                   Typed fetch client — JWT injection, auto-refresh on 401
    useApiData.ts             Generic GET-fetch hook (loading/error/refetch)
    AuthContext.tsx            Login/logout/session bootstrap
    usePumpTelemetry.ts        WebSocket hook for live Dashboard pump data
  components/                Sidebar, TopBar (real user + logout), StatusFooter,
                              KpiCards, LiveForecourtMap, PumpOverviewTable,
                              RightRail, ui/primitives.tsx, ui/TankCylinder.tsx
  pages/                     One file per module — Login.tsx plus all 27
                              sidebar modules
  App.tsx                   Auth gating + routing + live Dashboard composition

server/                    See server/README.md for full backend docs
```

## Design tokens

All theming lives in `src/index.css` under `@theme`:

| Token | Value |
|---|---|
| `--color-bg` | `#081018` |
| `--color-panel` | `#101b26` |
| `--color-card` | `#132330` |
| `--color-accent` | `#f9a826` |
| `--color-success` | `#17c964` |
| `--color-warning` | `#f5a524` |
| `--color-danger` | `#f31260` |
| `--color-info` | `#38bdf8` |

## Next steps

- Wire the remaining mock widgets listed in `server/README.md`
- Replace `edgeSimulator.ts` with a real on-site edge service speaking the
  same `/ws/edge` protocol (see `server/src/ws/telemetryServer.ts`)
- Add Redis/RabbitMQ if you outgrow single-process WS fan-out across
  multiple API instances
