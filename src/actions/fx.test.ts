import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { TestDb } from "@/test/db-harness";

// `refreshRates` reaches the frankfurter service, which imports the production
// `db` singleton; and the action calls `revalidatePath`. Point the singleton at
// a fresh in-memory test DB and no-op revalidation (mirrors actions/channels.test.ts).
const dbHolder = vi.hoisted(() => ({ current: null as unknown as TestDb }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", () => ({
  get db() {
    return dbHolder.current;
  },
}));

import { revalidatePath } from "next/cache";
import { createTestDb } from "@/test/db-harness";
import { refreshRates } from "@/actions/fx";
import { listRates, upsertRates } from "@/db/fxRates";
import { CURRENCY_SEED, seedCurrencies } from "@/db/seed";

const FIXED_USD_RATES: Record<string, number> = {
  CNY: 6.7982,
  EUR: 0.87712,
  JPY: 161.65,
};

const USD_RATES = Object.fromEntries(
  CURRENCY_SEED.filter((currency) => currency.code !== "USD").map(
    (currency, index) => [
      currency.code,
      FIXED_USD_RATES[currency.code] ?? 1.2 + index / 10,
    ],
  ),
);

/** Verified Frankfurter v1 response shape (USD→X), USD not echoed in `rates`. */
const VALID_RESPONSE = {
  amount: 1.0,
  base: "USD",
  date: "2026-06-26",
  rates: USD_RATES,
};

const CNY_TO_USD = 1 / VALID_RESPONSE.rates.CNY;
const VALID_CNY_RESPONSE = {
  amount: 1.0,
  base: "CNY",
  date: "2026-06-26",
  rates: Object.fromEntries(
    Object.entries({ ...VALID_RESPONSE.rates, USD: 1 })
      .filter(([code]) => code !== "CNY")
      .map(([code, usdToCode]) => [code, CNY_TO_USD * usdToCode]),
  ),
};

function okFetch(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => body });
}

/** Pre-populate a non-empty cache so the stale-fallback test has something to fall back to. */
function seedCache(db: TestDb, fetchedAt: string) {
  upsertRates(
    db,
    CURRENCY_SEED.map((currency) => ({
      currencyCode: currency.code,
      rateToUsd: currency.code === "USD" ? "1" : "0.14000",
      fetchedAt,
    })),
  );
}

describe("refreshRates server action (FX-01 / FX-03)", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
    dbHolder.current = ctx.db;
    // FK enforcement is ON — currencies must exist before any fx_rate write.
    seedCurrencies(ctx.db);
  });

  afterEach(() => {
    ctx.sqlite.close();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("success: persists inverted rows for default currencies and returns { ok, stale:false }, revalidating the route", async () => {
    vi.stubGlobal("fetch", okFetch(VALID_RESPONSE));

    const res = await refreshRates();

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.stale).toBe(false);
      expect(res.fetchedAt).toBeTypeOf("string");
      expect(res.base).toBe("USD");
    }
    // rows were persisted by the service
    const rows = listRates(ctx.db);
    expect(rows).toHaveLength(CURRENCY_SEED.length);
    expect(rows.find(({ rate }) => rate.currencyCode === "USD")?.rate.rateToUsd).toBe("1");
    // revalidatePath was called for the rates route
    expect(revalidatePath).toHaveBeenCalledWith("/reference-data/rates");
  });

  it("success: accepts CNY as a refresh base and still persists X→USD rows", async () => {
    const fetchSpy = okFetch(VALID_CNY_RESPONSE);
    vi.stubGlobal("fetch", fetchSpy);

    const res = await refreshRates("CNY");

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.base).toBe("CNY");
      expect(res.stale).toBe(false);
    }
    const rows = listRates(ctx.db);
    expect(rows.find(({ rate }) => rate.currencyCode === "USD")?.rate.rateToUsd).toBe("1");
    expect(
      Number(rows.find(({ rate }) => rate.currencyCode === "CNY")?.rate.rateToUsd),
    ).toBeCloseTo(1 / 6.7982, 8);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("base=CNY");
    expect(revalidatePath).toHaveBeenCalledWith("/reference-data/rates");
  });

  it("rejects an unsupported refresh base before fetching", async () => {
    const fetchSpy = okFetch(VALID_RESPONSE);
    vi.stubGlobal("fetch", fetchSpy);

    const res = await refreshRates("EUR");

    expect(res).toEqual({ ok: false, error: "无效的汇率基准。" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("stale fallback: failed fetch with a non-empty cache returns { ok, stale:true } and writes nothing", async () => {
    seedCache(ctx.db, "2026-06-20T00:00:00.000Z");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError")),
    );

    const before = listRates(ctx.db);
    const res = await refreshRates();

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.stale).toBe(true);
      expect(res.fetchedAt).toBe("2026-06-20T00:00:00.000Z");
    }
    // DB untouched — the failed fetch wrote nothing (no 0/NULL).
    expect(listRates(ctx.db)).toEqual(before);
    expect(revalidatePath).toHaveBeenCalledWith("/reference-data/rates");
  });
});
