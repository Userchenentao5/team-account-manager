import { afterEach, describe, expect, it, vi } from "vitest";
import { insertChannel } from "@/db/channels";
import {
  deleteChildAccount,
  updateMotherSeat,
  type ChildAccountMutationContext,
} from "@/lib/mutations/child-accounts";
import {
  getChildAccount,
  insertChildAccount,
} from "@/db/childAccounts";
import { seedCurrencies } from "@/db/seed";
import { childAccount, motherAccount } from "@/db/schema";
import { insertSpaceWithMother } from "@/db/spaces";
import { createTestDb } from "@/test/db-harness";

describe("child-account mutation workflow", () => {
  const contexts: Array<ReturnType<typeof createTestDb>> = [];

  afterEach(() => {
    for (const context of contexts) context.sqlite.close();
    contexts.length = 0;
  });

  function setup() {
    const context = createTestDb();
    contexts.push(context);
    seedCurrencies(context.db);
    const channel = insertChannel(context.db, "Visa");
    const space = insertSpaceWithMother(
      context.db,
      {
        name: "Team Pro",
        country: "US",
        paymentChannelId: channel.id,
        currencyCode: "USD",
        amountMinor: 1999,
        seatCapacity: 5,
        periodUnit: "month",
        periodCount: 1,
        rateUsed: "1",
        rateAsOf: "2026-06-28T00:00:00.000Z",
        rateSource: "frankfurter",
        amountUsd: 1999,
        openingDate: "2026-01-31",
        currentPeriodStartDate: "2026-01-31",
        expiryDate: "2026-02-28",
      },
      "owner@example.com",
    );
    const revalidate = vi.fn();
    const mutationContext: ChildAccountMutationContext = {
      db: context.db,
      revalidate,
    };
    return { context, mutationContext, space };
  }

  it("owns mother-seat persistence and invalidation", () => {
    const { context, mutationContext, space } = setup();

    const result = updateMotherSeat(mutationContext, space.id, {
      seatType: "codex",
      canChangeSeatType: false,
    });

    expect(result).toEqual({ ok: true });
    expect(context.db.select().from(motherAccount).get()).toMatchObject({
      spaceId: space.id,
      seatType: "chatgpt",
      canChangeSeatType: false,
    });
    expect(mutationContext.revalidate).toHaveBeenCalledWith(space.id);
  });

  it("deletes one child account through the same workflow seam", () => {
    const { context, mutationContext, space } = setup();
    const child = insertChildAccount(context.db, {
      spaceId: space.id,
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

    const result = deleteChildAccount(mutationContext, child.id);

    expect(result).toEqual({ ok: true });
    expect(getChildAccount(context.db, child.id)).toBeUndefined();
    expect(context.db.select().from(childAccount).all()).toHaveLength(0);
    expect(mutationContext.revalidate).toHaveBeenCalledWith(space.id);
  });
});
