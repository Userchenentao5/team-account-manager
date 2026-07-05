import { asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { childAccount, currency, motherAccount } from "./schema";

/**
 * ACCT-02/03 — child-account data access.
 *
 * Helpers take an explicit `db` so production code and the migration-backed
 * in-memory test harness exercise the same Drizzle builders.
 */
type Db = BetterSQLite3Database<Record<string, unknown>>;

export type ChildAccountRow = typeof childAccount.$inferSelect;
export type ChildAccountInsert = typeof childAccount.$inferInsert;
export type ChildAccountUpdate = Partial<typeof childAccount.$inferInsert>;
export type MotherSeatUpdate = Pick<
  typeof motherAccount.$inferInsert,
  "seatType" | "canChangeSeatType"
>;

export type ChildAccountListRow = {
  childAccount: ChildAccountRow;
  currency: typeof currency.$inferSelect;
};

export function listChildAccounts(
  db: Db,
  spaceId: number,
): ChildAccountListRow[] {
  return db
    .select({
      childAccount,
      currency,
    })
    .from(childAccount)
    .innerJoin(currency, eq(currency.code, childAccount.monthlyCurrencyCode))
    .where(eq(childAccount.spaceId, spaceId))
    .orderBy(asc(childAccount.id))
    .all();
}

export function getChildAccount(
  db: Db,
  id: number,
): ChildAccountRow | undefined {
  return db.select().from(childAccount).where(eq(childAccount.id, id)).get();
}

export function insertChildAccount(
  db: Db,
  values: ChildAccountInsert,
): ChildAccountRow {
  return db.insert(childAccount).values(values).returning().get();
}

export function updateChildAccount(
  db: Db,
  id: number,
  values: ChildAccountUpdate,
): ChildAccountRow {
  return db
    .update(childAccount)
    .set(values)
    .where(eq(childAccount.id, id))
    .returning()
    .get();
}

export function deleteChildAccount(db: Db, id: number): void {
  db.delete(childAccount).where(eq(childAccount.id, id)).run();
}

export function updateMotherSeat(
  db: Db,
  spaceId: number,
  values: MotherSeatUpdate,
): void {
  db.update(motherAccount)
    .set(values)
    .where(eq(motherAccount.spaceId, spaceId))
    .run();
}
