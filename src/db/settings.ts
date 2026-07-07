import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { appSetting } from "./schema";

type Db = BetterSQLite3Database<Record<string, unknown>>;

export const DEFAULT_STATUS_THRESHOLDS = {
  spaceSoonDays: 7,
  childAccountSoonDays: 7,
} as const;

export const DEFAULT_SPACE_EMAIL_REMINDER_SEND_TIME = "09:00";
export const DEFAULT_SPACE_EMAIL_TEMPLATE_SUBJECT = "{spaceName}空间到期提醒";
export const DEFAULT_SPACE_EMAIL_TEMPLATE_BODY =
  "{spaceName}空间即将在{daysUntilExpiry}天后到期，支付渠道{paymentChannelName}需要支付{spaceName}空间{amountUsd} USD。";

export type StatusThresholds = {
  spaceSoonDays: number;
  childAccountSoonDays: number;
};

export type SpaceEmailReminderSettings = {
  enabled: boolean;
  recipientEmail: string;
  sendTime: string;
  smtpUrl: string;
  smtpFrom: string;
  templateSubject: string;
  templateBody: string;
};

const SPACE_SOON_DAYS_KEY = "space.status.soonDays";
const CHILD_ACCOUNT_SOON_DAYS_KEY = "childAccount.status.soonDays";
const SPACE_EMAIL_REMINDER_ENABLED_KEY = "space.emailReminder.enabled";
const SPACE_EMAIL_REMINDER_RECIPIENT_EMAIL_KEY =
  "space.emailReminder.recipientEmail";
const SPACE_EMAIL_REMINDER_SEND_TIME_KEY = "space.emailReminder.sendTime";
const SPACE_EMAIL_REMINDER_SMTP_URL_KEY = "space.emailReminder.smtpUrl";
const SPACE_EMAIL_REMINDER_SMTP_FROM_KEY = "space.emailReminder.smtpFrom";
const SPACE_EMAIL_REMINDER_TEMPLATE_SUBJECT_KEY =
  "space.emailReminder.templateSubject";
const SPACE_EMAIL_REMINDER_TEMPLATE_BODY_KEY =
  "space.emailReminder.templateBody";

function normalizeDays(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 365) return fallback;
  return parsed;
}

function normalizeTime(value: string | undefined, fallback: string): string {
  if (value === undefined) return fallback;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}

export function getStatusThresholds(db: Db): StatusThresholds {
  const rows = db.select().from(appSetting).all();
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  return {
    spaceSoonDays: normalizeDays(
      values[SPACE_SOON_DAYS_KEY],
      DEFAULT_STATUS_THRESHOLDS.spaceSoonDays,
    ),
    childAccountSoonDays: normalizeDays(
      values[CHILD_ACCOUNT_SOON_DAYS_KEY],
      DEFAULT_STATUS_THRESHOLDS.childAccountSoonDays,
    ),
  };
}

export function setStatusThresholds(
  db: Db,
  thresholds: StatusThresholds,
): void {
  const rows = [
    [SPACE_SOON_DAYS_KEY, thresholds.spaceSoonDays],
    [CHILD_ACCOUNT_SOON_DAYS_KEY, thresholds.childAccountSoonDays],
  ] as const;

  for (const [key, value] of rows) {
    db.insert(appSetting)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({
        target: appSetting.key,
        set: { value: String(value) },
      })
      .run();
  }
}

export function getSpaceEmailReminderSettings(
  db: Db,
): SpaceEmailReminderSettings {
  const rows = db.select().from(appSetting).all();
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  return {
    enabled: values[SPACE_EMAIL_REMINDER_ENABLED_KEY] === "true",
    recipientEmail: values[SPACE_EMAIL_REMINDER_RECIPIENT_EMAIL_KEY] ?? "",
    sendTime: normalizeTime(
      values[SPACE_EMAIL_REMINDER_SEND_TIME_KEY],
      DEFAULT_SPACE_EMAIL_REMINDER_SEND_TIME,
    ),
    smtpUrl: values[SPACE_EMAIL_REMINDER_SMTP_URL_KEY] ?? "",
    smtpFrom: values[SPACE_EMAIL_REMINDER_SMTP_FROM_KEY] ?? "",
    templateSubject:
      values[SPACE_EMAIL_REMINDER_TEMPLATE_SUBJECT_KEY] ??
      DEFAULT_SPACE_EMAIL_TEMPLATE_SUBJECT,
    templateBody:
      values[SPACE_EMAIL_REMINDER_TEMPLATE_BODY_KEY] ??
      DEFAULT_SPACE_EMAIL_TEMPLATE_BODY,
  };
}

export function setSpaceEmailReminderSettings(
  db: Db,
  settings: SpaceEmailReminderSettings,
): void {
  const rows = [
    [SPACE_EMAIL_REMINDER_ENABLED_KEY, settings.enabled ? "true" : "false"],
    [
      SPACE_EMAIL_REMINDER_RECIPIENT_EMAIL_KEY,
      settings.recipientEmail.trim(),
    ],
    [SPACE_EMAIL_REMINDER_SEND_TIME_KEY, settings.sendTime],
    [SPACE_EMAIL_REMINDER_SMTP_URL_KEY, settings.smtpUrl.trim()],
    [SPACE_EMAIL_REMINDER_SMTP_FROM_KEY, settings.smtpFrom.trim()],
    [
      SPACE_EMAIL_REMINDER_TEMPLATE_SUBJECT_KEY,
      settings.templateSubject.trim(),
    ],
    [SPACE_EMAIL_REMINDER_TEMPLATE_BODY_KEY, settings.templateBody.trim()],
  ] as const;

  for (const [key, value] of rows) {
    db.insert(appSetting)
      .values({ key, value })
      .onConflictDoUpdate({
        target: appSetting.key,
        set: { value },
      })
      .run();
  }
}
