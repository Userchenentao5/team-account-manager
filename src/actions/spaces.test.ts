import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestDb } from "@/test/db-harness";

const dbHolder = vi.hoisted(() => ({ current: null as unknown as TestDb }));
const fxMock = vi.hoisted(() => ({ ensureFreshRates: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", () => ({
  get db() {
    return dbHolder.current;
  },
}));
vi.mock("@/lib/fx/frankfurter", () => ({
  ensureFreshRates: fxMock.ensureFreshRates,
}));

import { createSpace, deleteSpace, renewSpace, updateSpace } from "@/actions/spaces";
import { insertChannel, setChannelActive } from "@/db/channels";
import { insertChildAccount } from "@/db/childAccounts";
import { getSpaceDetail } from "@/db/spaces";
import { upsertRates } from "@/db/fxRates";
import { seedCurrencies } from "@/db/seed";
import { childAccount, motherAccount, space } from "@/db/schema";
import { createTestDb } from "@/test/db-harness";

describe("space server actions (SPACE-01 / SPACE-04 / FX-02)", () => {
  let ctx: ReturnType<typeof createTestDb>;
  let channelId: number;

  beforeEach(() => {
    ctx = createTestDb();
    dbHolder.current = ctx.db;
    seedCurrencies(ctx.db);
    channelId = insertChannel(ctx.db, "Visa").id;
    fxMock.ensureFreshRates.mockResolvedValue({
      stale: false,
      fetchedAt: "2026-06-28T00:00:00.000Z",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    ctx.sqlite.close();
  });

  const input = {
    name: "Team Pro",
    country: "US",
    paymentChannelId: 0,
    currencyCode: "USD",
    amountMinor: 1999,
    openingDate: "2026-01-31",
    currentPeriodStartDate: "2026-01-31",
    periodUnit: "month" as const,
    periodCount: 1,
    motherEmail: "owner@example.com",
  };

  function validInput(overrides: Partial<typeof input> = {}) {
    return { ...input, paymentChannelId: channelId, ...overrides };
  }

  it("blocks create when the currency has no cached rate and writes no space", async () => {
    const res = await createSpace(validInput({ currencyCode: "EUR" }));

    expect(res.ok).toBe(false);
    expect(ctx.db.select().from(space).all()).toHaveLength(0);
  });

  it("creates space and mother account with frozen USD snapshot and computed expiry", async () => {
    upsertRates(ctx.db, [
      {
        currencyCode: "USD",
        rateToUsd: "1",
        fetchedAt: "2026-06-28T00:00:00.000Z",
      },
    ]);

    const res = await createSpace(validInput());
    const row = ctx.db.select().from(space).get()!;
    const detail = getSpaceDetail(ctx.db, row.id);

    expect(res.ok).toBe(true);
    expect(detail?.motherAccount.email).toBe("owner@example.com");
    expect(detail?.space.openingDate).toBe("2026-01-31");
    expect(detail?.space.currentPeriodStartDate).toBe("2026-01-31");
    expect(detail?.space.expiryDate).toBe("2026-02-28");
    expect(detail?.space.rateUsed).toBe("1");
    expect(detail?.space.rateAsOf).toBe("2026-06-28T00:00:00.000Z");
    expect(detail?.space.rateSource).toBe("frankfurter");
    expect(detail?.space.amountUsd).toBe(1999);
  });

  it("keeps first opening date separate from the current paid period", async () => {
    upsertRates(ctx.db, [
      {
        currencyCode: "USD",
        rateToUsd: "1",
        fetchedAt: "2026-06-28T00:00:00.000Z",
      },
    ]);

    const res = await createSpace(
      validInput({
        openingDate: "2026-06-02",
        currentPeriodStartDate: "2026-07-02",
      }),
    );
    const row = ctx.db.select().from(space).get()!;

    expect(res.ok).toBe(true);
    expect(row.openingDate).toBe("2026-06-02");
    expect(row.currentPeriodStartDate).toBe("2026-07-02");
    expect(row.expiryDate).toBe("2026-08-02");
  });

  it("preserves frozen snapshot on name-only update", async () => {
    upsertRates(ctx.db, [
      {
        currencyCode: "USD",
        rateToUsd: "1",
        fetchedAt: "2026-06-28T00:00:00.000Z",
      },
    ]);
    await createSpace(validInput());
    const row = ctx.db.select().from(space).get()!;
    fxMock.ensureFreshRates.mockClear();

    const res = await updateSpace(
      row.id,
      validInput({ name: "Team Pro Renamed" }),
    );
    const updated = getSpaceDetail(ctx.db, row.id);

    expect(res.ok).toBe(true);
    expect(fxMock.ensureFreshRates).not.toHaveBeenCalled();
    expect(updated?.space.name).toBe("Team Pro Renamed");
    expect(updated?.space.rateUsed).toBe("1");
    expect(updated?.space.rateAsOf).toBe("2026-06-28T00:00:00.000Z");
    expect(updated?.space.amountUsd).toBe(1999);
  });

  it("re-freezes snapshot when amount or currency changes", async () => {
    upsertRates(ctx.db, [
      {
        currencyCode: "USD",
        rateToUsd: "1",
        fetchedAt: "2026-06-28T00:00:00.000Z",
      },
      {
        currencyCode: "JPY",
        rateToUsd: "0.0064",
        fetchedAt: "2026-06-29T00:00:00.000Z",
      },
    ]);
    await createSpace(validInput());
    const row = ctx.db.select().from(space).get()!;

    const res = await updateSpace(
      row.id,
      validInput({
        currencyCode: "JPY",
        amountMinor: 1000,
      }),
    );
    const updated = getSpaceDetail(ctx.db, row.id);

    expect(res.ok).toBe(true);
    expect(updated?.space.currencyCode).toBe("JPY");
    expect(updated?.space.rateUsed).toBe("0.0064");
    expect(updated?.space.rateAsOf).toBe("2026-06-29T00:00:00.000Z");
    expect(updated?.space.amountUsd).toBe(640);
  });

  it("renews a space from its current expiry and refreshes the USD snapshot", async () => {
    upsertRates(ctx.db, [
      {
        currencyCode: "USD",
        rateToUsd: "1",
        fetchedAt: "2026-06-28T00:00:00.000Z",
      },
    ]);
    await createSpace(
      validInput({
        amountMinor: 2000,
        openingDate: "2026-06-02",
        currentPeriodStartDate: "2026-06-02",
      }),
    );
    const row = ctx.db.select().from(space).get()!;
    upsertRates(ctx.db, [
      {
        currencyCode: "USD",
        rateToUsd: "1.25",
        fetchedAt: "2026-07-02T00:00:00.000Z",
      },
    ]);

    const res = await renewSpace(row.id);
    const renewed = getSpaceDetail(ctx.db, row.id);

    expect(res.ok).toBe(true);
    expect(renewed?.space.openingDate).toBe("2026-06-02");
    expect(renewed?.space.currentPeriodStartDate).toBe("2026-07-02");
    expect(renewed?.space.expiryDate).toBe("2026-08-02");
    expect(renewed?.space.rateUsed).toBe("1.25");
    expect(renewed?.space.rateAsOf).toBe("2026-07-02T00:00:00.000Z");
    expect(renewed?.space.amountUsd).toBe(2500);
  });

  it("rejects inactive payment channels and unseeded currencies", async () => {
    upsertRates(ctx.db, [
      {
        currencyCode: "USD",
        rateToUsd: "1",
        fetchedAt: "2026-06-28T00:00:00.000Z",
      },
    ]);

    setChannelActive(ctx.db, channelId, false);
    const inactiveChannel = await createSpace(validInput());
    const unseededCurrency = await createSpace(
      validInput({ paymentChannelId: insertChannel(ctx.db, "Active").id, currencyCode: "ZZZ" }),
    );

    expect(inactiveChannel.ok).toBe(false);
    expect(unseededCurrency.ok).toBe(false);
    expect(ctx.db.select().from(space).all()).toHaveLength(0);
  });

  it("rejects delete name mismatch and leaves related rows intact", async () => {
    upsertRates(ctx.db, [
      {
        currencyCode: "USD",
        rateToUsd: "1",
        fetchedAt: "2026-06-28T00:00:00.000Z",
      },
    ]);
    await createSpace(validInput({ name: "Protected Team" }));
    const row = ctx.db.select().from(space).get()!;
    insertChildAccount(ctx.db, {
      spaceId: row.id,
      seatType: "codex",
      email: "child@example.com",
      label: "Seat",
      joinedDate: "2026-02-01",
      monthlyAmountMinor: 2000,
      monthlyCurrencyCode: "USD",
      monthlyRateUsed: "1",
      monthlyRateAsOf: "2026-06-28T00:00:00.000Z",
      monthlyRateSource: "frankfurter",
      monthlyAmountUsd: 2000,
      monthlyPaymentDay: 12,
    });

    const res = await deleteSpace({
      id: row.id,
      confirmationName: "Wrong Team",
    });

    expect(res).toEqual({ ok: false, error: "空间名称不匹配，未删除。" });
    expect(ctx.db.select().from(space).all()).toHaveLength(1);
    expect(ctx.db.select().from(motherAccount).all()).toHaveLength(1);
    expect(ctx.db.select().from(childAccount).all()).toHaveLength(1);
  });

  it("deletes space by exact name and cascades mother and child accounts", async () => {
    upsertRates(ctx.db, [
      {
        currencyCode: "USD",
        rateToUsd: "1",
        fetchedAt: "2026-06-28T00:00:00.000Z",
      },
    ]);
    await createSpace(validInput({ name: "Delete Team" }));
    const row = ctx.db.select().from(space).get()!;
    insertChildAccount(ctx.db, {
      spaceId: row.id,
      seatType: "chatgpt",
      email: "child@example.com",
      label: "Seat",
      joinedDate: "2026-02-01",
      monthlyAmountMinor: 2000,
      monthlyCurrencyCode: "USD",
      monthlyRateUsed: "1",
      monthlyRateAsOf: "2026-06-28T00:00:00.000Z",
      monthlyRateSource: "frankfurter",
      monthlyAmountUsd: 2000,
      monthlyPaymentDay: 12,
    });

    const res = await deleteSpace({
      id: row.id,
      confirmationName: "Delete Team",
    });

    expect(res.ok).toBe(true);
    expect(ctx.db.select().from(space).all()).toHaveLength(0);
    expect(ctx.db.select().from(motherAccount).all()).toHaveLength(0);
    expect(ctx.db.select().from(childAccount).all()).toHaveLength(0);
  });
});
