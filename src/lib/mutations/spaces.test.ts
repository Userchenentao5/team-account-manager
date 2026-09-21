import { afterEach, describe, expect, it, vi } from "vitest";
import { insertChannel } from "@/db/channels";
import { insertSpaceWithMother } from "@/db/spaces";
import { seedCurrencies } from "@/db/seed";
import { space } from "@/db/schema";
import {
  createSpace,
  deleteSpace,
  type SpaceMutationContext,
} from "@/lib/mutations/spaces";
import { createTestDb } from "@/test/db-harness";

describe("space mutation workflow", () => {
  const contexts: Array<ReturnType<typeof createTestDb>> = [];

  afterEach(() => {
    for (const context of contexts) context.sqlite.close();
    contexts.length = 0;
  });

  it("keeps reference validation and workflow errors behind the seam", async () => {
    const context = createTestDb();
    contexts.push(context);
    seedCurrencies(context.db);
    const revalidate = vi.fn();
    const mutationContext: SpaceMutationContext = {
      db: context.db,
      revalidate,
    };

    const result = await createSpace(mutationContext, {
      name: "Team Pro",
      country: "US",
      paymentChannelId: 999,
      currencyCode: "USD",
      amountMinor: 1999,
      seatCapacity: 5,
      openingDate: "2026-01-31",
      currentPeriodStartDate: "2026-01-31",
      periodUnit: "month",
      periodCount: 1,
      motherEmail: "owner@example.com",
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "invalid-payment-channel" },
    });
    expect(revalidate).not.toHaveBeenCalled();
    expect(context.db.select().from(space).all()).toHaveLength(0);
  });

  it("owns persistence completion and cache invalidation", () => {
    const context = createTestDb();
    contexts.push(context);
    seedCurrencies(context.db);
    const channel = insertChannel(context.db, "Visa");
    const row = insertSpaceWithMother(
      context.db,
      {
        name: "Delete Team",
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

    const result = deleteSpace(
      { db: context.db, revalidate },
      row.id,
      "Delete Team",
    );

    expect(result).toEqual({ ok: true });
    expect(context.db.select().from(space).all()).toHaveLength(0);
    expect(revalidate).toHaveBeenCalledWith(row.id);
  });
});
