import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertChannel } from "@/db/channels";
import { insertChildAccount } from "@/db/childAccounts";
import { upsertRates } from "@/db/fxRates";
import { seedCurrencies } from "@/db/seed";
import { insertSpaceWithMother } from "@/db/spaces";
import { getSpaceOverview, listSpaceOverview } from "@/db/space-overview";
import { createTestDb } from "@/test/db-harness";

describe("space read model", () => {
  let ctx: ReturnType<typeof createTestDb>;
  let spaceId: number;

  beforeEach(() => {
    ctx = createTestDb();
    seedCurrencies(ctx.db);
    const channel = insertChannel(ctx.db, "Visa");
    const space = insertSpaceWithMother(
      ctx.db,
      {
        name: "Team Pro",
        country: "US",
        paymentChannelId: channel.id,
        currencyCode: "USD",
        amountMinor: 1999,
        periodUnit: "month",
        periodCount: 1,
        rateUsed: "1",
        rateAsOf: "2026-06-28T00:00:00.000Z",
        rateSource: "frankfurter",
        amountUsd: 1999,
        openingDate: "2026-01-01",
        expiryDate: "2026-02-01",
        seatCapacity: 3,
      },
      "owner@example.com",
    );
    spaceId = space.id;
    insertChildAccount(ctx.db, {
      spaceId,
      seatType: "chatgpt",
      email: "child@example.com",
      contact: "contact",
      label: "Child",
      joinedDate: "2026-01-01",
      monthlyAmountMinor: 1000,
      monthlyCurrencyCode: "USD",
      monthlyRateUsed: "1",
      monthlyRateAsOf: "2026-06-28T00:00:00.000Z",
      monthlyRateSource: "frankfurter",
      monthlyAmountUsd: 1000,
      billingPeriodUnit: "month",
      billingPeriodCount: 1,
      monthlyPaymentDay: 1,
      nextPaymentDate: "2026-02-01",
    });
    upsertRates(ctx.db, [
      {
        currencyCode: "CNY",
        rateToUsd: "0.14",
        fetchedAt: "2026-06-28T00:00:00.000Z",
      },
    ]);
  });

  afterEach(() => ctx.sqlite.close());

  it("projects account seat facts and CNY reference for detail", () => {
    const overview = getSpaceOverview(ctx.db, spaceId);

    expect(overview?.childAccounts).toHaveLength(1);
    expect(overview?.seatAvailability).toEqual({
      occupiedSeatCount: 1,
      availableSeatCount: 2,
    });
    expect(overview?.cnyReference).toBe("￥142.79 CNY");
  });

  it("keeps list rows on the same CNY projection", () => {
    expect(listSpaceOverview(ctx.db)[0]?.cnyReference).toBe("￥142.79 CNY");
  });
});
