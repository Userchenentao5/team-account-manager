import { describe, expect, it } from "vitest";
import type { ChildAccountPaymentReminderRow } from "@/db/childAccountReminders";
import { composeChildAccountReminderEmail } from "./child-account-reminder";
import { renderChildAccountReminderContent } from "./child-account-reminder-content";

const row: ChildAccountPaymentReminderRow = {
  childAccountId: 1,
  spaceName: "US Team",
  childAccountEmail: "member@example.com",
  childAccountContact: "wx-member",
  childAccountLabel: "Team seat",
  amountMinor: 1299,
  currencyMinorUnit: 2,
  currencyCode: "CNY",
  nextPaymentDate: "2026-10-18",
  daysUntilPayment: 0,
};

describe("child account reminder email", () => {
  it("includes the billing summary and default message in HTML and plain text", () => {
    const email = composeChildAccountReminderEmail(row);

    expect(email.subject).toBe("US Team 子账号到期提醒");
    for (const value of ["US Team", "member@example.com", "wx-member", "Team seat", "12.99", "CNY", "2026-10-18", "今天到期", "确认续费与收款"]) {
      expect(email.text).toContain(value);
      expect(email.html).toContain(value);
    }
    expect(email.html).toContain('aria-label="子账号信息"');
    expect(email.text).not.toMatch(/<[^>]+>/);
  });

  it("escapes record values and strips unsafe custom HTML before adding layout styles", () => {
    const email = composeChildAccountReminderEmail({
      ...row,
      spaceName: '<img src=x onerror="alert(1)">',
      childAccountContact: 'A & B <script>alert(2)</script>',
    }, {
      subject: "{spaceName}",
      body: '<p style="color:red" onclick="alert(3)"><strong>{contact}</strong></p><script>alert(4)</script><img src=x onerror="alert(5)">',
    });

    expect(email.html).toContain("&lt;img");
    expect(email.html).toContain("A &amp; B &lt;script&gt;");
    expect(email.html).not.toMatch(/<img|<script|onclick=|style="color:red"|alert\(4\)|alert\(5\)/);
    expect(email.html).toContain("<strong>");
  });

  it.each([[3, "3 天后到期"], [-2, "已到期 2 天"]])(
    "uses the actual relative due date for test sends (%i)",
    (daysUntilPayment, status) => {
      const email = composeChildAccountReminderEmail({ ...row, daysUntilPayment });
      expect(email.html).toContain(status);
      expect(email.text).toContain(status);
      expect(email.html).not.toContain("今天到期");
    },
  );

  it("handles missing contact/label and preserves plain-text custom body line breaks", () => {
    const email = composeChildAccountReminderEmail({
      ...row,
      childAccountContact: "",
      childAccountLabel: "",
      currencyMinorUnit: 0,
      currencyCode: "JPY",
    }, { subject: "{childAccountEmail}", body: "你好 {contact}\n请核实 {amount} {currencyCode}" });

    expect(email.text).toContain("应收金额：1299 JPY");
    expect(email.text).toContain("你好 未填写\n请核实 1299 JPY");
    expect(email.html).toContain("你好 未填写<br>请核实 1299 JPY");
    expect(email.html).not.toContain("账号备注");
  });

  it("uses exactly the same renderer as the client-side preview", () => {
    const template = { subject: "{spaceName}", body: "<ul><li>{childAccountEmail}</li><li>{amountUsd}</li></ul>" };
    expect(composeChildAccountReminderEmail(row, template)).toEqual(
      renderChildAccountReminderContent(template, {
        amount: "12.99",
        amountUsd: "12.99",
        contact: row.childAccountContact,
        childAccountEmail: row.childAccountEmail,
        childAccountLabel: row.childAccountLabel,
        currencyCode: row.currencyCode,
        daysUntilPayment: "0",
        nextPaymentDate: row.nextPaymentDate,
        spaceName: row.spaceName,
      }),
    );
  });
});
