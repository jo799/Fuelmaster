# FuelMaster

A full-stack forecourt and point-of-sale management platform designed for fuel-station operations, covering multi-station management, real-time pump and tank telemetry, hardware integration, sales, inventory, financial operations, staff management, customer accounts, and day-to-day retail workflows.

Originally scoped for **Waspan Enterprises**, a Nairobi-based petroleum engineering firm, FuelMaster was designed as a technology-driven alternative to manual tank dipping and disconnected point-of-sale and forecourt hardware workflows.

---

## Overview

FuelMaster is an end-to-end operational application rather than a UI prototype. Core operational modules are backed by a real **Express/PostgreSQL API**, while forecourt telemetry is delivered through an authenticated **WebSocket gateway**.

The platform is designed around a clear separation between the user-facing application, backend services, database, and forecourt hardware integration layer.

Where functionality is not yet production-complete—primarily a small number of secondary analytics widgets and vendor-specific FCC protocol parsing—it is explicitly identified under [Known Limitations](#known-limitations).

---

## Architecture

```text
┌───────────────────────────────┐
│        React Frontend         │
│     Dashboard / POS / UI      │
└───────────────┬───────────────┘
                │
          REST / JWT
                │
                ▼
┌───────────────────────────────┐
│       Express API             │
│        TypeScript             │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│        PostgreSQL             │
│   Operational Data / Audit    │
└───────────────────────────────┘

                │
                │ WebSocket
                ▼
┌───────────────────────────────┐
│       WebSocket Gateway       │
│   /ws/dashboard /ws/edge      │
└───────────────┬───────────────┘
                │
        Authenticated WS
                │
                ▼
┌───────────────────────────────┐
│       Forecourt Daemon        │
│      Hardware Integration     │
└───────────────┬───────────────┘
                │
          TCP / Serial
                │
                ▼
┌───────────────────────────────┐
│       FCC / ATG Hardware      │
│ Fuel Controller / Tank Gauge  │
└───────────────────────────────┘
```

### Hardware Integration

The POS and dashboard do **not communicate directly with forecourt hardware**.

A dedicated **Forecourt Daemon** process owns the hardware connection. It is responsible for communicating with the fuel controller (FCC) and automatic tank gauge (ATG), normalizing telemetry, and forwarding station data through an authenticated WebSocket connection.

Each station can authenticate its own edge daemon using a station-specific credential generated through:

```text
POST /api/stations/:id/edge-token/rotate
```

This avoids relying on a single shared credential across all stations.

The hardware layer uses driver abstractions such as:

```text
FccDriver
AtgDriver
```

This allows vendor-specific hardware implementations to be introduced without coupling the rest of the application directly to a particular controller or tank-gauge implementation.

For local development and demonstration, the platform includes an edge simulator that produces telemetry using the same WebSocket communication path.

### Tank Volume Calculation

Tank volume is derived from the probe's raw height measurement.

When a tank has a calibrated **strapping table**, FuelMaster uses the corresponding calibration data. Where a calibration table is unavailable, the system falls back to horizontal-cylinder geometry rather than using a simple linear approximation.

---

## Features

### Operations

* Multi-station dashboard
* Live forecourt monitoring
* Point-of-sale operations
* Fuel and shop-item sales
* Cash, card and mobile-money payment recording
* Fleet-account transactions
* Dispenser management
* Nozzle management
* Fuel-tank management
* Tank-gauge monitoring
* Tank calibration and strapping tables
* Controller management
* Inventory management
* Fuel deliveries
* Fuel-price management

### Accounts & CRM

* Fleet accounts
* Customer management
* Loyalty management
* CRM workflows
* Financial and operational reports
* Analytics dashboards

### Back Office

* Maintenance management
* Cash management
* Shift management
* User management
* Administration
* System settings
* System health monitoring
* Audit logs

### Authentication & Security

* JWT-based authentication
* Short-lived access tokens
* Refresh-token authentication
* Refresh-token rotation
* Role-based authorization
* Email-based two-factor authentication
* Email verification during account registration
* Per-station edge-daemon credentials
* Authenticated WebSocket connections
* Optional TLS for telemetry communication
* Rate limiting on authentication endpoints
* Audit logging for operational activity

### Notifications

FuelMaster supports event-driven notifications through:

* Email
* SMS
* Web Push notifications
* VAPID-based browser push

Notifications can be triggered by operational events such as:

* Low fuel levels
* Fuel-delivery status changes
* Fleet accounts exceeding credit limits

### User Interface

* Responsive desktop and mobile layouts
* Mobile navigation drawer
* Dark and light themes
* Configurable interface density
* Configurable accent colour
* Real-time dashboard updates

---

## Technology Stack

| Layer                   | Technologies                                          |
| ----------------------- | ----------------------------------------------------- |
| Frontend                | React 19, TypeScript, Vite, Tailwind CSS v4, Recharts |
| Backend                 | Node.js, Express, TypeScript                          |
| Database                | PostgreSQL                                            |
| Real-time Communication | WebSocket (`ws`)                                      |
| Authentication          | JWT, bcrypt                                           |
| Notifications           | Brevo, Web Push, VAPID                                |
| Hardware Integration    | FCC/ATG driver abstractions, TCP/serial communication |
| Development             | Node.js 20+, npm                                      |

---

## Project Structure

```text
fuelmaster/
├── src/
│   ├── pages/              # Application pages and operational modules
│   ├── components/         # Shared UI components
│   └── lib/                # API client, WebSocket hooks, utilities
│
└── server/
    ├── src/
    │   ├── routes/         # REST API endpoints
    │   ├── ws/             # WebSocket gateway, edge daemon and simulator
    │   ├── drivers/        # FCC/ATG driver interfaces and implementations
    │   ├── services/       # Notifications and application services
    │   └── db/             # Database schema and migration logic
    │
    └── README.md           # Backend-specific documentation
```

---

## Getting Started

### Prerequisites

* Node.js 20+
* PostgreSQL
* npm

### 1. Configure the Backend

```bash
cd server
npm install
cp .env.example .env
```

Configure the required environment variables in `.env`.

See [`server/README.md`](./server/README.md) for backend configuration details.

### 2. Create the Database

```bash
psql -U postgres -c "CREATE DATABASE fuelmaster;"
```

Run the database migrations:

```bash
npm run db:migrate
```

### 3. Seed Development Data

```bash
npm run db:seed
```

The seed process creates development stations, users and sample operational data.

For security, **development credentials are not published in this repository**. The seed process prints the credentials required for the local development environment after it completes.

Do not reuse seeded development credentials in a production deployment.

### 4. Start the Backend

```bash
npm run dev
```

The development environment starts:

* REST API on `:4000`
* WebSocket telemetry gateway on `:4001`

### 5. Start the Forecourt Simulator

In a separate terminal:

```bash
cd server
npm run edge:simulate
```

The simulator can generate pump and tank telemetry for development and demonstration without requiring physical forecourt hardware.

### 6. Start the Frontend

From the project root:

```bash
npm install
npm run dev
```

The Vite development server will make the frontend available at:

```text
http://localhost:5173
```

---

## Security Considerations

FuelMaster is designed with several application and communication security controls:

* Authentication is handled through JWT access and refresh tokens.
* Refresh tokens use rotation and revocation mechanisms.
* Sensitive application routes require authenticated access.
* Role-based authorization restricts administrative and operational functions.
* Authentication endpoints are rate limited.
* WebSocket connections require authentication.
* Edge-daemon credentials are station-specific.
* Email verification is required during self-service registration.
* Two-factor authentication is available through email.
* Operational activity is recorded through audit logging.
* Environment-specific secrets are supplied through environment variables rather than committed configuration files.

### Environment Variables

Production credentials and secrets must **never be committed to the repository**.

Use:

```text
.env
```

for local environment configuration and:

```text
.env.example
```

for documenting required variables without exposing their values.

---

## Data & Transaction Integrity

The application uses PostgreSQL as its primary operational database.

The database design includes relationships covering:

* Stations
* Users
* Roles
* Sales
* Payments
* Dispensers
* Nozzles
* Tanks
* Tank gauges
* Deliveries
* Inventory
* Fleet accounts
* Customers
* Loyalty
* Expenses
* Cash management
* Shifts
* Maintenance
* Audit logs

Transaction-sensitive operations are handled server-side, with database constraints and transaction controls used where appropriate to preserve data integrity.

---

## Real-Time Telemetry

Forecourt telemetry is designed to flow through the following path:

```text
Forecourt Hardware
        │
        ▼
Forecourt Daemon
        │
        │ Authenticated WebSocket
        ▼
WebSocket Gateway
        │
        ├──────────────► Dashboard
        │
        └──────────────► Operational Services
```

This architecture separates hardware communication from the user-facing application and allows the platform to process real-time station information without requiring the browser to communicate directly with physical equipment.

---

## Development & Quality

The current development workflow includes:

* TypeScript type checking
* Production build validation
* Database migration validation
* Structured backend and frontend modules
* Environment-based configuration
* Git-based source control

Automated behavioral tests are **not yet implemented**. Current CI validation focuses on type safety and build correctness.

Automated unit, integration and end-to-end testing are planned improvements as the platform moves toward production readiness.

---

## Known Limitations

The following areas are intentionally identified as incomplete or partially implemented:

### Analytics

A small number of secondary analytics sub-tabs remain illustrative rather than connected to live queries. The main operational dashboards and the majority of analytics functionality are backed by real database queries.

### FCC Hardware Integration

The FCC driver architecture and integration layer are in place, but vendor-specific FCC protocol parsing has not yet been completed against a production controller specification.

The ATG integration is further developed, including support for the Veeder-Root protocol.

### Automated Testing

An automated behavioral test suite has not yet been implemented. The current development pipeline validates TypeScript type safety and production builds.

These limitations are documented intentionally so that the current implementation status remains clear.

---

## Engineering Goals

The platform is designed to evolve toward a production-ready forecourt management system with:

* Additional vendor-specific FCC drivers
* Expanded ATG hardware support
* Automated unit and integration testing
* Broader end-to-end test coverage
* Expanded multi-station analytics
* Additional operational automation
* Further hardening of production security controls

---

## Project Status

**Development / Advanced Prototype**

FuelMaster currently demonstrates a working full-stack architecture with real API-backed operational modules, PostgreSQL persistence, authenticated real-time communication, hardware integration abstractions, development hardware simulation, authentication and authorization controls, and event-driven notifications.

Production deployment would require completion and validation of vendor-specific hardware integrations, comprehensive automated testing, production security review, and operational acceptance testing.

---

## Author

**Kimunya Joseph Muriithi**

Full Stack Software Engineer
Nairobi, Kenya

GitHub: https://github.com/jo799/Fuelmaster
