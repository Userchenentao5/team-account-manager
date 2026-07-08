import { describe, expect, it } from "vitest";
import { renderSpaceExpiryReminderTemplate } from "@/lib/email/space-expiry-reminder";

describe("space expiry reminder email", () => {
  it("renders a plain text template as both text and html", () => {
    expect(
      renderSpaceExpiryReminderTemplate(
        {
          subject: "{spaceName} / {expiryDate}",
          body: "{spaceName} has {daysUntilExpiry} days left via {paymentChannelName}: {amountUsd} USD.",
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
      text: "JP Team has 7 days left via Wise: 32.90 USD.",
      html: "<p>JP Team has 7 days left via Wise: 32.90 USD.</p>",
    });
  });

  it("renders rich text template html and strips unsafe tags", () => {
    expect(
      renderSpaceExpiryReminderTemplate(
        {
          subject: "{spaceName}",
          body: "<p><strong>{spaceName}</strong> due in {daysUntilExpiry}</p><script>alert(1)</script>",
        },
        {
          id: 1,
          name: "Rich Team",
          paymentChannelName: "Wise",
          expiryDate: "2026-08-01",
          daysUntilExpiry: 7,
          amountUsdMinor: 3290,
        },
      ),
    ).toEqual({
      subject: "Rich Team",
      text: "Rich Team due in 7",
      html: "<p><strong>Rich Team</strong> due in 7</p>",
    });
  });
});
