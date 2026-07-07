import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SPACE_EMAIL_TEMPLATE_BODY,
  DEFAULT_SPACE_EMAIL_TEMPLATE_SUBJECT,
  DEFAULT_SPACE_EMAIL_REMINDER_SEND_TIME,
  DEFAULT_STATUS_THRESHOLDS,
  getSpaceEmailReminderSettings,
  getStatusThresholds,
  setSpaceEmailReminderSettings,
  setStatusThresholds,
} from "@/db/settings";
import { createTestDb } from "@/test/db-harness";

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
      sendTime: DEFAULT_SPACE_EMAIL_REMINDER_SEND_TIME,
      smtpUrl: "",
      smtpFrom: "",
      templateSubject: DEFAULT_SPACE_EMAIL_TEMPLATE_SUBJECT,
      templateBody: DEFAULT_SPACE_EMAIL_TEMPLATE_BODY,
    });

    setSpaceEmailReminderSettings(ctx.db, {
      enabled: true,
      recipientEmail: "billing@example.com",
      sendTime: "10:30",
      smtpUrl: "smtp://user:pass@smtp.example.com:587",
      smtpFrom: "sender@example.com",
      templateSubject: "{spaceName} 续费提醒",
      templateBody: "{spaceName} 还有 {daysUntilExpiry} 天到期。",
    });

    expect(getSpaceEmailReminderSettings(ctx.db)).toEqual({
      enabled: true,
      recipientEmail: "billing@example.com",
      sendTime: "10:30",
      smtpUrl: "smtp://user:pass@smtp.example.com:587",
      smtpFrom: "sender@example.com",
      templateSubject: "{spaceName} 续费提醒",
      templateBody: "{spaceName} 还有 {daysUntilExpiry} 天到期。",
    });
    expect(getStatusThresholds(ctx.db)).toEqual(DEFAULT_STATUS_THRESHOLDS);
  });
});
