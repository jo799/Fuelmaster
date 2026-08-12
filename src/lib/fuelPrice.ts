import type { FuelPriceRow } from "../types";

/**
 * Finds the current real price for a pump/tank product (e.g. "Petrol")
 * against the fuel_prices rows, which are named more specifically
 * (e.g. "Petrol (PMS 95)"). Returns null if there's genuinely no matching
 * price on record, rather than silently falling back to a guessed number.
 */
export function findFuelPrice(prices: FuelPriceRow[], product: string): number | null {
  const match = prices.find((p) => p.fuel.toLowerCase().includes(product.toLowerCase()));
  return match?.currentPrice ?? null;
}