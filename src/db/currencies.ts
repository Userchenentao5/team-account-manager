import { count, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { childAccount, currency, fxRate, space } from "./schema";

/**
 * REF-02 — parameterized currency data access.
 *
 * Explicit-db helper so action and DB tests can resolve the authoritative
 * minor-unit exponent without importing the production singleton.
 */
type Db = BetterSQLite3Database<Record<string, unknown>>;

export type CurrencyRow = typeof currency.$inferSelect;
export type CurrencyInsert = typeof currency.$inferInsert;
export type CurrencyUpdate = Pick<
  CurrencyInsert,
  "name" | "symbol" | "minorUnit"
>;
export type CurrencyUsage = {
  spaces: number;
  childAccounts: number;
};

export function listCurrencies(db: Db): CurrencyRow[] {
  return db.select().from(currency).orderBy(currency.code).all();
}

export function insertCurrency(db: Db, values: CurrencyInsert): CurrencyRow {
  return db.insert(currency).values(values).returning().get();
}

export function updateCurrencyRow(
  db: Db,
  code: string,
  values: CurrencyUpdate,
): CurrencyRow | undefined {
  return db
    .update(currency)
    .set(values)
    .where(eq(currency.code, code))
    .returning()
    .get();
}

export function deleteCurrencyRow(db: Db, code: string): void {
  db.transaction((tx) => {
    tx.delete(fxRate).where(eq(fxRate.currencyCode, code)).run();
    tx.delete(currency).where(eq(currency.code, code)).run();
  });
}

export function findCurrencyByCode(
  db: Db,
  code: string,
): CurrencyRow | undefined {
  return db.select().from(currency).where(eq(currency.code, code)).get();
}

export function getCurrencyMinorUnit(
  db: Db,
  code: string,
): number | undefined {
  return db
    .select({ minorUnit: currency.minorUnit })
    .from(currency)
    .where(eq(currency.code, code))
    .get()?.minorUnit;
}

export function countCurrencyUsage(db: Db, code: string): CurrencyUsage {
  const spaces =
    db
      .select({ value: count() })
      .from(space)
      .where(eq(space.currencyCode, code))
      .get()?.value ?? 0;

  const childAccounts =
    db
      .select({ value: count() })
      .from(childAccount)
      .where(eq(childAccount.monthlyCurrencyCode, code))
      .get()?.value ?? 0;

  return { spaces, childAccounts };
}
