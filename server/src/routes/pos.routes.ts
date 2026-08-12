import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { notify } from "../services/notifications.js";

export const posRouter = Router();
posRouter.use(requireAuth);

const saleSchema = z.object({
  pumpId: z.number().int().optional(),
  nozzle: z.number().int().default(1),
  items: z
    .array(
      z.object({
        product: z.string(),
        litres: z.number().positive(),
        price: z.number().positive(),
      })
    )
    .min(1),
  paymentMethod: z.enum(["Cash", "Card", "Mobile Money", "Fleet Account"]),
  customerName: z.string().optional(),
  fleetAccountId: z.string().optional(),
  loyaltyMemberId: z.string().optional(),
});

posRouter.post(
  "/sale",
  asyncHandler(async (req, res) => {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid sale payload");

    const { pumpId, nozzle, items, paymentMethod, customerName, fleetAccountId, loyaltyMemberId } = parsed.data;
    const stationId = req.user!.stationId;
    const totalAmount = items.reduce((s, i) => s + i.litres * i.price, 0);

    if (paymentMethod === "Fleet Account" && !fleetAccountId) {
      throw new HttpError(400, "Select a fleet account for Fleet Account payments");
    }

    const client = await pool.connect();
    const receipts: string[] = [];
    let fleetAccountResult: { accountId: string; name: string; balanceKes: number; status: string } | null = null;
    let loyaltyResult: { id: string; name: string; pointsEarned: number; pointsBalance: number } | null = null;

    try {
      await client.query("BEGIN");

      // One shared, monotonically-increasing receipt sequence for this checkout.
      const seq = await client.query(
        `SELECT COALESCE(MAX(receipt_no::bigint), 12340000) AS max FROM sale_transactions WHERE receipt_no ~ '^[0-9]+$'`
      );
      let nextReceipt = BigInt(seq.rows[0].max) + 1n;
      const primaryReceipt = nextReceipt.toString().padStart(8, "0");

      for (const item of items) {
        const receiptNo = nextReceipt.toString().padStart(8, "0");
        nextReceipt += 1n;
        const amount = item.litres * item.price;
        await client.query(
          `INSERT INTO sale_transactions
             (receipt_no, station_id, pump_id, nozzle_no, cashier_id, customer_name, product, litres, price, amount_kes, payment_method)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            receiptNo,
            stationId,
            pumpId ?? null,
            nozzle,
            req.user!.sub,
            customerName ?? null,
            item.product,
            item.litres,
            item.price,
            amount,
            paymentMethod,
          ]
        );
        receipts.push(receiptNo);
      }

      // Fleet Account payment: the sale amount is billed to the account,
      // increasing its outstanding balance. Flags the account Over Limit if
      // this pushes it past its credit limit, same as the Fleet Accounts page.
      if (paymentMethod === "Fleet Account" && fleetAccountId) {
        const acct = await client.query(
          `SELECT account_code, name, credit_limit_kes::float AS "creditLimitKes", balance_kes::float AS "balanceKes", status
           FROM fleet_accounts WHERE account_code = $1 FOR UPDATE`,
          [fleetAccountId]
        );
        if (acct.rows.length === 0) throw new HttpError(404, "Fleet account not found");
        const previousStatus = acct.rows[0].status;
        const newBalance = acct.rows[0].balanceKes + totalAmount;
        const newStatus = newBalance > acct.rows[0].creditLimitKes ? "Over Limit" : "Active";
        const updated = await client.query(
          `UPDATE fleet_accounts SET balance_kes = $1, status = $2 WHERE account_code = $3
           RETURNING account_code AS "accountId", name, balance_kes::float AS "balanceKes", status`,
          [newBalance, newStatus, fleetAccountId]
        );
        fleetAccountResult = updated.rows[0];

        // Only fire on the transition into Over Limit, not on every
        // subsequent sale while it stays there.
        if (newStatus === "Over Limit" && previousStatus !== "Over Limit") {
          notify({
            stationId: req.user!.stationId!,
            event: "fleetAccountOverLimit",
            title: `Fleet account over limit: ${acct.rows[0].name}`,
            message: `${acct.rows[0].name} (${fleetAccountId}) is now over its credit limit \u2014 balance KES ${Math.round(newBalance).toLocaleString()} vs a limit of KES ${Math.round(acct.rows[0].creditLimitKes).toLocaleString()}.`,
            severity: "danger",
          }).catch((err) => console.error("[pos] over-limit notify failed:", err.message));
        }
      }

      // Loyalty: 1 point per KES 100 spent, credited immediately.
      if (loyaltyMemberId) {
        const member = await client.query(
          `SELECT id, name, points_balance, lifetime_points FROM loyalty_members WHERE member_code = $1 FOR UPDATE`,
          [loyaltyMemberId]
        );
        if (member.rows.length === 0) throw new HttpError(404, "Loyalty member not found");
        const pointsEarned = Math.round(totalAmount / 100);
        const updated = await client.query(
          `UPDATE loyalty_members
           SET points_balance = points_balance + $1, lifetime_points = lifetime_points + $1,
               total_spent_kes = total_spent_kes + $2
           WHERE member_code = $3 RETURNING member_code AS id, name, points_balance AS "pointsBalance"`,
          [pointsEarned, totalAmount, loyaltyMemberId]
        );
        await client.query(
          `INSERT INTO loyalty_activity (member_id, message, points) VALUES ($1,$2,$3)`,
          [member.rows[0].id, `Earned points \u2013 Fuel Purchase (Receipt ${primaryReceipt})`, pointsEarned]
        );
        loyaltyResult = { ...updated.rows[0], pointsEarned };
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    const station = await pool.query(`SELECT name FROM stations WHERE id = $1`, [stationId]);

    res.status(201).json({
      receiptNo: primaryReceiptSafe(receipts),
      receipts,
      items: items.map((i) => ({ ...i, amount: i.litres * i.price })),
      totalAmount,
      paymentMethod,
      fleetAccount: fleetAccountResult,
      loyaltyMember: loyaltyResult,
      cashier: req.user!.name,
      station: station.rows[0]?.name ?? "FuelMaster Station",
      createdAt: new Date().toISOString(),
    });
  })
);

function primaryReceiptSafe(receipts: string[]): string {
  return receipts[0] ?? "";
}