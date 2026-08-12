import bcrypt from "bcryptjs";
import { pool } from "./pool.js";

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Wipe existing data (idempotent re-seed for dev)
    await client.query(`
      TRUNCATE stations, users, refresh_tokens, controllers, pumps, nozzles, tanks,
        shifts, sale_transactions, cash_transactions, deliveries, fleet_accounts,
        inventory_items, inventory_movements, loyalty_members, loyalty_activity,
        crm_customers, crm_followups, fuel_prices, price_history, work_orders,
        expenses, alerts, audit_logs
      RESTART IDENTITY CASCADE;
    `);

    // ---- Stations ----
    const stations = [
      ["STN-001", "Kariakoo Service Station"],
      ["STN-002", "Mbagala Service Station"],
      ["STN-003", "Temeke Service Station"],
      ["STN-004", "Kisutu Service Station"],
      ["STN-005", "Upanga Service Station"],
    ];
    const stationIds: Record<string, number> = {};
    for (const [code, name] of stations) {
      const r = await client.query(
        `INSERT INTO stations (code, name) VALUES ($1,$2) RETURNING id`,
        [code, name]
      );
      stationIds[code] = r.rows[0].id;
    }
    const stn1 = stationIds["STN-001"];

    // ---- Users (passwords: "password123" for all, dev only) ----
    const passwordHash = await bcrypt.hash("password123", 12);
    const users: [string, string, string, number, string][] = [
      ["John Kamau", "john.kamau@fuelmaster.dev", "Manager", stn1, "Active"],
      ["Grace Wanjiku", "grace.wanjiku@fuelmaster.dev", "Manager", stn1, "Active"],
      ["David Kimani", "david.kimani@fuelmaster.dev", "Cashier", stationIds["STN-002"], "Active"],
      ["Peter Mwangi", "peter.mwangi@fuelmaster.dev", "Supervisor", stationIds["STN-003"], "Active"],
      ["Amina Juma", "amina.juma@fuelmaster.dev", "Controller", stn1, "Active"],
      ["Joseph Mburu", "joseph.mburu@fuelmaster.dev", "Administrator", stationIds["STN-002"], "Suspended"],
      ["Edge Service", "edge-service@fuelmaster.dev", "Controller", stn1, "Active"],
      ["Admin", "admin@fuelmaster.dev", "Administrator", stn1, "Active"],
    ];
    const userIds: Record<string, number> = {};
    for (const [name, email, role, stationId, status] of users) {
      const r = await client.query(
        `INSERT INTO users (name, email, password_hash, role, station_id, status, last_login_at)
         VALUES ($1,$2,$3,$4,$5,$6, now()) RETURNING id`,
        [name, email, passwordHash, role, stationId, status]
      );
      userIds[email] = r.rows[0].id;
    }

    // ---- Controllers ----
    const controllers = [
      ["C-001", stn1, "Gilbarco Encore S", "online", 4, 4, 4, 8],
      ["C-002", stationIds["STN-002"], "Wayne Helix 7000", "online", 6, 6, 6, 12],
      ["C-003", stationIds["STN-003"], "Tatsuno N Series", "online", 4, 4, 4, 8],
      ["C-004", stationIds["STN-004"], "Gilbarco Encore S", "offline", 4, 0, 4, 8],
      ["C-005", stationIds["STN-005"], "Wayne Ovation", "maintenance", 4, 4, 4, 8],
    ];
    const controllerIds: Record<string, number> = {};
    for (const [code, sid, model, status, pt, po, disp, noz] of controllers) {
      const r = await client.query(
        `INSERT INTO controllers (code, station_id, model, status, pumps_total, pumps_online, dispensers, nozzles, uptime_seconds)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [code, sid, model, status, pt, po, disp, noz, Math.floor(Math.random() * 2_000_000)]
      );
      controllerIds[code as string] = r.rows[0].id;
    }

    // ---- Pumps + Nozzles (station 1, matching the Dashboard reference) ----
    const pumpSeed: [string, string, string, number, number, number, number, number][] = [
      ["Pump 1", "dispensing", "Petrol", 32.0, 5600, 175, 14, 14],
      ["Pump 2", "idle", "Diesel", 0, 0, 0, 38, 9],
      ["Pump 3", "dispensing", "Petrol", 20.0, 3600, 96, 62, 13],
      ["Pump 4", "offline", "Diesel", 0, 0, 0, 86, 8],
      ["Pump 5", "dispensing", "Kerosene", 15.5, 2790, 88, 26, 63],
      ["Pump 6", "offline", "Petrol", 0, 0, 0, 74, 65],
    ];
    const pumpIds: number[] = [];
    for (const [name, status, product, litres, amount, flow, x, y] of pumpSeed) {
      const r = await client.query(
        `INSERT INTO pumps (station_id, controller_id, name, status, product, litres, amount_kes, flow_rate, target_litres, pos_x, pos_y)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [stn1, controllerIds["C-001"], name, status, product, litres, amount, flow, status === "dispensing" ? litres + 10 : null, x, y]
      );
      pumpIds.push(r.rows[0].id);
      // two nozzles per pump
      const products = ["Petrol", "Diesel"];
      for (let n = 1; n <= 2; n++) {
        await client.query(
          `INSERT INTO nozzles (pump_id, nozzle_no, product, status, flow_rate, today_litres, today_kes, last_dispensed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7, now() - interval '2 minutes')`,
          [r.rows[0].id, n, products[n - 1], status === "dispensing" && n === 1 ? "dispensing" : "online",
           status === "dispensing" && n === 1 ? flow : 0, Math.random() * 300, Math.random() * 50000]
        );
      }
    }

    // ---- Tanks ----
    const tanks: [string, string, number, number, number, number, number][] = [
      ["TANK-1", "Petrol", 32000, 18560, 24, 0.5, 0.745],
      ["TANK-2", "Diesel", 22000, 12980, 26, 0.8, 0.842],
      ["TANK-3", "Kerosene", 15000, 6750, 25, 0.3, 0.819],
      ["TANK-4", "Petrol", 20000, 15400, 24, 0.0, 0.746],
      ["TANK-5", "Diesel", 18500, 4250, 27, 1.2, 0.848],
      ["TANK-6", "Petrol", 10000, 9100, 23, 0.0, 0.747],
      ["TANK-7", "Diesel", 6000, 1850, 28, 0.0, 0.841],
      ["TANK-8", "LPG", 5000, 2250, 22, 0, 1.912],
    ];
    for (const [code, product, cap, vol, temp, water, density] of tanks) {
      const status = water >= 1 ? "warning" : vol / cap < 0.35 ? "warning" : "healthy";
      await client.query(
        `INSERT INTO tanks (station_id, code, product, capacity_l, volume_l, temperature_c, water_level_cm, density, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [stn1, code, product, cap, vol, temp, water, density, status]
      );
    }

    // ---- Fuel prices ----
    const prices: [string, number, number][] = [
      ["Diesel (ENS90)", 1295, 1255],
      ["Petrol (PMS 95)", 1219, 1179],
      ["Kerosene", 970, 990],
      ["Engine Oil 20W-50", 2850, 2850],
      ["Engine Oil 15W-40", 2600, 2600],
      ["ATF (Transmission Fluid)", 1450, 1450],
      ["Grease (Multi-Purpose)", 850, 850],
      ["AdBlue (10L)", 180, 200],
    ];
    for (const [fuel, cur, prev] of prices) {
      await client.query(
        `INSERT INTO fuel_prices (station_id, fuel_name, current_price, previous_price) VALUES ($1,$2,$3,$4)`,
        [stn1, fuel, cur, prev]
      );
    }
    await client.query(
      `INSERT INTO price_history (station_id, fuel_name, old_price, new_price, changed_by, reason)
       VALUES ($1,'Diesel (ENS90)',1255,1295,'John Kamau','Market Adjustment'),
              ($1,'Petrol (PMS 95)',1179,1219,'John Kamau','Market Adjustment'),
              ($1,'AdBlue (10L)',200,180,'System','Supplier Update')`,
      [stn1]
    );

    // ---- Baseline hardware for the other 4 stations ----
    // Kariakoo above is the hand-authored "reference" station with specific
    // named scenarios (a pump mid-fill, one offline, etc.) for demoing the
    // live telemetry pipeline. The other stations previously had zero pumps,
    // nozzles, tanks, or fuel prices at all \u2014 which is realistic for a
    // station that hasn't had equipment registered yet, but made every page
    // depending on that data (Dispensers, Nozzles, Fuel Tanks, POS) look
    // broken rather than genuinely empty. Giving them a real (smaller)
    // baseline means the whole app works out of the box at any station.
    const otherStations: { code: string; pumpCount: number; controllerStatus: string }[] = [
      { code: "STN-002", pumpCount: 6, controllerStatus: "online" },
      { code: "STN-003", pumpCount: 4, controllerStatus: "online" },
      { code: "STN-004", pumpCount: 4, controllerStatus: "offline" },
      { code: "STN-005", pumpCount: 4, controllerStatus: "maintenance" },
    ];
    const stationProducts = ["Petrol", "Diesel"] as const;
    const tankTemplates: [string, number, number, number][] = [
      ["Petrol", 20000, 12000, 0.745],
      ["Diesel", 18000, 9500, 0.842],
      ["Kerosene", 10000, 4200, 0.819],
    ];

    for (const station of otherStations) {
      const stationId = stationIds[station.code];
      const controllerId = controllerIds[`C-${station.code.slice(-3)}`];
      // Controllers that are offline/in maintenance have their pumps down too
      // \u2014 that's a realistic consequence, not a separate random state.
      const pumpsAreDown = station.controllerStatus !== "online";

      for (let i = 1; i <= station.pumpCount; i++) {
        const product = stationProducts[i % 2];
        const status = pumpsAreDown ? (station.controllerStatus === "offline" ? "offline" : "maintenance") : i % 3 === 0 ? "dispensing" : "idle";
        const litres = status === "dispensing" ? Math.round(5 + Math.random() * 20) : 0;
        const amount = litres * (product === "Petrol" ? 1219 : 1295);
        const flow = status === "dispensing" ? 80 + Math.round(Math.random() * 60) : 0;
        const posX = 15 + ((i - 1) % 4) * 22;
        const posY = 15 + Math.floor((i - 1) / 4) * 45;

        const pumpRow = await client.query(
          `INSERT INTO pumps (station_id, controller_id, name, status, product, litres, amount_kes, flow_rate, target_litres, pos_x, pos_y)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
          [stationId, controllerId, `Pump ${i}`, status, product, litres, amount, flow, status === "dispensing" ? litres + 10 : null, posX, posY]
        );

        for (let n = 1; n <= 2; n++) {
          const nozzleProduct = stationProducts[(n - 1) % 2];
          const nozzleStatus = pumpsAreDown ? "offline" : status === "dispensing" && n === 1 ? "dispensing" : "online";
          await client.query(
            `INSERT INTO nozzles (pump_id, nozzle_no, product, status, flow_rate, today_litres, today_kes, last_dispensed_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7, now() - interval '5 minutes')`,
            [pumpRow.rows[0].id, n, nozzleProduct, nozzleStatus, nozzleStatus === "dispensing" ? flow : 0, Math.random() * 200, Math.random() * 30000]
          );
        }
      }

      for (const [product, cap, vol, density] of tankTemplates) {
        const code = `TANK-${product.slice(0, 1)}${stationId}`;
        await client.query(
          `INSERT INTO tanks (station_id, code, product, capacity_l, volume_l, temperature_c, water_level_cm, density, status)
           VALUES ($1,$2,$3,$4,$5,24,0.2,$6,'healthy')`,
          [stationId, code, product, cap, vol, density]
        );
      }

      await client.query(
        `INSERT INTO fuel_prices (station_id, fuel_name, current_price, previous_price)
         VALUES ($1,'Petrol (PMS 95)',1219,1179), ($1,'Diesel (ENS90)',1295,1255), ($1,'Kerosene',970,990)`,
        [stationId]
      );
    }

    // ---- Shifts ----
    const shiftRows = [
      ["SFT-028", stn1, userIds["john.kamau@fuelmaster.dev"], "In Progress", 128, 98540],
      ["SFT-027", stn1, userIds["amina.juma@fuelmaster.dev"], "Completed", 121, 104230],
      ["SFT-026", stationIds["STN-002"], userIds["david.kimani@fuelmaster.dev"], "Completed", 92, 76410],
      ["SFT-025", stn1, userIds["grace.wanjiku@fuelmaster.dev"], "Completed", 65, 54120],
    ];
    const shiftIds: number[] = [];
    for (const [code, sid, cashierId, status, txns, sales] of shiftRows) {
      const r = await client.query(
        `INSERT INTO shifts (code, station_id, cashier_id, starts_at, ends_at, transactions, sales_kes, status)
         VALUES ($1,$2,$3, now() - interval '8 hours', ${status === "Completed" ? "now()" : "NULL"}, $4,$5,$6) RETURNING id`,
        [code, sid, cashierId, txns, sales, status]
      );
      shiftIds.push(r.rows[0].id);
    }

    // ---- Sale transactions ----
    const sales: [number, number, string, number, number, number, string][] = [
      [2, 1, "Petrol", 32.0, 180, 5760, "Cash"],
      [3, 1, "Diesel", 15.5, 175, 2713, "Card"],
      [1, 2, "Petrol", 20.0, 180, 3600, "Cash"],
      [2, 1, "Diesel", 25.0, 175, 4375, "Card"],
      [1, 1, "Petrol", 18.0, 180, 3240, "Cash"],
      [3, 2, "Kerosene", 10.0, 120, 1200, "Mobile Money"],
      [4, 1, "Diesel", 30.0, 175, 5250, "Fleet Account"],
      [5, 1, "Petrol", 40.0, 180, 7200, "Card"],
    ];
    let receiptSeq = 1234;
    for (const [pumpIdx, nozzleNo, product, litres, price, amount, method] of sales) {
      await client.query(
        `INSERT INTO sale_transactions (receipt_no, station_id, shift_id, pump_id, nozzle_no, cashier_id, product, litres, price, amount_kes, payment_method, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now() - (random() * interval '2 hours'))`,
        [
          String(receiptSeq++).padStart(8, "0"),
          stn1,
          shiftIds[0],
          pumpIds[(pumpIdx as number) - 1],
          nozzleNo,
          userIds["john.kamau@fuelmaster.dev"],
          product,
          litres,
          price,
          amount,
          method,
        ]
      );
    }

    // ---- Cash transactions ----
    await client.query(
      `INSERT INTO cash_transactions (station_id, type, description, amount_kes, method, reference, created_at) VALUES
        ($1,'Cash In','Deposit from Bank',150000,'Cash','DEP-000125', now() - interval '1 hour'),
        ($1,'Cash Out','Fuel Purchase (Supplier)',-75000,'Cash','CO-000456', now() - interval '2 hours'),
        ($1,'Cash In','Cash Collection',200000,'Cash','DEP-000124', now() - interval '3 hours'),
        ($1,'Cash Out','Miscellaneous Expense',-12500,'Cash','CO-000455', now() - interval '4 hours'),
        ($1,'Cash In','Bank Deposit',300000,'Bank Transfer','DEP-000123', now() - interval '20 hours')`,
      [stn1]
    );

    // ---- Deliveries ----
    const deliveries: [string, string, string, number, number, string, string][] = [
      ["DEL-10012", "PetroWash Ltd", "Diesel", 12000, 350400, "Received", "PN-7845"],
      ["DEL-10011", "Kerosene Supply Co.", "Kerosene", 5000, 102500, "Received", "PN-7844"],
      ["DEL-10010", "OilCom Ltd", "Petrol", 8750, 201500, "Received", "PN-7843"],
      ["DEL-10009", "Petro Supply Co.", "Diesel", 10000, 290000, "In Transit", "PN-7842"],
      ["DEL-10004", "Kerosene Supply Co.", "Kerosene", 3000, 61500, "Scheduled", "PN-7837"],
      ["DEL-10003", "Petro Supply Co.", "Diesel", 9000, 261000, "Cancelled", "PN-7836"],
    ];
    for (const [code, supplier, fuel, qty, cost, status, note] of deliveries) {
      await client.query(
        `INSERT INTO deliveries (code, station_id, supplier, fuel_type, quantity_l, cost_kes, status, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [code, stn1, supplier, fuel, qty, cost, status, note]
      );
    }

    // ---- Fleet accounts ----
    const fleets: [string, string, string, string, number, number, number, string][] = [
      ["FA-1001", "Kariakoo Logistics Ltd", "Logistics", "Peter Mwangi", 12, 1500000, 320450, "Active"],
      ["FA-1002", "Tanzania Transport Co", "Transport", "Amina Juma", 8, 1000000, 150250, "Active"],
      ["FA-1003", "Pamoja Delivery Services", "Logistics", "David Simba", 6, 500000, 85600, "Active"],
      ["FA-1006", "Soko Express Ltd", "Logistics", "James Baraka", 7, 750000, 810300, "Over Limit"],
      ["FA-1009", "Pan African Transport", "Transport", "Ali Hassan", 10, 1200000, 1420600, "Over Limit"],
    ];
    for (const [code, name, group, contact, vehicles, limit, balance, status] of fleets) {
      await client.query(
        `INSERT INTO fleet_accounts (account_code, name, group_name, contact_person, vehicles, credit_limit_kes, balance_kes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [code, name, group, contact, vehicles, limit, balance, status]
      );
    }

    // ---- Inventory ----
    const inventory: [string, string, string, string, number, number, number, string][] = [
      ["Diesel (ENS90)", "Fuel", "Tank 1", "Liters", 12450, 104.5, 1299525, "In Stock"],
      ["Petrol (PMS 95)", "Fuel", "Tank 2", "Liters", 8760, 121, 1059960, "In Stock"],
      ["Kerosene", "Fuel", "Tank 3", "Liters", 3250, 98, 318500, "Low Stock"],
      ["Engine Oil 20W-50", "Lubricants", "Store 1", "Liters", 45, 650, 29250, "In Stock"],
      ["Engine Oil 15W-40", "Lubricants", "Store 1", "Liters", 23, 620, 14260, "Low Stock"],
      ["Windshield Washer Fluid", "Other Products", "Store 2", "Liters", 6, 120, 720, "Out of Stock"],
    ];
    for (const [name, cat, loc, unit, qty, cost, value, status] of inventory) {
      const r = await client.query(
        `INSERT INTO inventory_items (station_id, name, category, location, unit, quantity, cost_kes, value_kes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [stn1, name, cat, loc, unit, qty, cost, value, status]
      );
      await client.query(
        `INSERT INTO inventory_movements (item_id, delta, reason) VALUES ($1,$2,$3)`,
        [r.rows[0].id, -Math.round(Math.random() * 500), "Sale"]
      );
    }

    // ---- Loyalty ----
    const loyalty: [string, string, string, string, number, number, number][] = [
      ["LM-1001248", "Peter Mwangi", "0712 345 678", "Gold", 2450, 12500, 45800],
      ["LM-1001247", "Amina Juma", "0722 456 789", "Gold", 1850, 8900, 32600],
      ["LM-1001246", "David Kimani", "0703 567 890", "Silver", 980, 4650, 18750],
      ["LM-1001245", "Grace Wanjiku", "0721 234 567", "Bronze", 320, 1850, 6420],
    ];
    for (const [code, name, phone, tier, bal, life, spent] of loyalty) {
      const r = await client.query(
        `INSERT INTO loyalty_members (member_code, name, phone, tier, points_balance, lifetime_points, total_spent_kes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [code, name, phone, tier, bal, life, spent]
      );
      await client.query(
        `INSERT INTO loyalty_activity (member_id, message, points) VALUES ($1,$2,$3)`,
        [r.rows[0].id, "Earned points \u2013 Fuel Purchase", 100]
      );
    }

    // ---- CRM ----
    const crm: [string, string, string, string][] = [
      ["Peter Mwangi", "Kariakoo Logistics Ltd", "0721 234 567", "VIP"],
      ["Amina Juma", "Tanzania Transport Co", "0722 456 789", "Gold"],
      ["David Kimani", "Pamoja Delivery Services", "0703 567 890", "Silver"],
    ];
    for (const [name, company, contact, segment] of crm) {
      const r = await client.query(
        `INSERT INTO crm_customers (name, company, contact, segment, last_interaction_at, total_spent_kes)
         VALUES ($1,$2,$3,$4, now() - interval '1 day', $5) RETURNING id`,
        [name, company, contact, segment, Math.round(Math.random() * 100000)]
      );
      await client.query(
        `INSERT INTO crm_followups (customer_id, type, due_at) VALUES ($1,'Call', now() + interval '2 days')`,
        [r.rows[0].id]
      );
    }

    // ---- Work orders ----
    const workOrders: [string, string, string, string, string, string, string][] = [
      ["WO-10028", "Fuel Dispenser 2 - Nozzle Leak", "Dispenser 2", "Corrective", "High", "In Progress", "Brian Otieno"],
      ["WO-10027", "Tank Gauge Calibration", "Tank 1", "Preventive", "Medium", "Scheduled", "Unassigned"],
      ["WO-10024", "Dispenser 4 - Display Not Working", "Dispenser 4", "Corrective", "Medium", "Completed", "Amina Juma"],
    ];
    for (const [code, desc, asset, type, priority, status, assignee] of workOrders) {
      await client.query(
        `INSERT INTO work_orders (code, station_id, description, asset, type, priority, status, assigned_to, due_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, CURRENT_DATE + 3)`,
        [code, stn1, desc, asset, type, priority, status, assignee]
      );
    }

    // ---- Expenses ----
    await client.query(
      `INSERT INTO expenses (station_id, category, amount_kes, description) VALUES
        ($1,'Fuel Purchases',1820000,'Monthly fuel restocking'),
        ($1,'Payroll',340000,'Staff salaries'),
        ($1,'Maintenance',124560,'Equipment service'),
        ($1,'Utilities',86000,'Electricity and water')`,
      [stn1]
    );

    // ---- Alerts ----
    const alerts: [string, string, string, string][] = [
      ["ALT-1042", "Fuel Tanks", "Water detected in Tank 3", "danger"],
      ["ALT-1041", "Fuel Tanks", "Low level warning \u2013 Tank 5", "warning"],
      ["ALT-1039", "Controllers", "Controller C-004 offline since 10:16 AM", "danger"],
      ["ALT-1038", "Fleet Accounts", "Soko Express Ltd is over credit limit", "warning"],
    ];
    for (const [code, module, message, severity] of alerts) {
      await client.query(
        `INSERT INTO alerts (code, station_id, module, message, severity) VALUES ($1,$2,$3,$4,$5)`,
        [code, stn1, module, message, severity]
      );
    }

    // ---- Audit logs ----
    await client.query(
      `INSERT INTO audit_logs (code, user_id, action, target, ip_address, severity) VALUES
        ('AUD-3021',$1,'Created user','David Kimani','192.168.10.14','info'),
        ('AUD-3019',NULL,'Failed login (3 attempts)','Cashier account','41.90.64.201','danger'),
        ('AUD-3017',$1,'Changed fuel price','Diesel (ENS90) -> 1295 KES/L','192.168.10.14','warning')`,
      [userIds["john.kamau@fuelmaster.dev"]]
    );

    await client.query("COMMIT");
    console.log("Seed complete.");
    console.log("Login with: admin@fuelmaster.dev / password123 (or any seeded user email)");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});