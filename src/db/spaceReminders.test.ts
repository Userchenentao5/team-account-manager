import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertChannel } from "@/db/channels";
import { seedCurrencies } from "@/db/seed";
import { insertSpaceWithMother } from "@/db/spaces";
import {
  listDueSpaceExpiryReminders,
  listSpaceExpiryReminderCandidates,
  recordSpaceExpiryReminderSent,
} from "@/db/spaceReminders";
import { createTestDb } from "@/test/db-harness";

describe("space expiry reminder queries", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
    seedCurrencies(ctx.db);
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  function makeSpace(name: string, expiryDate: string | null) {
    const channel = insertChannel(ctx.db, "Visa");
    return insertSpaceWithMother(
      ctx.db,
      {
        name,
        country: "US",
        paymentChannelId: channel.id,
        currencyCode: "USD",
        amountMinor: 2000,
        periodUnit: "month",
        periodCount: 1,
        rateUsed: "1",
        rateAsOf: "2026-06-28T00:00:00.000Z",
        rateSource: "frankfurter",
        amountUsd: 2000,
        openingDate: "2026-01-01",
        currentPeriodStartDate: "2026-07-01",
        expiryDate,
      },
      `${name}@example.com`,
    );
  }

  it("returns only non-expired spaces inside the configured threshold", () => {
    makeSpace("Expired", "2026-07-06");
    const dueToday = makeSpace("Due Today", "2026-07-07");
    const soon = makeSpace("Soon", "2026-07-10");
    makeSpace("Later", "2026-07-20");
    makeSpace("No Expiry", null);

    const rows = listSpaceExpiryReminderCandidates(
      ctx.db,
      7,
      new Date(2026, 6, 7),
    );

    expect(rows.map((row) => row.id)).toEqual([dueToday.id, soon.id]);
    expect(rows.map((row) => row.daysUntilExpiry)).toEqual([0, 3]);
    expect(rows[0]).toMatchObject({
      name: "Due Today",
      paymentChannelName: "Visa",
      amountUsdMinor: 2000,
    });
  });

  it("returns threshold-day reminders and excludes already sent spaces", () => {
    const dueOnThreshold = makeSpace("Threshold Day", "2026-07-14");
    makeSpace("Inside Window", "2026-07-10");

    expect(
      listDueSpaceExpiryReminders(ctx.db, 7, new Date(2026, 6, 7)).map(
        (row) => row.id,
      ),
    ).toEqual([dueOnThreshold.id]);

    recordSpaceExpiryReminderSent(ctx.db, {
      spaceId: dueOnThreshold.id,
      expiryDate: "2026-07-14",
      thresholdDays: 7,
      recipientEmail: "billing@example.com",
      sentAt: new Date(2026, 6, 7, 9, 0),
    });

    expect(
      listDueSpaceExpiryReminders(ctx.db, 7, new Date(2026, 6, 7)),
    ).toEqual([]);
  });
});
