import { describe, expect, it } from "vitest";
import { composeSpaceExpiryReminderEmail } from "@/lib/email/space-expiry-reminder";

describe("space expiry reminder email", () => {
  it("formats the requested reminder content with channel and USD amount", () => {
    expect(
      composeSpaceExpiryReminderEmail({
        id: 1,
        name: "US Team",
        paymentChannelName: "Visa",
        expiryDate: "2026-07-10",
        daysUntilExpiry: 3,
        amountUsdMinor: 2599,
      }),
    ).toEqual({
      subject: "US Team空间到期提醒",
      text: "US Team空间即将在3天后到期，支付渠道Visa需要支付US Team空间25.99 USD。",
    });
  });
});
