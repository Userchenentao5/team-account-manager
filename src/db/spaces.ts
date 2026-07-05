import { and, asc, count, eq, inArray } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { childAccount, currency, motherAccount, paymentChannel, space } from "./schema";

/**
 * SPACE-02/03 — parameterized space data access.
 *
 * Helpers take an explicit `db` so the same code runs against production and
 * the in-memory test harness. All queries use Drizzle builders; the space +
 * mother account write is one synchronous SQLite transaction.
 */
type Db = BetterSQLite3Database<Record<string, unknown>>;

export type SpaceRow = typeof space.$inferSelect;
export type SpaceInsert = typeof space.$inferInsert;
export type SpaceUpdate = Partial<typeof space.$inferInsert>;

export type SpaceListFilters = {
  country?: string;
  channelId?: number;
};

export type DeleteSpaceCascadeResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "name_mismatch" };

export type SpaceListRow = {
  space: SpaceRow;
  motherAccount: typeof motherAccount.$inferSelect;
  paymentChannel: typeof paymentChannel.$inferSelect;
  currency: typeof currency.$inferSelect;
  childCount: number;
};

export function insertSpaceWithMother(
  db: Db,
  spaceValues: SpaceInsert,
  email: string,
): SpaceRow {
  return db.transaction((tx) => {
    const row = tx.insert(space).values(spaceValues).returning().get();
    tx.insert(motherAccount).values({ spaceId: row.id, email }).run();
    return row;
  });
}

export function listSpaces(
  db: Db,
  filters: SpaceListFilters = {},
): SpaceRow[] {
  return db
    .select()
    .from(space)
    .where(
      and(
        filters.country ? eq(space.country, filters.country) : undefined,
        filters.channelId
          ? eq(space.paymentChannelId, filters.channelId)
          : undefined,
      ),
    )
    .orderBy(asc(space.expiryDate))
    .all();
}

export function listSpaceDetails(
  db: Db,
  filters: SpaceListFilters = {},
): SpaceListRow[] {
  const rows = db
    .select({
      space,
      motherAccount,
      paymentChannel,
      currency,
    })
    .from(space)
    .innerJoin(motherAccount, eq(motherAccount.spaceId, space.id))
    .innerJoin(paymentChannel, eq(paymentChannel.id, space.paymentChannelId))
    .innerJoin(currency, eq(currency.code, space.currencyCode))
    .where(
      and(
        filters.country ? eq(space.country, filters.country) : undefined,
        filters.channelId
          ? eq(space.paymentChannelId, filters.channelId)
          : undefined,
      ),
    )
    .orderBy(asc(space.expiryDate))
    .all();

  if (rows.length === 0) return [];

  const childCounts = db
    .select({
      spaceId: childAccount.spaceId,
      value: count(),
    })
    .from(childAccount)
    .where(inArray(childAccount.spaceId, rows.map((row) => row.space.id)))
    .groupBy(childAccount.spaceId)
    .all();
  const childCountBySpace = new Map(
    childCounts.map((row) => [row.spaceId, row.value]),
  );

  return rows.map((row) => ({
    ...row,
    childCount: childCountBySpace.get(row.space.id) ?? 0,
  }));
}

export function getSpaceDetail(db: Db, id: number) {
  return db
    .select({
      space,
      motherAccount,
      paymentChannel,
      currency,
    })
    .from(space)
    .innerJoin(motherAccount, eq(motherAccount.spaceId, space.id))
    .innerJoin(paymentChannel, eq(paymentChannel.id, space.paymentChannelId))
    .innerJoin(currency, eq(currency.code, space.currencyCode))
    .where(eq(space.id, id))
    .get();
}

export function updateSpaceRow(
  db: Db,
  id: number,
  values: SpaceUpdate,
): SpaceRow {
  return db.update(space).set(values).where(eq(space.id, id)).returning().get();
}

export function updateMotherAccountEmail(
  db: Db,
  spaceId: number,
  email: string,
): void {
  db.update(motherAccount)
    .set({ email })
    .where(eq(motherAccount.spaceId, spaceId))
    .run();
}

export function deleteSpaceCascade(
  db: Db,
  id: number,
  expectedName: string,
): DeleteSpaceCascadeResult {
  return db.transaction((tx) => {
    const current = tx
      .select({ name: space.name })
      .from(space)
      .where(eq(space.id, id))
      .get();
    if (!current) {
      return { ok: false, reason: "not_found" };
    }
    if (current.name !== expectedName) {
      return { ok: false, reason: "name_mismatch" };
    }

    tx.delete(space).where(eq(space.id, id)).run();
    return { ok: true };
  });
}
