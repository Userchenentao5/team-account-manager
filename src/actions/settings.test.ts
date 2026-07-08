import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestDb } from "@/test/db-harness";

const mailer = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));
const dbHolder = vi.hoisted(() => ({ current: null as unknown as TestDb }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", () => ({
  get db() {
    return dbHolder.current;
  },
}));
vi.mock("nodemailer", () => ({
  default: {
    createTransport: mailer.createTransport,
  },
}));

import { sendSpaceEmailReminderTest } from "@/actions/settings";
import { insertChannel } from "@/db/channels";
import { seedCurrencies } from "@/db/seed";
import { insertSpaceWithMother } from "@/db/spaces";
import { createTestDb } from "@/test/db-harness";

describe("settings server actions", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
    dbHolder.current = ctx.db;
    seedCurrencies(ctx.db);
    mailer.sendMail.mockReset();
    mailer.createTransport.mockReset();
    mailer.createTransport.mockReturnValue({ sendMail: mailer.sendMail });
  });

  afterEach(() => {
    vi.useRealTimers();
    ctx.sqlite.close();
  });

  it("sends a rendered template email with real space data for the reminder test", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 8, 12));

    const channel = insertChannel(ctx.db, "Visa");
    insertSpaceWithMother(
      ctx.db,
      {
        name: "Real Team",
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
        openingDate: "2026-07-01",
        currentPeriodStartDate: "2026-07-01",
        expiryDate: "2026-07-14",
      },
      "owner@example.com",
    );

    const res = await sendSpaceEmailReminderTest(
      {
        enabled: true,
        recipientEmail: "billing@example.com",
        sendTime: "09:00",
        smtpUrl: "smtp://user:pass@smtp.example.com:587",
        smtpFrom: "sender@example.com",
        templateSubject: "{spaceName} reminder",
        templateBody:
          "{spaceName} has {daysUntilExpiry} days left via {paymentChannelName}: {amountUsd} USD on {expiryDate}",
      },
    );

    expect(res).toEqual({ ok: true });
    expect(mailer.createTransport).toHaveBeenCalledWith(
      "smtp://user:pass@smtp.example.com:587",
    );
    expect(mailer.sendMail).toHaveBeenCalledWith({
      from: "sender@example.com",
      to: "billing@example.com",
      subject: "Real Team reminder",
      text: "Real Team has 6 days left via Visa: 25.99 USD on 2026-07-14",
      html: "<p>Real Team has 6 days left via Visa: 25.99 USD on 2026-07-14</p>",
    });
  });
});
