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

  it("returns each pre-expiry day in the window and deduplicates per day", () => {
    const dueOnThreshold = makeSpace("Threshold Day", "2026-07-14");
    const insideWindow = makeSpace("Inside Window", "2026-07-10");
    makeSpace("Due Today", "2026-07-07");

    expect(
      listDueSpaceExpiryReminders(ctx.db, 7, new Date(2026, 6, 7)).map(
        (row) => row.id,
      ),
    ).toEqual([insideWindow.id, dueOnThreshold.id]);

    for (const candidate of [insideWindow, dueOnThreshold]) {
      recordSpaceExpiryReminderSent(ctx.db, {
        spaceId: candidate.id,
        expiryDate:
          candidate.id === insideWindow.id ? "2026-07-10" : "2026-07-14",
        thresholdDays: 7,
        recipientEmail: "billing@example.com",
        sentAt: new Date(2026, 6, 7, 9, 0),
      });
    }

    expect(
      listDueSpaceExpiryReminders(ctx.db, 7, new Date(2026, 6, 7)),
    ).toEqual([]);
    expect(
      listDueSpaceExpiryReminders(ctx.db, 7, new Date(2026, 6, 8)).map(
        (row) => row.id,
      ),
    ).toEqual([insideWindow.id, dueOnThreshold.id]);
  });

  it("uses each space's expiry time down to seconds and catches a later minute tick", () => {
    const morning = makeSpace("Morning", "2026-07-10T09:30:45");
    const evening = makeSpace("Evening", "2026-07-10T18:20:15");
    makeSpace("Due Today", "2026-07-07T09:30:45");
    makeSpace("Expired", "2026-07-06T09:30:45");
    makeSpace("Outside Window", "2026-07-20T09:30:45");
    makeSpace("No Expiry", null);

    const dueIds = (now: Date) =>
      listDueSpaceExpiryReminders(ctx.db, 7, now).map((row) => row.id);

    expect(dueIds(new Date(2026, 6, 7, 9, 30, 44))).toEqual([]);
    expect(dueIds(new Date(2026, 6, 7, 9, 30, 45))).toEqual([morning.id]);
    expect(dueIds(new Date(2026, 6, 7, 9, 31, 12))).toEqual([morning.id]);

    recordSpaceExpiryReminderSent(ctx.db, {
      spaceId: morning.id,
      expiryDate: morning.expiryDate!,
      thresholdDays: 7,
      recipientEmail: "billing@example.com",
      sentAt: new Date(2026, 6, 7, 9, 31, 12),
    });
    expect(dueIds(new Date(2026, 6, 7, 18, 20, 14))).toEqual([]);
    expect(dueIds(new Date(2026, 6, 7, 18, 20, 15))).toEqual([evening.id]);
    expect(dueIds(new Date(2026, 6, 8, 0, 0, 0))).toEqual([]);
    expect(dueIds(new Date(2026, 6, 8, 18, 21, 12))).toEqual([
      morning.id,
      evening.id,
    ]);
    expect(listDueSpaceExpiryReminders(ctx.db, 0, new Date(2026, 6, 7, 23))).toEqual([]);
  });
});
