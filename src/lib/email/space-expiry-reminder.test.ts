import { describe, expect, it } from "vitest";
import { composeSpaceExpiryReminderEmail, renderSpaceExpiryReminderTemplate } from "@/lib/email/space-expiry-reminder";
import { renderSpaceExpiryReminderContent } from "@/lib/email/space-expiry-reminder-content";

const row = {
  id: 1,
  name: "US Team",
  paymentChannelName: "Visa（1234）",
  expiryDate: "2026-10-25T09:30:45",
  daysUntilExpiry: 7,
  amountUsdMinor: 2599,
};

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
      subject: "JP Team / 2026-08-01 00:00:00",
      text: expect.stringContaining("JP Team has 7 days left via Wise: 32.90 USD."),
      html: expect.stringContaining('<p style="margin:0 0 12px;">JP Team has 7 days left via Wise: 32.90 USD.</p>'),
    });
  });

  it("renders rich text template html and strips unsafe tags", () => {
    const email = renderSpaceExpiryReminderTemplate(
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
      );
    expect(email).toEqual({
      subject: "Rich Team",
      text: expect.stringContaining("Rich Team due in 7"),
      html: expect.stringContaining('<p style="margin:0 0 12px;"><strong>Rich Team</strong> due in 7</p>'),
    });
    expect(email.html).not.toContain("<script");
    expect(email.html).not.toContain("alert(1)");
  });

  it("includes exact expiry time, dollar amount, and card tail in both alternatives", () => {
    const email = composeSpaceExpiryReminderEmail(row);
    for (const value of ["US Team", "2026-10-25 09:30:45", "25.99 USD", "Visa（1234）", "7 天后到期", "续费完成后"]) {
      expect(email.text).toContain(value);
      expect(email.html).toContain(value);
    }
    expect(email.html).toContain('aria-label="空间订阅信息"');
    expect(email.text).not.toMatch(/<[^>]+>/);
  });

  it.each([[0, "今天到期"], [-2, "已到期 2 天"]])(
    "uses the actual relative due date (%i)",
    (daysUntilExpiry, status) => {
      const email = composeSpaceExpiryReminderEmail({ ...row, daysUntilExpiry });
      expect(email.text).toContain(status);
      expect(email.html).toContain(status);
      expect(email.text).not.toContain("7 天后到期");
    },
  );

  it("escapes names and channels in layout, subject, and rich text placeholders", () => {
    const email = composeSpaceExpiryReminderEmail({
      ...row,
      name: '<img src=x onerror="alert(1)">',
      paymentChannelName: "Bank & <script>alert(2)</script>",
    }, {
      subject: "{spaceName}",
      body: '<p onclick="alert(3)" style="color:red"><strong>{paymentChannelName}</strong></p><script>alert(4)</script>',
    });
    expect(email.html).toContain("&lt;img");
    expect(email.html).toContain("Bank &amp; &lt;script&gt;");
    expect(email.html).not.toMatch(/<img|<script|onclick=|style="color:red"|alert\(4\)/);
  });

  it("uses exactly the same renderer as the settings preview", () => {
    const template = { subject: "{spaceName}", body: "请检查 {paymentChannelName}\n到期 {expiryDate}" };
    expect(composeSpaceExpiryReminderEmail(row, template)).toEqual(
      renderSpaceExpiryReminderContent(template, {
        spaceName: row.name,
        paymentChannelName: row.paymentChannelName,
        amountUsd: "25.99",
        daysUntilExpiry: "7",
        expiryDate: "2026-10-25 09:30:45",
      }),
    );
  });
});
