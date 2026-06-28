import { desc } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { fxRate } from "./schema";

/**
 * FX-01 — parameterized exchange-rate cache access (T-02-01 / T-02-04).
 *
 * Pure data helpers that take an explicit `db` so they run against both the
 * production singleton and the in-memory test harness (never import the `@/db`
 * singleton here). Writes go through `upsertRates`, which wraps every row in a
 * single `db.transaction` + `onConflictDoUpdate` so the cache is updated
 * all-or-nothing — a partial/0/NULL row set is never persisted (Pitfall 1).
 * Rates are X→USD decimal STRINGS (D-02); USD is pinned to "1" by the caller
 * (D-03). Every query uses Drizzle parameterized builders — never string SQL.
 */
type Db = BetterSQLite3Database<Record<string, unknown>>;

export type FxRateRow = typeof fxRate.$inferSelect;
export type FxRateInsert = typeof fxRate.$inferInsert;

/** All cached rates, ordered by currency code. */
export function listRates(db: Db): FxRateRow[] {
  return db.select().from(fxRate).orderBy(fxRate.currencyCode).all();
}

/** Latest `fetched_at` across all rows, or null on an empty table (D-05/D-07). */
export function getMostRecentFetchedAt(db: Db): string | null {
  const row = db
    .select({ fetchedAt: fxRate.fetchedAt })
    .from(fxRate)
    .orderBy(desc(fxRate.fetchedAt))
    .limit(1)
    .get();
  return row?.fetchedAt ?? null;
}

/**
 * Atomic upsert of a rate set. All rows are written inside one transaction so
 * the cache is never left partially updated (Pitfall 1). Re-running with an
 * existing `currencyCode` updates that row in place via the PK conflict path.
 */
export function upsertRates(db: Db, rows: FxRateInsert[]): void {
  db.transaction((tx) => {
    for (const r of rows) {
      tx.insert(fxRate)
        .values(r)
        .onConflictDoUpdate({
          target: fxRate.currencyCode,
          set: { rateToUsd: r.rateToUsd, fetchedAt: r.fetchedAt },
        })
        .run();
    }
  });
}
