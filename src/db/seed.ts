import { pathToFileURL } from "node:url";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { currency } from "./schema";

/** Curated 6-currency seed set with authoritative minor-unit exponents (D-02/D-03). */
export const CURRENCY_SEED = [
  { code: "USD", name: "US Dollar", minorUnit: 2 },
  { code: "CNY", name: "Chinese Yuan", minorUnit: 2 },
  { code: "EUR", name: "Euro", minorUnit: 2 },
  { code: "GBP", name: "Pound Sterling", minorUnit: 2 },
  { code: "JPY", name: "Japanese Yen", minorUnit: 0 }, // 0 decimals — exponent matters
  { code: "HKD", name: "Hong Kong Dollar", minorUnit: 2 },
] as const;

/**
 * Idempotent currency seed. `onConflictDoNothing` keyed on the `code` PK means
 * re-running never duplicates rows (re-runnable for tests and repeat deploys).
 */
export function seedCurrencies<TSchema extends Record<string, unknown>>(
  database: BetterSQLite3Database<TSchema>,
): void {
  for (const row of CURRENCY_SEED) {
    database.insert(currency).values(row).onConflictDoNothing().run();
  }
}

async function main(): Promise<void> {
  const { db } = await import("./index");
  seedCurrencies(db);
  console.log("seeded currencies");
}

// Run only when invoked directly (e.g. `tsx src/db/seed.ts`), not when imported by tests.
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  void main();
}
