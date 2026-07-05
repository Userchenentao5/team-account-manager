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

  it("seeds all supported currencies by default", () => {
    seedCurrencies(ctx.db);
    const rows = ctx.db.select().from(currency).all();
    expect(rows).toHaveLength(30);
    expect(rows.map((r) => r.code).sort()).toEqual([
      "AUD",
      "BRL",
      "CAD",
      "CHF",
      "CNY",
      "CZK",
      "DKK",
      "EUR",
      "GBP",
      "HKD",
      "HUF",
      "IDR",
      "ILS",
      "INR",
      "ISK",
      "JPY",
      "KRW",
      "MXN",
      "MYR",
      "NOK",
      "NZD",
      "PHP",
      "PLN",
      "RON",
      "SEK",
      "SGD",
      "THB",
      "TRY",
      "USD",
      "ZAR",
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
    expect(others).toHaveLength(29);
    expect(rowsByCode(others, ["ISK", "KRW"]).every((r) => r.minorUnit === 0)).toBe(true);
    expect(
      others
        .filter((row) => !["ISK", "KRW"].includes(row.code))
        .every((r) => r.minorUnit === 2),
    ).toBe(true);
  });

  it("stores currency symbols as maintainable reference data", () => {
    seedCurrencies(ctx.db);

    const rows = ctx.db.select().from(currency).all();
    expect(Object.fromEntries(rows.map((r) => [r.code, r.symbol]))).toMatchObject({
      AUD: "A$",
      BRL: "R$",
      CAD: "CA$",
      CHF: "CHF",
      CNY: "￥",
      EUR: "€",
      GBP: "£",
      HKD: "HK$",
      JPY: "￥",
      SGD: "S$",
      THB: "฿",
      USD: "$",
      ZAR: "R",
    });
  });

  it("stores default currency names in Chinese", () => {
    seedCurrencies(ctx.db);

    const rows = ctx.db.select().from(currency).all();
    expect(Object.fromEntries(rows.map((r) => [r.code, r.name]))).toMatchObject({
      AUD: "澳大利亚元",
      BRL: "巴西雷亚尔",
      CAD: "加拿大元",
      CHF: "瑞士法郎",
      CNY: "人民币",
      EUR: "欧元",
      GBP: "英镑",
      HKD: "港元",
      JPY: "日元",
      SGD: "新加坡元",
      THB: "泰铢",
      USD: "美元",
      ZAR: "南非兰特",
    });
  });

  it("stores default currency countries in Chinese", () => {
    seedCurrencies(ctx.db);

    const rows = ctx.db.select().from(currency).all();
    expect(Object.fromEntries(rows.map((r) => [r.code, r.countryName]))).toMatchObject({
      AUD: "澳大利亚",
      BRL: "巴西",
      CHF: "瑞士",
      CNY: "中国",
      EUR: "法国",
      GBP: "英国",
      HKD: "中国香港",
      JPY: "日本",
      SGD: "新加坡",
      THB: "泰国",
      USD: "美国",
      ZAR: "南非",
    });
  });

  it("is idempotent — running the seed twice still yields all supported rows", () => {
    seedCurrencies(ctx.db);
    seedCurrencies(ctx.db);
    const rows = ctx.db.select().from(currency).all();
    expect(rows).toHaveLength(30);
  });
});

function rowsByCode<T extends { code: string }>(rows: T[], codes: string[]): T[] {
  return rows.filter((row) => codes.includes(row.code));
}
