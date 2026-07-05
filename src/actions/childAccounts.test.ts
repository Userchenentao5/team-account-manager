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

import {
  createChildAccount,
  deleteChildAccount,
  renewChildAccount,
  updateChildAccount,
  updateMotherSeat,
} from "@/actions/childAccounts";
import { insertChannel } from "@/db/channels";
import {
  getChildAccount,
  insertChildAccount,
  updateChildAccount as updateChildAccountRow,
} from "@/db/childAccounts";
import { upsertRates } from "@/db/fxRates";
import { seedCurrencies } from "@/db/seed";
import { childAccount, motherAccount, space } from "@/db/schema";
import { insertSpaceWithMother } from "@/db/spaces";
import { createTestDb } from "@/test/db-harness";

describe("child account server actions (ACCT-02 / ACCT-03)", () => {
  let ctx: ReturnType<typeof createTestDb>;
  let spaceId: number;

  beforeEach(() => {
    ctx = createTestDb();
    dbHolder.current = ctx.db;
    seedCurrencies(ctx.db);
    const channelId = insertChannel(ctx.db, "Visa").id;
    const row = insertSpaceWithMother(
      ctx.db,
      {
        name: "Team Pro",
        country: "US",
        paymentChannelId: channelId,
        currencyCode: "USD",
        amountMinor: 1999,
        periodUnit: "month",
        periodCount: 1,
        rateUsed: "1",
        rateAsOf: "2026-06-28T00:00:00.000Z",
        rateSource: "frankfurter",
        amountUsd: 1999,
        openingDate: "2026-01-31",
        expiryDate: "2026-02-28",
      },
      "owner@example.com",
    );
    spaceId = row.id;
    fxMock.ensureFreshRates.mockResolvedValue({
      stale: false,
      fetchedAt: "2026-06-28T00:00:00.000Z",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    ctx.sqlite.close();
  });

  const input = {
    seatType: "codex" as "codex" | "chatgpt",
    email: "child@example.com",
    contact: "wx-child",
    label: "Dev seat",
    joinedDate: "2026-02-01",
    monthlyAmountMinor: 2000,
    monthlyCurrencyCode: "USD",
    monthlyPaymentDay: 12,
  };

  function validInput(overrides: Partial<typeof input> = {}) {
    return { ...input, ...overrides };
  }

  function seedUsdRate() {
    upsertRates(ctx.db, [
      {
        currencyCode: "USD",
        rateToUsd: "1",
        fetchedAt: "2026-06-28T00:00:00.000Z",
      },
    ]);
  }

  function seedChild() {
    return insertChildAccount(ctx.db, {
      spaceId,
      seatType: "codex",
      email: "child@example.com",
      contact: "wx-child",
      label: "Dev seat",
      joinedDate: "2026-02-01",
      monthlyAmountMinor: 2000,
      monthlyCurrencyCode: "USD",
      monthlyRateUsed: "1",
      monthlyRateAsOf: "2026-06-28T00:00:00.000Z",
      monthlyRateSource: "frankfurter",
      monthlyAmountUsd: 2000,
      monthlyPaymentDay: 12,
    });
  }

  it("creates a child account with a frozen monthly USD snapshot", async () => {
    seedUsdRate();

    const res = await createChildAccount(spaceId, validInput());
    const row = ctx.db.select().from(childAccount).get();

    expect(res.ok).toBe(true);
    expect(row).toMatchObject({
      spaceId,
      seatType: "codex",
      email: "child@example.com",
      label: "Dev seat",
      monthlyRateUsed: "1",
      monthlyRateAsOf: "2026-06-28T00:00:00.000Z",
      monthlyRateSource: "frankfurter",
      monthlyAmountUsd: 2000,
      monthlyPaymentDay: 12,
      nextPaymentDate: "2026-02-12",
    });
  });

  it("treats a child account joined on its payment day as already paid", async () => {
    seedUsdRate();

    const res = await createChildAccount(
      spaceId,
      validInput({ joinedDate: "2026-02-12", monthlyPaymentDay: 12 }),
    );
    const row = ctx.db.select().from(childAccount).get();

    expect(res.ok).toBe(true);
    expect(row?.nextPaymentDate).toBe("2026-03-12");
  });

  it("creates a zero-price child account without requiring an FX rate", async () => {
    const res = await createChildAccount(
      spaceId,
      validInput({ contact: "", monthlyAmountMinor: 0 }),
    );
    const row = ctx.db.select().from(childAccount).get();

    expect(res.ok).toBe(true);
    expect(fxMock.ensureFreshRates).not.toHaveBeenCalled();
    expect(row).toMatchObject({
      monthlyAmountMinor: 0,
      monthlyAmountUsd: 0,
      monthlyRateUsed: "1",
      monthlyRateSource: "self-use",
    });
  });

  it("requires contact for paid child accounts", async () => {
    seedUsdRate();

    const res = await createChildAccount(
      spaceId,
      validInput({ contact: "", monthlyAmountMinor: 2000 }),
    );

    expect(res).toEqual({
      ok: false,
      error: "非自用子账号请输入联系方式。",
    });
    expect(fxMock.ensureFreshRates).toHaveBeenCalledOnce();
    expect(ctx.db.select().from(childAccount).all()).toHaveLength(0);
  });

  it("blocks no-rate child create and writes no row", async () => {
    const res = await createChildAccount(
      spaceId,
      validInput({ monthlyCurrencyCode: "EUR" }),
    );

    expect(res.ok).toBe(false);
    expect(ctx.db.select().from(childAccount).all()).toHaveLength(0);
  });

  it("preserves the frozen monthly USD snapshot on non-price edits", async () => {
    seedUsdRate();
    const row = seedChild();
    fxMock.ensureFreshRates.mockClear();

    const res = await updateChildAccount(
      row.id,
      validInput({
        email: "renamed@example.com",
        contact: "tg-renamed",
        label: "Renamed",
        seatType: "chatgpt",
        monthlyPaymentDay: 21,
      }),
    );
    const updated = getChildAccount(ctx.db, row.id);

    expect(res.ok).toBe(true);
    expect(fxMock.ensureFreshRates).not.toHaveBeenCalled();
    expect(updated).toMatchObject({
      email: "renamed@example.com",
      contact: "tg-renamed",
      label: "Renamed",
      seatType: "chatgpt",
      monthlyPaymentDay: 21,
      monthlyRateUsed: "1",
      monthlyRateAsOf: "2026-06-28T00:00:00.000Z",
      monthlyAmountUsd: 2000,
    });
  });

  it("refreezes monthly USD snapshot when amount or currency changes", async () => {
    seedUsdRate();
    upsertRates(ctx.db, [
      {
        currencyCode: "JPY",
        rateToUsd: "0.0064",
        fetchedAt: "2026-06-29T00:00:00.000Z",
      },
    ]);
    const row = seedChild();

    const res = await updateChildAccount(
      row.id,
      validInput({
        monthlyCurrencyCode: "JPY",
        monthlyAmountMinor: 1000,
      }),
    );
    const updated = getChildAccount(ctx.db, row.id);

    expect(res.ok).toBe(true);
    expect(updated?.monthlyCurrencyCode).toBe("JPY");
    expect(updated?.monthlyRateUsed).toBe("0.0064");
    expect(updated?.monthlyRateAsOf).toBe("2026-06-29T00:00:00.000Z");
    expect(updated?.monthlyAmountUsd).toBe(640);
  });

  it("renews a child account into the next billing cycle", async () => {
    const row = seedChild();
    updateChildAccountRow(
      ctx.db,
      row.id,
      { nextPaymentDate: "2026-07-12" },
    );
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 5));

    const res = await renewChildAccount(row.id);
    const updated = getChildAccount(ctx.db, row.id);

    expect(res.ok).toBe(true);
    expect(updated?.nextPaymentDate).toBe("2026-08-12");
    vi.useRealTimers();
  });

  it("deletes only the requested child account", async () => {
    const first = seedChild();
    const second = insertChildAccount(ctx.db, {
      spaceId,
      seatType: "chatgpt",
      email: "second@example.com",
      label: "Second",
      joinedDate: "2026-02-02",
      monthlyAmountMinor: 3000,
      monthlyCurrencyCode: "USD",
      monthlyRateUsed: "1",
      monthlyRateAsOf: "2026-06-28T00:00:00.000Z",
      monthlyRateSource: "frankfurter",
      monthlyAmountUsd: 3000,
      monthlyPaymentDay: 20,
    });

    const res = await deleteChildAccount(first.id);

    expect(res.ok).toBe(true);
    expect(getChildAccount(ctx.db, first.id)).toBeUndefined();
    expect(getChildAccount(ctx.db, second.id)?.email).toBe("second@example.com");
    expect(ctx.db.select().from(space).all()).toHaveLength(1);
  });

  it("updates mother seat metadata only", async () => {
    const res = await updateMotherSeat(spaceId, {
      seatType: "chatgpt",
      canChangeSeatType: false,
    });
    const mother = ctx.db.select().from(motherAccount).get();

    expect(res.ok).toBe(true);
    expect(mother).toMatchObject({
      seatType: "chatgpt",
      canChangeSeatType: false,
    });
  });

  it("rejects invalid IDs and ignores credential-looking mass-assignment keys", async () => {
    seedUsdRate();

    const invalid = await updateChildAccount(-1, validInput());
    const res = await createChildAccount(spaceId, {
      ...validInput(),
      password: "secret",
      token: "secret",
      apiKey: "secret",
      recoveryCode: "secret",
      cookie: "secret",
      credential: "secret",
      canChangeSeatType: true,
    });
    const row = ctx.db.select().from(childAccount).get();

    expect(invalid.ok).toBe(false);
    expect(res.ok).toBe(true);
    expect(row).not.toHaveProperty("password");
    expect(row).not.toHaveProperty("token");
    expect(row).not.toHaveProperty("apiKey");
    expect(row).not.toHaveProperty("recoveryCode");
    expect(row).not.toHaveProperty("cookie");
    expect(row).not.toHaveProperty("credential");
    expect(row).not.toHaveProperty("canChangeSeatType");
  });
});
