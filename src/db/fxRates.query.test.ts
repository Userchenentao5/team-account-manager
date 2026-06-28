import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb } from "@/test/db-harness";
import {
  listRates,
  upsertRates,
  getMostRecentFetchedAt,
} from "@/db/fxRates";
import { fxRate } from "@/db/schema";
import { seedCurrencies, CURRENCY_SEED } from "@/db/seed";

/** All 6 seeded currencies as X→USD decimal-string rows; USD pinned to "1" (D-03). */
function sixRateRows(fetchedAt: string) {
  const rateByCode: Record<string, string> = {
    USD: "1",
    CNY: "0.14709",
    EUR: "1.0832",
    GBP: "1.2654",
    JPY: "0.0064",
    HKD: "0.1282",
  };
  return CURRENCY_SEED.map((c) => ({
    currencyCode: c.code,
    rateToUsd: rateByCode[c.code],
    fetchedAt,
  }));
}

describe("fx_rate queries (FX-01 / D-01..D-03)", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
    // FK enforcement is ON — currencies must exist before any fx_rate insert.
    seedCurrencies(ctx.db);
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  it("upsertRates writes all 6 rows; USD is stored as the literal string '1' (D-03)", () => {
    upsertRates(ctx.db, sixRateRows("2026-06-28T00:00:00Z"));

    const rows = ctx.db.select().from(fxRate).all();
    expect(rows).toHaveLength(6);

    const usd = rows.find((r) => r.currencyCode === "USD");
    expect(usd?.rateToUsd).toBe("1");
  });

  it("re-running upsertRates with the same currencyCode updates in place, never duplicates (D-01 PK conflict)", () => {
    upsertRates(ctx.db, sixRateRows("2026-06-28T00:00:00Z"));
    upsertRates(ctx.db, [
      { currencyCode: "CNY", rateToUsd: "0.13999", fetchedAt: "2026-06-28T06:00:00Z" },
    ]);

    const rows = ctx.db.select().from(fxRate).all();
    // Still 6 rows — the conflict updated the existing CNY row, no duplicate.
    expect(rows).toHaveLength(6);

    const cny = rows.find((r) => r.currencyCode === "CNY");
    expect(cny?.rateToUsd).toBe("0.13999");
    expect(cny?.fetchedAt).toBe("2026-06-28T06:00:00Z");
  });

  it("listRates returns rows ordered by currencyCode", () => {
    upsertRates(ctx.db, sixRateRows("2026-06-28T00:00:00Z"));

    const codes = listRates(ctx.db).map((r) => r.currencyCode);
    expect(codes).toEqual([...codes].sort());
  });

  it("getMostRecentFetchedAt returns the latest fetched_at across rows", () => {
    upsertRates(ctx.db, [
      { currencyCode: "USD", rateToUsd: "1", fetchedAt: "2026-06-28T00:00:00Z" },
      { currencyCode: "CNY", rateToUsd: "0.14709", fetchedAt: "2026-06-28T09:00:00Z" },
    ]);

    expect(getMostRecentFetchedAt(ctx.db)).toBe("2026-06-28T09:00:00Z");
  });

  it("getMostRecentFetchedAt returns null on an empty table", () => {
    expect(getMostRecentFetchedAt(ctx.db)).toBeNull();
  });

  it("inserting an fx_rate row for a non-seeded currency code fails the FK constraint", () => {
    expect(() =>
      upsertRates(ctx.db, [
        { currencyCode: "ZZZ", rateToUsd: "1.23", fetchedAt: "2026-06-28T00:00:00Z" },
      ]),
    ).toThrow();
  });
});
