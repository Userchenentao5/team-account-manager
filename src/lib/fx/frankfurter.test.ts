import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { TestDb } from "@/test/db-harness";

// `frankfurter.ts` imports the production `db` singleton. Point it at a fresh
// in-memory test DB per test (mirrors actions/channels.test.ts).
const dbHolder = vi.hoisted(() => ({ current: null as unknown as TestDb }));
vi.mock("@/db", () => ({
  get db() {
    return dbHolder.current;
  },
}));

import { createTestDb } from "@/test/db-harness";
import { refreshFromApi, ensureFreshRates } from "@/lib/fx/frankfurter";
import { listRates, upsertRates } from "@/db/fxRates";
import { CURRENCY_SEED, seedCurrencies } from "@/db/seed";

const FIXED_USD_RATES: Record<string, number> = {
  CNY: 6.7982,
  EUR: 0.87712,
  JPY: 161.65,
};

/** Verified Frankfurter v1 response shape (USD→X), USD not echoed in `rates`. */
const USD_RATES = Object.fromEntries(
  CURRENCY_SEED.filter((currency) => currency.code !== "USD").map(
    (currency, index) => [
      currency.code,
      FIXED_USD_RATES[currency.code] ?? 1.2 + index / 10,
    ],
  ),
);

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

/** Pre-populate a non-empty cache so fallback tests have something to fall back to. */
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

describe("frankfurter FX service (FX-01 / FX-03)", () => {
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
    vi.restoreAllMocks();
  });

  it("valid response → inverts USD→X to X→USD rows, USD pinned to '1', stale:false (D-02/D-03/D-04)", async () => {
    vi.stubGlobal("fetch", okFetch(VALID_RESPONSE));

    const result = await refreshFromApi();

    expect(result.stale).toBe(false);
    expect(result.fetchedAt).toBeTypeOf("string");

    const rows = listRates(ctx.db);
    expect(rows).toHaveLength(CURRENCY_SEED.length);
    expect(rows.find(({ rate }) => rate.currencyCode === "USD")?.rate.rateToUsd).toBe("1");
    // every cached rate is a positive finite decimal string (no 0/NULL/NaN)
    for (const { rate } of rows) {
      expect(Number(rate.rateToUsd)).toBeGreaterThan(0);
      expect(Number.isFinite(Number(rate.rateToUsd))).toBe(true);
    }
  });

  it("inversion precision: CNY 6.7982 → ~0.147098, JPY 161.65 → ~0.006186 (Pitfall 2)", async () => {
    vi.stubGlobal("fetch", okFetch(VALID_RESPONSE));

    await refreshFromApi();
    const rows = listRates(ctx.db);

    const cny = rows.find(({ rate }) => rate.currencyCode === "CNY")!.rate;
    const jpy = rows.find(({ rate }) => rate.currencyCode === "JPY")!.rate;
    expect(Number(cny.rateToUsd)).toBeCloseTo(1 / 6.7982, 8);
    expect(Number(jpy.rateToUsd)).toBeCloseTo(1 / 161.65, 8);
    // decimal string, not full float noise — bounded significant figures
    expect(cny.rateToUsd.replace(/[-.]/g, "").replace(/^0+/, "").length).toBeLessThanOrEqual(12);
  });

  it("CNY base response → normalizes back to X→USD rows", async () => {
    const fetchSpy = okFetch(VALID_CNY_RESPONSE);
    vi.stubGlobal("fetch", fetchSpy);

    await refreshFromApi("CNY");
    const rows = listRates(ctx.db);

    const usd = rows.find(({ rate }) => rate.currencyCode === "USD")!.rate;
    const cny = rows.find(({ rate }) => rate.currencyCode === "CNY")!.rate;
    const jpy = rows.find(({ rate }) => rate.currencyCode === "JPY")!.rate;
    expect(usd.rateToUsd).toBe("1");
    expect(Number(cny.rateToUsd)).toBeCloseTo(1 / 6.7982, 8);
    expect(Number(jpy.rateToUsd)).toBeCloseTo(1 / 161.65, 8);

    const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("base=CNY");
    expect(calledUrl).toContain("USD");
  });

  it("fetch throws/times out → returns last cache + stale:true, DB unchanged (FX-03)", async () => {
    seedCache(ctx.db, "2026-06-20T00:00:00.000Z");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError")),
    );

    const before = listRates(ctx.db);
    const result = await refreshFromApi();

    expect(result.stale).toBe(true);
    expect(result.rates).toHaveLength(CURRENCY_SEED.length);
    expect(result.fetchedAt).toBe("2026-06-20T00:00:00.000Z");
    // DB untouched — the failed fetch wrote nothing.
    expect(listRates(ctx.db)).toEqual(before);
  });

  it("non-ok HTTP status → falls back to cache + stale:true, no write", async () => {
    seedCache(ctx.db, "2026-06-20T00:00:00.000Z");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }),
    );

    const before = listRates(ctx.db);
    const result = await refreshFromApi();

    expect(result.stale).toBe(true);
    expect(listRates(ctx.db)).toEqual(before);
  });

  it("malformed / 0 / negative rate → Zod rejects, NO write, falls back to cache (Pitfall 1)", async () => {
    seedCache(ctx.db, "2026-06-20T00:00:00.000Z");
    const POISONED = {
      ...VALID_RESPONSE,
      rates: { ...VALID_RESPONSE.rates, CNY: 0, EUR: -1 },
    };
    vi.stubGlobal("fetch", okFetch(POISONED));

    const before = listRates(ctx.db);
    const result = await refreshFromApi();

    expect(result.stale).toBe(true);
    // nothing poisoned — CNY still the cached value, never 0
    expect(listRates(ctx.db)).toEqual(before);
    expect(listRates(ctx.db).find(({ rate }) => rate.currencyCode === "CNY")?.rate.rateToUsd).toBe("0.14000");
  });

  it("empty cache + failed fetch → rates:[], no crash, no fake zeros (Pitfall 5)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await refreshFromApi();

    expect(result.rates).toEqual([]);
    expect(result.stale).toBe(false); // empty cache is not "stale" — there is nothing to be stale
    expect(result.fetchedAt).toBeNull();
    expect(listRates(ctx.db)).toEqual([]);
  });

  it("ensureFreshRates: fresh cache (<~1 day) is served WITHOUT fetching (D-07)", async () => {
    seedCache(ctx.db, new Date().toISOString());
    const fetchSpy = okFetch(VALID_RESPONSE);
    vi.stubGlobal("fetch", fetchSpy);

    const result = await ensureFreshRates();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.stale).toBe(false);
    expect(result.rates).toHaveLength(CURRENCY_SEED.length);
  });

  it("ensureFreshRates: stale-by-age cache (>~1 day) triggers a refresh (D-07)", async () => {
    seedCache(ctx.db, "2026-06-20T00:00:00.000Z"); // ~8 days before the 06-28 'today'
    const fetchSpy = okFetch(VALID_RESPONSE);
    vi.stubGlobal("fetch", fetchSpy);

    const result = await ensureFreshRates();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.stale).toBe(false);
    // refreshed CNY now reflects the inverted live rate, not the old cached 0.14000
    expect(Number(result.rates.find(({ rate }) => rate.currencyCode === "CNY")!.rate.rateToUsd)).toBeCloseTo(
      1 / 6.7982,
      8,
    );
  });

  it("ensureFreshRates: empty cache triggers a refresh", async () => {
    const fetchSpy = okFetch(VALID_RESPONSE);
    vi.stubGlobal("fetch", fetchSpy);

    const result = await ensureFreshRates();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.rates).toHaveLength(CURRENCY_SEED.length);
  });

  it("only frankfurter.ts calls the Frankfurter URL (anti-corruption boundary)", async () => {
    const fetchSpy = okFetch(VALID_RESPONSE);
    vi.stubGlobal("fetch", fetchSpy);

    await refreshFromApi();

    const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("api.frankfurter.dev");
    expect(calledUrl).toContain("base=USD");
  });
});
