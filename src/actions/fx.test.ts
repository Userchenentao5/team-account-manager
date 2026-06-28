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
import { seedCurrencies } from "@/db/seed";

/** Verified Frankfurter v1 response shape (USD→X), USD not echoed in `rates`. */
const VALID_RESPONSE = {
  amount: 1.0,
  base: "USD",
  date: "2026-06-26",
  rates: { CNY: 6.7982, EUR: 0.87712, GBP: 0.75654, HKD: 7.8421, JPY: 161.65 },
};

function okFetch(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => body });
}

/** Pre-populate a non-empty cache so the stale-fallback test has something to fall back to. */
function seedCache(db: TestDb, fetchedAt: string) {
  upsertRates(db, [
    { currencyCode: "USD", rateToUsd: "1", fetchedAt },
    { currencyCode: "CNY", rateToUsd: "0.14000", fetchedAt },
    { currencyCode: "EUR", rateToUsd: "1.1000", fetchedAt },
    { currencyCode: "GBP", rateToUsd: "1.3000", fetchedAt },
    { currencyCode: "JPY", rateToUsd: "0.0065", fetchedAt },
    { currencyCode: "HKD", rateToUsd: "0.1280", fetchedAt },
  ]);
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

  it("success: persists the 6 inverted rows and returns { ok, stale:false }, revalidating the route", async () => {
    vi.stubGlobal("fetch", okFetch(VALID_RESPONSE));

    const res = await refreshRates();

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.stale).toBe(false);
      expect(res.fetchedAt).toBeTypeOf("string");
    }
    // rows were persisted by the service
    const rows = listRates(ctx.db);
    expect(rows).toHaveLength(6);
    expect(rows.find((r) => r.currencyCode === "USD")?.rateToUsd).toBe("1");
    // revalidatePath was called for the rates route
    expect(revalidatePath).toHaveBeenCalledWith("/reference-data/rates");
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
