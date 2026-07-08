import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insertChannel } from "@/db/channels";
import { insertChildAccount } from "@/db/childAccounts";
import { upsertChildAccountReminderSubscription } from "@/db/childAccountReminders";
import { seedCurrencies } from "@/db/seed";
import { setChildAccountEmailReminderSettings } from "@/db/settings";
import { insertSpaceWithMother } from "@/db/spaces";
import { runChildAccountPaymentReminderJob } from "@/lib/reminders/child-account-payment-reminder-job";
import { createTestDb } from "@/test/db-harness";

describe("child account payment reminder job", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
    seedCurrencies(ctx.db);
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  function makeChildAccount(nextPaymentDate: string) {
    const channel = insertChannel(ctx.db, "Visa");
    const space = insertSpaceWithMother(
      ctx.db,
      {
        name: "US Team",
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
        expiryDate: "2026-08-01",
      },
      "owner-seat@example.com",
    );

    return insertChildAccount(ctx.db, {
      spaceId: space.id,
      email: "member@example.com",
      label: "Team seat",
      joinedDate: "2026-06-08",
      monthlyAmountMinor: 1299,
      monthlyCurrencyCode: "CNY",
      monthlyRateUsed: "1",
      monthlyRateAsOf: "2026-06-28T00:00:00.000Z",
      monthlyRateSource: "frankfurter",
      monthlyAmountUsd: 181,
      monthlyPaymentDay: 8,
      billingPeriodUnit: "month",
      billingPeriodCount: 1,
      nextPaymentDate,
    });
  }

  it("sends to the owner recipient and matching subscription once on due day", async () => {
    setChildAccountEmailReminderSettings(ctx.db, {
      enabled: true,
      recipientEmail: "owner@example.com",
      sendTime: "09:30",
      smtpUrl: "smtp://user:pass@smtp.example.com:587",
      smtpFrom: "sender@example.com",
      templateSubject: "{spaceName} {childAccountEmail} due",
      templateBody:
        "<p>{childAccountEmail} is due on {nextPaymentDate}, amount {amount} {currencyCode}.</p>",
    });
    const child = makeChildAccount("2026-07-08");
    makeChildAccount("2026-07-09");
    upsertChildAccountReminderSubscription(ctx.db, {
      childAccountId: child.id,
      email: "member-reminder@example.com",
    });
    const sendEmail = vi.fn().mockResolvedValue(undefined);

    await expect(
      runChildAccountPaymentReminderJob(
        ctx.db,
        new Date(2026, 6, 8, 9, 29),
        sendEmail,
      ),
    ).resolves.toMatchObject({
      checked: false,
      sent: 0,
      reason: "not-scheduled-time",
    });

    await expect(
      runChildAccountPaymentReminderJob(
        ctx.db,
        new Date(2026, 6, 8, 9, 30),
        sendEmail,
      ),
    ).resolves.toMatchObject({ checked: true, sent: 2 });

    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenNthCalledWith(1, {
      smtpUrl: "smtp://user:pass@smtp.example.com:587",
      from: "sender@example.com",
      to: "owner@example.com",
      subject: "US Team member@example.com due",
      text: "member@example.com is due on 2026-07-08, amount 12.99 CNY.",
      html: "<p>member@example.com is due on 2026-07-08, amount 12.99 CNY.</p>",
    });
    expect(sendEmail).toHaveBeenNthCalledWith(2, {
      smtpUrl: "smtp://user:pass@smtp.example.com:587",
      from: "sender@example.com",
      to: "member-reminder@example.com",
      subject: "US Team member@example.com due",
      text: "member@example.com is due on 2026-07-08, amount 12.99 CNY.",
      html: "<p>member@example.com is due on 2026-07-08, amount 12.99 CNY.</p>",
    });

    await expect(
      runChildAccountPaymentReminderJob(
        ctx.db,
        new Date(2026, 6, 8, 9, 30),
        sendEmail,
      ),
    ).resolves.toMatchObject({ checked: true, sent: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });
});
