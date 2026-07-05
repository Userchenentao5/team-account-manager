import { pathToFileURL } from "node:url";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { CURRENCIES } from "@/lib/currencies";
import { currency } from "./schema";

/** Default currency seed set with authoritative minor-unit exponents (D-02/D-03). */
export const CURRENCY_SEED = CURRENCIES;

/**
 * Idempotent currency seed. `onConflictDoNothing` keyed on the `code` PK means
 * re-running never duplicates rows (re-runnable for tests and repeat deploys).
 */
export function seedCurrencies<TSchema extends Record<string, unknown>>(
  database: BetterSQLite3Database<TSchema>,
): void {
  for (const row of CURRENCY_SEED) {
    database
      .insert(currency)
      .values(row)
      .onConflictDoUpdate({
        target: currency.code,
        set: {
          countryCode: row.countryCode,
          countryName: row.countryName,
        },
      })
      .run();
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
