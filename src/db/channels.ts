import { and, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { paymentChannel } from "./schema";

/**
 * REF-01 — parameterized payment-channel data access (T-03-SQLI / T-03-DEL).
 *
 * Pure data helpers that take an explicit `db` so they can run against both the
 * production singleton and the in-memory test harness. Every removal is a
 * soft-delete (flip `is_active`) — there is intentionally NO delete helper here
 * (D-06: uniform soft-delete, FK integrity preserved per D-07). All queries use
 * Drizzle's parameterized builders — never string-concatenated SQL.
 */
type ChannelDb = BetterSQLite3Database<Record<string, unknown>>;

export type ChannelRow = typeof paymentChannel.$inferSelect;

/** Active-only picker query (default) or all rows when `includeArchived`. */
export function listChannels(
  db: ChannelDb,
  includeArchived = false,
): ChannelRow[] {
  if (includeArchived) {
    return db.select().from(paymentChannel).orderBy(paymentChannel.id).all();
  }
  return db
    .select()
    .from(paymentChannel)
    .where(eq(paymentChannel.isActive, true))
    .orderBy(paymentChannel.id)
    .all();
}

/** Insert a new channel (new surrogate id, is_active defaults to true). */
export function insertChannel(db: ChannelDb, name: string): ChannelRow {
  return db.insert(paymentChannel).values({ name }).returning().get();
}

/** Rename a channel by id — the surrogate id is unchanged (D-05). */
export function renameChannelRow(
  db: ChannelDb,
  id: number,
  name: string,
): ChannelRow {
  return db
    .update(paymentChannel)
    .set({ name })
    .where(eq(paymentChannel.id, id))
    .returning()
    .get();
}

/** Soft-delete / reactivate — flips is_active; the row is never removed (D-06). */
export function setChannelActive(
  db: ChannelDb,
  id: number,
  isActive: boolean,
): ChannelRow {
  return db
    .update(paymentChannel)
    .set({ isActive })
    .where(eq(paymentChannel.id, id))
    .returning()
    .get();
}

/** Look up an ACTIVE channel by exact name (duplicate-name guard). */
export function findActiveByName(
  db: ChannelDb,
  name: string,
): ChannelRow | undefined {
  return db
    .select()
    .from(paymentChannel)
    .where(and(eq(paymentChannel.name, name), eq(paymentChannel.isActive, true)))
    .get();
}
