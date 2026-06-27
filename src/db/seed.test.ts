import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq, ne } from "drizzle-orm";
import { createTestDb } from "@/test/db-harness";
import { seedCurrencies } from "@/db/seed";
import { currency } from "@/db/schema";

describe("currency seed (REF-02 / D-02 / D-03)", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  it("seeds exactly 6 currencies", () => {
    seedCurrencies(ctx.db);
    const rows = ctx.db.select().from(currency).all();
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.code).sort()).toEqual([
      "CNY",
      "EUR",
      "GBP",
      "HKD",
      "JPY",
      "USD",
    ]);
  });

  it("stores JPY with minor_unit 0 and the others with minor_unit 2", () => {
    seedCurrencies(ctx.db);
    const jpy = ctx.db
      .select()
      .from(currency)
      .where(eq(currency.code, "JPY"))
      .get();
    expect(jpy?.minorUnit).toBe(0);

    const others = ctx.db
      .select()
      .from(currency)
      .where(ne(currency.code, "JPY"))
      .all();
    expect(others).toHaveLength(5);
    expect(others.every((r) => r.minorUnit === 2)).toBe(true);
  });

  it("is idempotent — running the seed twice still yields 6 rows", () => {
    seedCurrencies(ctx.db);
    seedCurrencies(ctx.db);
    const rows = ctx.db.select().from(currency).all();
    expect(rows).toHaveLength(6);
  });
});
