import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SPACE_EMAIL_TEMPLATE_BODY,
  DEFAULT_SPACE_EMAIL_TEMPLATE_SUBJECT,
  DEFAULT_CHILD_ACCOUNT_EMAIL_TEMPLATE_BODY,
  DEFAULT_STATUS_THRESHOLDS,
  getSpaceEmailReminderSettings,
  getStatusThresholds,
  setSpaceEmailReminderSettings,
  setStatusThresholds,
} from "@/db/settings";
import { createTestDb } from "@/test/db-harness";
import { appSetting } from "@/db/schema";
import { getChildAccountEmailReminderSettings } from "@/db/settings";

describe("status threshold settings", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  it("returns defaults when settings are not saved", () => {
    expect(getStatusThresholds(ctx.db)).toEqual(DEFAULT_STATUS_THRESHOLDS);
  });

  it("stores space and child-account thresholds independently", () => {
    setStatusThresholds(ctx.db, {
      spaceSoonDays: 14,
      childAccountSoonDays: 3,
    });

    expect(getStatusThresholds(ctx.db)).toEqual({
      spaceSoonDays: 14,
      childAccountSoonDays: 3,
    });
  });

  it("stores space email reminder settings independently", () => {
    expect(getSpaceEmailReminderSettings(ctx.db)).toEqual({
      enabled: false,
      recipientEmail: "",
      smtpUrl: "",
      smtpFrom: "",
      templateSubject: DEFAULT_SPACE_EMAIL_TEMPLATE_SUBJECT,
      templateBody: DEFAULT_SPACE_EMAIL_TEMPLATE_BODY,
    });

    setSpaceEmailReminderSettings(ctx.db, {
      enabled: true,
      recipientEmail: "billing@example.com",
      smtpUrl: "smtp://user:pass@smtp.example.com:587",
      smtpFrom: "sender@example.com",
      templateSubject: "{spaceName} 续费提醒",
      templateBody: "{spaceName} 还有 {daysUntilExpiry} 天到期。",
    });

    expect(getSpaceEmailReminderSettings(ctx.db)).toEqual({
      enabled: true,
      recipientEmail: "billing@example.com",
      smtpUrl: "smtp://user:pass@smtp.example.com:587",
      smtpFrom: "sender@example.com",
      templateSubject: "{spaceName} 续费提醒",
      templateBody: "{spaceName} 还有 {daysUntilExpiry} 天到期。",
    });
    expect(getStatusThresholds(ctx.db)).toEqual(DEFAULT_STATUS_THRESHOLDS);
  });

  it("ignores the obsolete space send time while retaining the child account time", () => {
    ctx.db.insert(appSetting).values([
      { key: "space.emailReminder.sendTime", value: "10:30" },
      { key: "childAccount.emailReminder.sendTime", value: "11:45" },
    ]).run();

    expect(getSpaceEmailReminderSettings(ctx.db)).not.toHaveProperty("sendTime");
    expect(getChildAccountEmailReminderSettings(ctx.db).sendTime).toBe("11:45");
  });

  it.each([
    "{spaceName} 空间的子账号 {childAccountEmail} 今天到期，联系人：{contact}，应收金额：{amount} {currencyCode}。",
    "<p>{spaceName} 的子账号 <strong>{childAccountEmail}</strong> 今天到期。</p><p>应收金额：{amount} {currencyCode}，下一付款日：{nextPaymentDate}。</p>",
  ])("upgrades a saved built-in child account body: %s", (body) => {
    ctx.db.insert(appSetting).values({
      key: "childAccount.emailReminder.templateBody",
      value: body,
    }).run();

    expect(getChildAccountEmailReminderSettings(ctx.db).templateBody)
      .toBe(DEFAULT_CHILD_ACCOUNT_EMAIL_TEMPLATE_BODY);
  });

  it("retains the owner's custom child account body", () => {
    const body = "<p>请联系 {contact}，核实后再收款。</p>";
    ctx.db.insert(appSetting).values({
      key: "childAccount.emailReminder.templateBody",
      value: body,
    }).run();

    expect(getChildAccountEmailReminderSettings(ctx.db).templateBody).toBe(body);
  });

  it("upgrades the saved built-in space reminder body", () => {
    ctx.db.insert(appSetting).values({
      key: "space.emailReminder.templateBody",
      value: "{spaceName}空间即将在{daysUntilExpiry}天后到期，支付渠道{paymentChannelName}需要支付{spaceName}空间{amountUsd} USD。",
    }).run();

    expect(getSpaceEmailReminderSettings(ctx.db).templateBody)
      .toBe(DEFAULT_SPACE_EMAIL_TEMPLATE_BODY);
  });

  it("retains the owner's custom space reminder body", () => {
    const body = "<p>请在 {expiryDate} 前检查 {paymentChannelName}。</p>";
    ctx.db.insert(appSetting).values({
      key: "space.emailReminder.templateBody",
      value: body,
    }).run();

    expect(getSpaceEmailReminderSettings(ctx.db).templateBody).toBe(body);
  });
});
