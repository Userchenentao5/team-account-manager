import { describe, expect, it } from "vitest";
import {
  composeSpaceExpiryReminderEmail,
  renderSpaceExpiryReminderTemplate,
} from "@/lib/email/space-expiry-reminder";

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

  it("renders an editable template with supported placeholders", () => {
    expect(
      renderSpaceExpiryReminderTemplate(
        {
          subject: "{spaceName} / {expiryDate}",
          body: "{spaceName} 还有 {daysUntilExpiry} 天，渠道 {paymentChannelName}，金额 {amountUsd} USD。",
        },
        {
          id: 1,
          name: "JP Team",
          paymentChannelName: "Wise",
          expiryDate: "2026-08-01",
          daysUntilExpiry: 7,
          amountUsdMinor: 3290,
        },
      ),
    ).toEqual({
      subject: "JP Team / 2026-08-01",
      text: "JP Team 还有 7 天，渠道 Wise，金额 32.90 USD。",
    });
  });
});
