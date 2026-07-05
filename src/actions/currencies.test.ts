import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { TestDb } from "@/test/db-harness";

const dbHolder = vi.hoisted(() => ({ current: null as unknown as TestDb }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", () => ({
  get db() {
    return dbHolder.current;
  },
}));

import { createTestDb } from "@/test/db-harness";
import {
  addCurrency,
  deleteCurrency,
  updateCurrency,
} from "@/actions/currencies";
import { listCurrencies } from "@/db/currencies";
import { upsertRates } from "@/db/fxRates";
import { seedCurrencies } from "@/db/seed";
import { currency, fxRate, paymentChannel, space } from "@/db/schema";

describe("currency server actions", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
    dbHolder.current = ctx.db;
    seedCurrencies(ctx.db);
    ctx.db.delete(currency).where(eq(currency.code, "CAD")).run();
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  it("adds a DB-backed rate-supported currency with symbol and minor unit", async () => {
    const res = await addCurrency({
      code: "cad",
      countryCode: "CA",
      countryName: "加拿大",
      name: "加拿大元",
      symbol: "CA$",
      minorUnit: 2,
    });

    expect(res.ok).toBe(true);
    const cad = listCurrencies(ctx.db).find((row) => row.code === "CAD");
    expect(cad).toMatchObject({
      code: "CAD",
      countryCode: "CA",
      countryName: "加拿大",
      name: "加拿大元",
      symbol: "CA$",
      minorUnit: 2,
    });
  });

  it("rejects duplicate currency codes", async () => {
    const res = await addCurrency({
      code: "USD",
      countryCode: "US",
      countryName: "美国",
      name: "Duplicate Dollar",
      symbol: "$",
      minorUnit: 2,
    });

    expect(res.ok).toBe(false);
    expect(listCurrencies(ctx.db).filter((row) => row.code === "USD")).toHaveLength(1);
  });

  it("rejects invalid currency input server-side", async () => {
    const before = listCurrencies(ctx.db).length;
    const res = await addCurrency({
      code: "A",
      countryCode: "",
      countryName: "",
      name: "",
      symbol: "",
      minorUnit: -1,
    });

    expect(res.ok).toBe(false);
    expect(listCurrencies(ctx.db)).toHaveLength(before);
  });

  it("rejects unsupported currency codes", async () => {
    const before = listCurrencies(ctx.db).length;
    const res = await addCurrency({
      code: "ZZZ",
      countryCode: "ZZ",
      countryName: "未知地区",
      name: "未知货币",
      symbol: "Z",
      minorUnit: 2,
    });

    expect(res.ok).toBe(false);
    expect(listCurrencies(ctx.db)).toHaveLength(before);
  });

  it("updates currency metadata while keeping the code stable", async () => {
    await addCurrency({
      code: "CAD",
      countryCode: "CA",
      countryName: "加拿大",
      name: "加拿大元",
      symbol: "CA$",
      minorUnit: 2,
    });

    const res = await updateCurrency("CAD", {
      name: "加拿大元-更新",
      symbol: "C$",
      minorUnit: 2,
    });

    expect(res.ok).toBe(true);
    const cad = listCurrencies(ctx.db).find((row) => row.code === "CAD");
    expect(cad).toMatchObject({
      code: "CAD",
      name: "加拿大元-更新",
      symbol: "C$",
      minorUnit: 2,
    });
  });

  it("deletes an unused currency and its cached fx rate", async () => {
    await addCurrency({
      code: "CAD",
      countryCode: "CA",
      countryName: "加拿大",
      name: "加拿大元",
      symbol: "CA$",
      minorUnit: 2,
    });
    upsertRates(ctx.db, [
      {
        currencyCode: "CAD",
        rateToUsd: "0.73",
        fetchedAt: "2026-07-01T00:00:00.000Z",
      },
    ]);

    const res = await deleteCurrency("CAD");

    expect(res.ok).toBe(true);
    expect(
      ctx.db.select().from(currency).where(eq(currency.code, "CAD")).all(),
    ).toHaveLength(0);
    expect(
      ctx.db.select().from(fxRate).where(eq(fxRate.currencyCode, "CAD")).all(),
    ).toHaveLength(0);
  });

  it("blocks deleting exchange-rate base currencies", async () => {
    const usd = await deleteCurrency("USD");
    const cny = await deleteCurrency("CNY");

    expect(usd.ok).toBe(false);
    expect(cny.ok).toBe(false);
    expect(listCurrencies(ctx.db).some((row) => row.code === "USD")).toBe(true);
    expect(listCurrencies(ctx.db).some((row) => row.code === "CNY")).toBe(true);
  });

  it("blocks deleting currencies referenced by spaces", async () => {
    await addCurrency({
      code: "CAD",
      countryCode: "CA",
      countryName: "加拿大",
      name: "加拿大元",
      symbol: "CA$",
      minorUnit: 2,
    });
    const channel = ctx.db
      .insert(paymentChannel)
      .values({ name: "Visa" })
      .returning()
      .get();
    ctx.db
      .insert(space)
      .values({
        name: "Canada Team",
        country: "CA",
        paymentChannelId: channel.id,
        currencyCode: "CAD",
        amountMinor: 1000,
        periodUnit: "month",
        periodCount: 1,
        rateUsed: "0.73",
        rateAsOf: "2026-07-01T00:00:00.000Z",
        rateSource: "test",
        amountUsd: 730,
        openingDate: "2026-07-01",
        expiryDate: "2026-08-01",
      })
      .run();

    const res = await deleteCurrency("CAD");

    expect(res.ok).toBe(false);
    expect(listCurrencies(ctx.db).some((row) => row.code === "CAD")).toBe(true);
  });

  it("blocks changing minor unit once a currency has amount records", async () => {
    await addCurrency({
      code: "CAD",
      countryCode: "CA",
      countryName: "加拿大",
      name: "加拿大元",
      symbol: "CA$",
      minorUnit: 2,
    });
    const channel = ctx.db
      .insert(paymentChannel)
      .values({ name: "Visa" })
      .returning()
      .get();
    ctx.db
      .insert(space)
      .values({
        name: "Canada Team",
        country: "CA",
        paymentChannelId: channel.id,
        currencyCode: "CAD",
        amountMinor: 1000,
        periodUnit: "month",
        periodCount: 1,
        rateUsed: "0.73",
        rateAsOf: "2026-07-01T00:00:00.000Z",
        rateSource: "test",
        amountUsd: 730,
        openingDate: "2026-07-01",
        expiryDate: "2026-08-01",
      })
      .run();

    const res = await updateCurrency("CAD", {
      name: "加拿大元",
      symbol: "CA$",
      minorUnit: 0,
    });

    expect(res.ok).toBe(false);
    expect(listCurrencies(ctx.db).find((row) => row.code === "CAD")?.minorUnit).toBe(2);
  });
});
