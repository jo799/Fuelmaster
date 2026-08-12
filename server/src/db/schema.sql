-- FuelMaster database schema
-- Run via: npm run db:migrate

-- ============================================================
-- Core / Auth
-- ============================================================

CREATE TABLE IF NOT EXISTS stations (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(20) UNIQUE NOT NULL,
  name          VARCHAR(120) NOT NULL,
  timezone      VARCHAR(60) NOT NULL DEFAULT 'Africa/Nairobi',
  currency      VARCHAR(10) NOT NULL DEFAULT 'KES',
  -- SHA-256 hash of this station's own edge-daemon credential. Never store
  -- the plaintext token \u2014 it's shown to the admin exactly once when
  -- generated/rotated, same pattern as an API key.
  edge_token_hash VARCHAR(64),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('Cashier','Manager','Supervisor','Controller','Administrator','Viewer')),
  station_id    INTEGER REFERENCES stations(id) ON DELETE SET NULL,
  current_station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Suspended','Invited')),
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent for installs that ran schema.sql before current_station_id existed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL;

-- Idempotent for installs that ran schema.sql before phone existed (needed
-- for real SMS notification delivery).
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Idempotent for installs that ran schema.sql before edge_token_hash existed.
ALTER TABLE stations ADD COLUMN IF NOT EXISTS edge_token_hash VARCHAR(64);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Forecourt hardware
-- ============================================================

CREATE TABLE IF NOT EXISTS controllers (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(20) UNIQUE NOT NULL,
  station_id    INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  model         VARCHAR(80) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'online' CHECK (status IN ('online','offline','maintenance')),
  pumps_total   INTEGER NOT NULL DEFAULT 0,
  pumps_online  INTEGER NOT NULL DEFAULT 0,
  dispensers    INTEGER NOT NULL DEFAULT 0,
  nozzles       INTEGER NOT NULL DEFAULT 0,
  uptime_seconds BIGINT NOT NULL DEFAULT 0,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pumps (
  id            SERIAL PRIMARY KEY,
  station_id    INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  controller_id INTEGER REFERENCES controllers(id) ON DELETE SET NULL,
  name          VARCHAR(40) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'idle' CHECK (status IN ('dispensing','idle','offline','maintenance')),
  active_nozzle INTEGER NOT NULL DEFAULT 1,
  product       VARCHAR(20) NOT NULL DEFAULT 'Petrol',
  litres        NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_kes    NUMERIC(12,2) NOT NULL DEFAULT 0,
  flow_rate     NUMERIC(8,2) NOT NULL DEFAULT 0,
  target_litres NUMERIC(8,2),
  elapsed_sec   INTEGER NOT NULL DEFAULT 0,
  pos_x         NUMERIC(5,2) NOT NULL DEFAULT 50,
  pos_y         NUMERIC(5,2) NOT NULL DEFAULT 50,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nozzles (
  id            SERIAL PRIMARY KEY,
  pump_id       INTEGER NOT NULL REFERENCES pumps(id) ON DELETE CASCADE,
  nozzle_no     INTEGER NOT NULL,
  product       VARCHAR(20) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'online' CHECK (status IN ('online','dispensing','offline','maintenance')),
  flow_rate     NUMERIC(8,2) NOT NULL DEFAULT 0,
  today_litres  NUMERIC(10,2) NOT NULL DEFAULT 0,
  today_kes     NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_dispensed_at TIMESTAMPTZ,
  UNIQUE (pump_id, nozzle_no)
);

CREATE TABLE IF NOT EXISTS tanks (
  id            SERIAL PRIMARY KEY,
  station_id    INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  code          VARCHAR(20) NOT NULL,
  product       VARCHAR(20) NOT NULL,
  capacity_l    NUMERIC(10,2) NOT NULL,
  volume_l      NUMERIC(10,2) NOT NULL,
  height_mm     NUMERIC(8,2),
  temperature_c NUMERIC(5,2) NOT NULL DEFAULT 24,
  water_level_cm NUMERIC(5,2) NOT NULL DEFAULT 0,
  density       NUMERIC(6,3) NOT NULL DEFAULT 0.75,
  atg_online    BOOLEAN NOT NULL DEFAULT true,
  status        VARCHAR(20) NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy','warning','critical','offline')),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (station_id, code)
);

-- Idempotent for installs that ran schema.sql before updated_at existed.
ALTER TABLE tanks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Idempotent for installs that ran schema.sql before height_mm existed.
ALTER TABLE tanks ADD COLUMN IF NOT EXISTS height_mm NUMERIC(8,2);

-- Real strapping table: a tank-specific calibration curve mapping probe
-- height to actual volume, since real tanks (especially horizontal
-- cylinders) don't have a linear height-to-volume relationship. Without
-- calibration points for a tank, height-to-volume falls back to a
-- cylindrical-tank approximation (see heightToVolume() in
-- src/utils/strapping.ts) \u2014 fine for the demo simulator, not a
-- substitute for a real technician-supplied table on real hardware.
CREATE TABLE IF NOT EXISTS tank_strapping_points (
  id            SERIAL PRIMARY KEY,
  tank_id       INTEGER NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
  height_mm     NUMERIC(8,2) NOT NULL,
  volume_l      NUMERIC(10,2) NOT NULL,
  UNIQUE (tank_id, height_mm)
);

-- Periodic snapshots of tank state, for real "Levels Over Time" trend
-- charts. Live telemetry updates the `tanks` row on every poll (every few
-- seconds), but we only snapshot into history at most once every 15
-- minutes per tank (enforced in application code, not here) \u2014 dense
-- enough for a meaningful trend line, sparse enough not to grow this table
-- unboundedly on a long-running deployment.
CREATE TABLE IF NOT EXISTS tank_readings_history (
  id            SERIAL PRIMARY KEY,
  tank_id       INTEGER NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
  volume_l      NUMERIC(10,2) NOT NULL,
  capacity_l    NUMERIC(10,2) NOT NULL,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tank_readings_history_tank_time ON tank_readings_history (tank_id, recorded_at DESC);

-- ============================================================
-- Sales / POS / Shifts / Cash
-- ============================================================

CREATE TABLE IF NOT EXISTS shifts (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(20) UNIQUE NOT NULL,
  station_id    INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  cashier_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ,
  transactions  INTEGER NOT NULL DEFAULT 0,
  sales_kes     NUMERIC(12,2) NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Completed','In Progress','Scheduled','Cancelled'))
);

CREATE TABLE IF NOT EXISTS sale_transactions (
  id            SERIAL PRIMARY KEY,
  receipt_no    VARCHAR(20) UNIQUE NOT NULL,
  station_id    INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  shift_id      INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  pump_id       INTEGER REFERENCES pumps(id) ON DELETE SET NULL,
  nozzle_no     INTEGER,
  cashier_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_name VARCHAR(120),
  product       VARCHAR(20) NOT NULL,
  litres        NUMERIC(10,2) NOT NULL,
  price         NUMERIC(10,2) NOT NULL,
  amount_kes    NUMERIC(12,2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('Cash','Card','Mobile Money','Fleet Account')),
  status        VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','voided','refunded')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cash_transactions (
  id            SERIAL PRIMARY KEY,
  station_id    INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  type          VARCHAR(10) NOT NULL CHECK (type IN ('Cash In','Cash Out')),
  description   VARCHAR(160) NOT NULL,
  amount_kes    NUMERIC(12,2) NOT NULL,
  method        VARCHAR(20) NOT NULL DEFAULT 'Cash' CHECK (method IN ('Cash','Bank Transfer')),
  reference     VARCHAR(40),
  status        VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','pending')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Commercial: deliveries, fleet, inventory, loyalty, CRM, pricing
-- ============================================================

CREATE TABLE IF NOT EXISTS deliveries (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(20) UNIQUE NOT NULL,
  station_id    INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  supplier      VARCHAR(120) NOT NULL,
  fuel_type     VARCHAR(20) NOT NULL,
  quantity_l    NUMERIC(10,2) NOT NULL,
  cost_kes      NUMERIC(12,2) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Received','In Transit','Scheduled','Cancelled')),
  note          VARCHAR(60),
  delivered_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fleet_accounts (
  id            SERIAL PRIMARY KEY,
  account_code  VARCHAR(20) UNIQUE NOT NULL,
  name          VARCHAR(120) NOT NULL,
  group_name    VARCHAR(60),
  contact_person VARCHAR(120),
  vehicles      INTEGER NOT NULL DEFAULT 0,
  credit_limit_kes NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_kes   NUMERIC(12,2) NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Over Limit','Inactive')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id            SERIAL PRIMARY KEY,
  station_id    INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  name          VARCHAR(120) NOT NULL,
  category      VARCHAR(30) NOT NULL CHECK (category IN ('Fuel','Lubricants','Other Products')),
  location      VARCHAR(40),
  unit          VARCHAR(20) NOT NULL,
  quantity      NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_kes      NUMERIC(10,2) NOT NULL DEFAULT 0,
  value_kes     NUMERIC(12,2) NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'In Stock' CHECK (status IN ('In Stock','Low Stock','Out of Stock'))
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id            SERIAL PRIMARY KEY,
  item_id       INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  delta         NUMERIC(10,2) NOT NULL,
  reason        VARCHAR(80) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_members (
  id            SERIAL PRIMARY KEY,
  member_code   VARCHAR(20) UNIQUE NOT NULL,
  name          VARCHAR(120) NOT NULL,
  phone         VARCHAR(30),
  tier          VARCHAR(10) NOT NULL DEFAULT 'Bronze' CHECK (tier IN ('Gold','Silver','Bronze')),
  points_balance INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  total_spent_kes NUMERIC(12,2) NOT NULL DEFAULT 0,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Pending','Inactive'))
);

CREATE TABLE IF NOT EXISTS loyalty_activity (
  id            SERIAL PRIMARY KEY,
  member_id     INTEGER NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  message       VARCHAR(160) NOT NULL,
  points        INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_customers (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  company       VARCHAR(120),
  contact       VARCHAR(60),
  segment       VARCHAR(10) NOT NULL DEFAULT 'Bronze' CHECK (segment IN ('VIP','Gold','Silver','Bronze')),
  status        VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  last_interaction_at TIMESTAMPTZ,
  total_spent_kes NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS crm_followups (
  id            SERIAL PRIMARY KEY,
  customer_id   INTEGER NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  type          VARCHAR(20) NOT NULL CHECK (type IN ('Call','Email','Meeting')),
  due_at        TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS fuel_prices (
  id            SERIAL PRIMARY KEY,
  station_id    INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  fuel_name     VARCHAR(60) NOT NULL,
  current_price NUMERIC(10,2) NOT NULL,
  previous_price NUMERIC(10,2) NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  UNIQUE (station_id, fuel_name)
);

CREATE TABLE IF NOT EXISTS price_history (
  id            SERIAL PRIMARY KEY,
  station_id    INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  fuel_name     VARCHAR(60) NOT NULL,
  old_price     NUMERIC(10,2) NOT NULL,
  new_price     NUMERIC(10,2) NOT NULL,
  changed_by    VARCHAR(120) NOT NULL,
  reason        VARCHAR(120),
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Maintenance
-- ============================================================

CREATE TABLE IF NOT EXISTS work_orders (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(20) UNIQUE NOT NULL,
  station_id    INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  description   VARCHAR(160) NOT NULL,
  asset         VARCHAR(60) NOT NULL,
  type          VARCHAR(20) NOT NULL CHECK (type IN ('Preventive','Corrective','Inspections','Other')),
  priority      VARCHAR(10) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High','Medium','Low')),
  status        VARCHAR(20) NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Completed','In Progress','Scheduled','Overdue')),
  assigned_to   VARCHAR(120) NOT NULL DEFAULT 'Unassigned',
  due_date      DATE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS station_settings (
  station_id    INTEGER PRIMARY KEY REFERENCES stations(id) ON DELETE CASCADE,
  data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Finance
-- ============================================================

CREATE TABLE IF NOT EXISTS expenses (
  id            SERIAL PRIMARY KEY,
  station_id    INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  category      VARCHAR(60) NOT NULL,
  amount_kes    NUMERIC(12,2) NOT NULL,
  description   VARCHAR(160),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Platform: alerts, audit log
-- ============================================================

CREATE TABLE IF NOT EXISTS alerts (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(20) UNIQUE NOT NULL,
  station_id    INTEGER REFERENCES stations(id) ON DELETE CASCADE,
  module        VARCHAR(60) NOT NULL,
  message       VARCHAR(200) NOT NULL,
  severity      VARCHAR(10) NOT NULL CHECK (severity IN ('info','warning','danger')),
  status        VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Acknowledged','Resolved')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(20) UNIQUE NOT NULL,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(160) NOT NULL,
  target        VARCHAR(160),
  ip_address    VARCHAR(64),
  severity      VARCHAR(10) NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','danger')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            SERIAL PRIMARY KEY,
  station_id    INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  endpoint      TEXT UNIQUE NOT NULL,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_challenges (
  id             SERIAL PRIMARY KEY,
  challenge_id   VARCHAR(64) UNIQUE NOT NULL,
  purpose        VARCHAR(10) NOT NULL CHECK (purpose IN ('login', 'signup')),
  user_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
  email          VARCHAR(160) NOT NULL,
  code_hash      VARCHAR(128) NOT NULL,
  -- For 'signup' challenges: the pending station/admin details, created for
  -- real only once the emailed code is verified (so an unverified email
  -- never results in a live account or station).
  payload        JSONB,
  attempts       INTEGER NOT NULL DEFAULT 0,
  expires_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_challenge_id ON auth_challenges (challenge_id);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sale_transactions_station_time ON sale_transactions (station_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_station_time ON cash_transactions (station_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts (status);
CREATE INDEX IF NOT EXISTS idx_pumps_station ON pumps (station_id);
CREATE INDEX IF NOT EXISTS idx_nozzles_pump ON nozzles (pump_id);
CREATE INDEX IF NOT EXISTS idx_tanks_station ON tanks (station_id);
CREATE INDEX IF NOT EXISTS idx_inventory_station ON inventory_items (station_id);