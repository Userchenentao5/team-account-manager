import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestDb } from "@/test/db-harness";

const dbHolder = vi.hoisted(() => ({ current: null as unknown as TestDb }));
const fxMock = vi.hoisted(() => ({ ensureFreshRates: vi.fn() }));

vi.mock("@/db", () => ({
  get db() {
    return dbHolder.current;
  },
}));
vi.mock("@/lib/fx/frankfurter", () => ({
  ensureFreshRates: fxMock.ensureFreshRates,
}));

import { upsertRates } from "@/db/fxRates";
import { seedCurrencies } from "@/db/seed";
import { freezeUsdSnapshot } from "@/lib/usd-snapshot";
import { createTestDb } from "@/test/db-harness";

describe("freezeUsdSnapshot", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
    dbHolder.current = ctx.db;
    seedCurrencies(ctx.db);
    fxMock.ensureFreshRates.mockResolvedValue({
      stale: false,
      fetchedAt: "2026-06-28T00:00:00.000Z",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    ctx.sqlite.close();
  });

  it("freezes with the cached rate and currency precision", async () => {
    upsertRates(ctx.db, [
      {
        currencyCode: "JPY",
        rateToUsd: "0.0064",
        fetchedAt: "2026-06-29T00:00:00.000Z",
      },
    ]);

    await expect(
      freezeUsdSnapshot(ctx.db, { amountMinor: 1000, currencyCode: "JPY" }),
    ).resolves.toEqual({
      ok: true,
      rateUsed: "0.0064",
      rateAsOf: "2026-06-29T00:00:00.000Z",
      rateSource: "frankfurter",
      amountUsd: 640,
    });
    expect(fxMock.ensureFreshRates).toHaveBeenCalledOnce();
  });

  it("returns the domain error when no cached rate exists", async () => {
    await expect(
      freezeUsdSnapshot(ctx.db, { amountMinor: 1000, currencyCode: "EUR" }),
    ).resolves.toEqual({
      ok: false,
      error: "该币种暂无汇率，无法折算 USD。请先到「汇率」页刷新汇率后重试。",
    });
  });

  it("keeps zero-value self-use accounts independent of FX", async () => {
    await expect(
      freezeUsdSnapshot(
        ctx.db,
        { amountMinor: 0, currencyCode: "CNY" },
        {
          zeroAmountSource: "self-use",
          now: new Date("2026-07-01T00:00:00.000Z"),
        },
      ),
    ).resolves.toEqual({
      ok: true,
      rateUsed: "1",
      rateAsOf: "2026-07-01T00:00:00.000Z",
      rateSource: "self-use",
      amountUsd: 0,
    });
    expect(fxMock.ensureFreshRates).not.toHaveBeenCalled();
  });
});
