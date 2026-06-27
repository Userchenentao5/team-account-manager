import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * REF-02 — curated, seeded currency list (D-01/02/03).
 *
 * `minorUnit` is the authoritative ISO-4217 exponent (JPY = 0, others = 2) that
 * drives all integer-minor-unit money math downstream.
 */
export const currency = sqliteTable("currency", {
  code: text("code").primaryKey(), // 'USD','CNY','EUR','GBP','JPY','HKD'
  name: text("name").notNull(),
  minorUnit: integer("minor_unit").notNull(), // JPY=0, others=2 — money authority
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

/**
 * REF-01 — user-maintained payment channels.
 *
 * Surrogate `id` PK + FK reference (D-05, never name strings). Uniform
 * soft-delete via `isActive` (D-06) — there is no hard-delete path.
 */
export const paymentChannel = sqliteTable("payment_channel", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

/**
 * Phase 3 entity — DECLARED NOW (Pattern 2) so the money/FX-snapshot/period
 * columns never require a backfill migration over live data. All FX/period
 * columns are nullable until Phase 3 populates them.
 */
export const space = sqliteTable("space", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  country: text("country").notNull(), // ISO-3166 alpha-2 (D-11)
  paymentChannelId: integer("payment_channel_id")
    .notNull()
    .references(() => paymentChannel.id), // FK preserves integrity (D-07)
  currencyCode: text("currency_code")
    .notNull()
    .references(() => currency.code),
  // money as integer minor units (Pattern 3)
  amountMinor: integer("amount_minor").notNull(),
  // structured subscription period {unit, count} (locked names)
  periodUnit: text("period_unit"), // 'month' | 'quarter' | 'year'
  periodCount: integer("period_count"),
  // FX-snapshot reserved columns (locked names; nullable until Phase 3)
  rateUsed: text("rate_used"), // decimal string, not float
  rateAsOf: text("rate_as_of"),
  rateSource: text("rate_source"),
  amountUsd: integer("amount_usd"), // USD minor units, frozen at payment
  openingDate: text("opening_date"), // YYYY-MM-DD
  expiryDate: text("expiry_date"), // derived + stored Phase 3
});
