import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { appSetting } from "./schema";

type Db = BetterSQLite3Database<Record<string, unknown>>;

export const DEFAULT_STATUS_THRESHOLDS = {
  spaceSoonDays: 7,
  childAccountSoonDays: 7,
} as const;

export type StatusThresholds = {
  spaceSoonDays: number;
  childAccountSoonDays: number;
};

export type SpaceEmailReminderSettings = {
  enabled: boolean;
  recipientEmail: string;
};

const SPACE_SOON_DAYS_KEY = "space.status.soonDays";
const CHILD_ACCOUNT_SOON_DAYS_KEY = "childAccount.status.soonDays";
const SPACE_EMAIL_REMINDER_ENABLED_KEY = "space.emailReminder.enabled";
const SPACE_EMAIL_REMINDER_RECIPIENT_EMAIL_KEY =
  "space.emailReminder.recipientEmail";

function normalizeDays(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 365) return fallback;
  return parsed;
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
