import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insertChannel } from "@/db/channels";
import { seedCurrencies } from "@/db/seed";
import {
  setSpaceEmailReminderSettings,
  setStatusThresholds,
} from "@/db/settings";
import { insertSpaceWithMother } from "@/db/spaces";
import { runSpaceExpiryReminderJob } from "@/lib/reminders/space-expiry-reminder-job";
import { createTestDb } from "@/test/db-harness";

describe("space expiry reminder job", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
    seedCurrencies(ctx.db);
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  function makeSpace(name: string, expiryDate: string) {
    const channel = insertChannel(ctx.db, "Visa");
    return insertSpaceWithMother(
      ctx.db,
      {
        name,
        country: "US",
        paymentChannelId: channel.id,
        currencyCode: "USD",
        amountMinor: 2599,
        periodUnit: "month",
        periodCount: 1,
        rateUsed: "1",
        rateAsOf: "2026-06-28T00:00:00.000Z",
        rateSource: "frankfurter",
        amountUsd: 2599,
        openingDate: "2026-01-01",
        currentPeriodStartDate: "2026-07-01",
        expiryDate,
      },
      `${name}@example.com`,
    );
  }

  it("sends once at the configured time when a space reaches the threshold day", async () => {
    setStatusThresholds(ctx.db, {
      spaceSoonDays: 7,
      childAccountSoonDays: 7,
    });
    setSpaceEmailReminderSettings(ctx.db, {
      enabled: true,
      recipientEmail: "billing@example.com",
      sendTime: "09:30",
      smtpUrl: "smtp://user:pass@smtp.example.com:587",
      smtpFrom: "sender@example.com",
      templateSubject: "{spaceName} 自动提醒",
      templateBody:
        "{spaceName} 还有 {daysUntilExpiry} 天到期，{paymentChannelName} 支付 {amountUsd} USD。",
    });
    makeSpace("Threshold Team", "2026-07-14");
    makeSpace("Not Yet", "2026-07-15");
    const sendEmail = vi.fn().mockResolvedValue(undefined);

    await expect(
      runSpaceExpiryReminderJob(
        ctx.db,
        new Date(2026, 6, 7, 9, 29),
        sendEmail,
      ),
    ).resolves.toMatchObject({
      checked: false,
      sent: 0,
      reason: "not-scheduled-time",
    });

    await expect(
      runSpaceExpiryReminderJob(
        ctx.db,
        new Date(2026, 6, 7, 9, 30),
        sendEmail,
      ),
    ).resolves.toMatchObject({ checked: true, sent: 1 });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith({
      smtpUrl: "smtp://user:pass@smtp.example.com:587",
      from: "sender@example.com",
      to: "billing@example.com",
      subject: "Threshold Team 自动提醒",
      text: "Threshold Team 还有 7 天到期，Visa 支付 25.99 USD。",
      html: "<p>Threshold Team 还有 7 天到期，Visa 支付 25.99 USD。</p>",
    });

    await expect(
      runSpaceExpiryReminderJob(
        ctx.db,
        new Date(2026, 6, 7, 9, 30),
        sendEmail,
      ),
    ).resolves.toMatchObject({ checked: true, sent: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
