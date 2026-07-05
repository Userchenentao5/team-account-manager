import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getCurrencyMinorUnit } from "@/db/currencies";
import { getRate, upsertRates } from "@/db/fxRates";
import { insertChannel } from "@/db/channels";
import { seedCurrencies } from "@/db/seed";
import { childAccount, motherAccount, space } from "@/db/schema";
import {
  deleteSpaceCascade,
  getSpaceDetail,
  insertSpaceWithMother,
  listSpaceDetails,
  listSpaces,
} from "@/db/spaces";
import { createTestDb } from "@/test/db-harness";

describe("space queries (SPACE-02 / SPACE-03 / ACCT-01)", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
    seedCurrencies(ctx.db);
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  function makeSpace(
    overrides: Partial<typeof space.$inferInsert> & { name: string },
    motherEmail = `${overrides.name}@example.com`,
  ) {
    const channelId =
      overrides.paymentChannelId ?? insertChannel(ctx.db, "Visa").id;

    return insertSpaceWithMother(
      ctx.db,
      {
        name: overrides.name,
        country: overrides.country ?? "US",
        paymentChannelId: channelId,
        currencyCode: overrides.currencyCode ?? "USD",
        amountMinor: overrides.amountMinor ?? 1000,
        periodUnit: overrides.periodUnit ?? "month",
        periodCount: overrides.periodCount ?? 1,
        rateUsed: overrides.rateUsed ?? "1",
        rateAsOf: overrides.rateAsOf ?? "2026-06-28T00:00:00.000Z",
        rateSource: overrides.rateSource ?? "frankfurter",
        amountUsd: overrides.amountUsd ?? 1000,
        openingDate: overrides.openingDate ?? "2026-01-01",
        currentPeriodStartDate:
          overrides.currentPeriodStartDate ?? overrides.openingDate ?? "2026-01-01",
        expiryDate: overrides.expiryDate ?? "2026-02-01",
      },
      motherEmail,
    );
  }

  it("lists spaces by expiry date ascending and applies country/channel filters", () => {
    const visa = insertChannel(ctx.db, "Visa");
    const alipay = insertChannel(ctx.db, "Alipay");

    const later = makeSpace({
      name: "Later US Visa",
      country: "US",
      paymentChannelId: visa.id,
      expiryDate: "2026-09-01",
    });
    const sooner = makeSpace({
      name: "Sooner CN Alipay",
      country: "CN",
      paymentChannelId: alipay.id,
      expiryDate: "2026-07-01",
    });
    const middle = makeSpace({
      name: "Middle US Alipay",
      country: "US",
      paymentChannelId: alipay.id,
      expiryDate: "2026-08-01",
    });

    expect(listSpaces(ctx.db).map((row) => row.id)).toEqual([
      sooner.id,
      middle.id,
      later.id,
    ]);
    expect(listSpaces(ctx.db, { country: "US" }).map((row) => row.id)).toEqual([
      middle.id,
      later.id,
    ]);
    expect(
      listSpaces(ctx.db, { channelId: alipay.id }).map((row) => row.id),
    ).toEqual([sooner.id, middle.id]);
    expect(
      listSpaces(ctx.db, { country: "US", channelId: alipay.id }).map(
        (row) => row.id,
      ),
    ).toEqual([middle.id]);
  });

  it("inserts a space and mother account atomically and returns joined detail", () => {
    const channel = insertChannel(ctx.db, "Visa");
    const row = makeSpace(
      {
        name: "Team Pro",
        country: "US",
        paymentChannelId: channel.id,
        currencyCode: "USD",
      },
      "owner@example.com",
    );

    const detail = getSpaceDetail(ctx.db, row.id);

    expect(detail?.space.id).toBe(row.id);
    expect(detail?.motherAccount.email).toBe("owner@example.com");
    expect(detail?.paymentChannel.name).toBe("Visa");
    expect(detail?.currency.code).toBe("USD");
  });

  it("returns child account counts for joined space lists", () => {
    const first = makeSpace({
      name: "Counted Team",
      expiryDate: "2026-01-01",
    });
    const second = makeSpace({
      name: "Empty Team",
      expiryDate: "2026-02-01",
    });
    ctx.db
      .insert(childAccount)
      .values({
        spaceId: first.id,
        seatType: "codex",
        email: "first-child@example.com",
        label: "Seat",
        joinedDate: "2026-02-01",
        monthlyAmountMinor: 2000,
        monthlyCurrencyCode: "USD",
        monthlyRateUsed: "1",
        monthlyRateAsOf: "2026-06-28T00:00:00.000Z",
        monthlyRateSource: "frankfurter",
        monthlyAmountUsd: 2000,
        monthlyPaymentDay: 12,
      })
      .run();
    ctx.db
      .insert(childAccount)
      .values({
        spaceId: first.id,
        seatType: "chatgpt",
        email: "second-child@example.com",
        label: "Seat",
        joinedDate: "2026-02-01",
        monthlyAmountMinor: 2000,
        monthlyCurrencyCode: "USD",
        monthlyRateUsed: "1",
        monthlyRateAsOf: "2026-06-28T00:00:00.000Z",
        monthlyRateSource: "frankfurter",
        monthlyAmountUsd: 2000,
        monthlyPaymentDay: 12,
      })
      .run();

    const rows = listSpaceDetails(ctx.db);

    expect(rows.find((row) => row.space.id === first.id)?.childCount).toBe(2);
    expect(rows.find((row) => row.space.id === second.id)?.childCount).toBe(0);
  });

  it("rejects a second mother account for the same space_id", () => {
    const row = makeSpace({ name: "Unique Mother" });

    expect(() =>
      ctx.db
        .insert(motherAccount)
        .values({ spaceId: row.id, email: "second@example.com" })
        .run(),
    ).toThrow();
  });

  it("cascades mother account deletion when the owning space is deleted", () => {
    const row = makeSpace({ name: "Cascade Mother" });

    ctx.db.delete(space).where(eq(space.id, row.id)).run();

    const mothers = ctx.db
      .select()
      .from(motherAccount)
      .where(eq(motherAccount.spaceId, row.id))
      .all();
    expect(mothers).toHaveLength(0);
  });

  it("rejects cascade delete name mismatch and leaves related rows intact", () => {
    const row = makeSpace({ name: "Typed Delete" });
    ctx.db.insert(childAccount).values({
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
    }).run();

    const result = deleteSpaceCascade(ctx.db, row.id, "Wrong Name");

    expect(result).toEqual({ ok: false, reason: "name_mismatch" });
    expect(ctx.db.select().from(space).where(eq(space.id, row.id)).all()).toHaveLength(1);
    expect(
      ctx.db.select().from(motherAccount).where(eq(motherAccount.spaceId, row.id)).all(),
    ).toHaveLength(1);
    expect(
      ctx.db.select().from(childAccount).where(eq(childAccount.spaceId, row.id)).all(),
    ).toHaveLength(1);
  });

  it("deletes a space by exact name and cascades mother and child rows", () => {
    const row = makeSpace({ name: "Exact Delete" });
    ctx.db.insert(childAccount).values({
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
    }).run();

    const result = deleteSpaceCascade(ctx.db, row.id, "Exact Delete");

    expect(result).toEqual({ ok: true });
    expect(ctx.db.select().from(space).where(eq(space.id, row.id)).all()).toHaveLength(0);
    expect(
      ctx.db.select().from(motherAccount).where(eq(motherAccount.spaceId, row.id)).all(),
    ).toHaveLength(0);
    expect(
      ctx.db.select().from(childAccount).where(eq(childAccount.spaceId, row.id)).all(),
    ).toHaveLength(0);
  });

  it("reads currency minor units and cached rates for the freeze pipeline", () => {
    upsertRates(ctx.db, [
      {
        currencyCode: "JPY",
        rateToUsd: "0.0064",
        fetchedAt: "2026-06-28T00:00:00.000Z",
      },
    ]);

    expect(getCurrencyMinorUnit(ctx.db, "JPY")).toBe(0);
    expect(getRate(ctx.db, "JPY")?.rateToUsd).toBe("0.0064");
    expect(getRate(ctx.db, "EUR")).toBeUndefined();
  });
});
