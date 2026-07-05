import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb } from "@/test/db-harness";
import {
  listRates,
  upsertRates,
  getMostRecentFetchedAt,
} from "@/db/fxRates";
import { fxRate } from "@/db/schema";
import { CURRENCY_SEED, seedCurrencies } from "@/db/seed";

/** Seeded currencies as X→USD decimal-string rows; USD pinned to "1" (D-03). */
function defaultRateRows(fetchedAt: string) {
  const rateByCode: Record<string, string> = {
    AUD: "0.6535",
    BRL: "0.1800",
    CAD: "0.7300",
    CHF: "1.2500",
    USD: "1",
    CNY: "0.14709",
    CZK: "0.0460",
    DKK: "0.1450",
    EUR: "1.0832",
    GBP: "1.2654",
    HUF: "0.0028",
    IDR: "0.000061",
    ILS: "0.2700",
    INR: "0.0120",
    ISK: "0.0080",
    JPY: "0.0064",
    HKD: "0.1282",
    KRW: "0.00072",
    MXN: "0.0540",
    MYR: "0.2100",
    NOK: "0.0950",
    NZD: "0.6100",
    PHP: "0.0170",
    PLN: "0.2500",
    RON: "0.2200",
    SEK: "0.0960",
    SGD: "0.7812",
    THB: "0.0307",
    TRY: "0.0300",
    ZAR: "0.0550",
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

  it("upsertRates writes all seeded rows; USD is stored as the literal string '1' (D-03)", () => {
    upsertRates(ctx.db, defaultRateRows("2026-06-28T00:00:00Z"));

    const rows = ctx.db.select().from(fxRate).all();
    expect(rows).toHaveLength(CURRENCY_SEED.length);

    const usd = rows.find((r) => r.currencyCode === "USD");
    expect(usd?.rateToUsd).toBe("1");
  });

  it("re-running upsertRates with the same currencyCode updates in place, never duplicates (D-01 PK conflict)", () => {
    upsertRates(ctx.db, defaultRateRows("2026-06-28T00:00:00Z"));
    upsertRates(ctx.db, [
      { currencyCode: "CNY", rateToUsd: "0.13999", fetchedAt: "2026-06-28T06:00:00Z" },
    ]);

    const rows = ctx.db.select().from(fxRate).all();
    // Still one row per seeded currency — the conflict updated CNY, no duplicate.
    expect(rows).toHaveLength(CURRENCY_SEED.length);

    const cny = rows.find((r) => r.currencyCode === "CNY");
    expect(cny?.rateToUsd).toBe("0.13999");
    expect(cny?.fetchedAt).toBe("2026-06-28T06:00:00Z");
  });

  it("listRates returns rows ordered by currencyCode", () => {
    upsertRates(ctx.db, defaultRateRows("2026-06-28T00:00:00Z"));

    const codes = listRates(ctx.db).map(({ rate }) => rate.currencyCode);
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
