import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import {
  listDueSpaceExpiryReminders,
  recordSpaceExpiryReminderSent,
} from "@/db/spaceReminders";
import {
  getSpaceEmailReminderSettings,
  getStatusThresholds,
} from "@/db/settings";
import { composeSpaceExpiryReminderEmail } from "@/lib/email/space-expiry-reminder";
import { sendEmail } from "@/lib/email/smtp";

type Db = BetterSQLite3Database<Record<string, unknown>>;

type EmailSender = typeof sendEmail;

export type SpaceExpiryReminderJobResult = {
  checked: boolean;
  sent: number;
  reason?:
    | "disabled"
    | "missing-recipient"
    | "missing-smtp"
    | "not-scheduled-time";
};

function timeText(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

export async function runSpaceExpiryReminderJob(
  db: Db,
  now = new Date(),
  emailSender: EmailSender = sendEmail,
): Promise<SpaceExpiryReminderJobResult> {
  const emailSettings = getSpaceEmailReminderSettings(db);
  if (!emailSettings.enabled) {
    return { checked: false, sent: 0, reason: "disabled" };
  }
  if (!emailSettings.recipientEmail) {
    return { checked: false, sent: 0, reason: "missing-recipient" };
  }
  if (!emailSettings.smtpUrl || !emailSettings.smtpFrom) {
    return { checked: false, sent: 0, reason: "missing-smtp" };
  }
  if (timeText(now) !== emailSettings.sendTime) {
    return { checked: false, sent: 0, reason: "not-scheduled-time" };
  }

  const thresholds = getStatusThresholds(db);
  const candidates = listDueSpaceExpiryReminders(
    db,
    thresholds.spaceSoonDays,
    now,
  );
  let sent = 0;

  for (const candidate of candidates) {
    const message = composeSpaceExpiryReminderEmail(candidate, {
      subject: emailSettings.templateSubject,
      body: emailSettings.templateBody,
    });
    await emailSender({
      smtpUrl: emailSettings.smtpUrl,
      from: emailSettings.smtpFrom,
      to: emailSettings.recipientEmail,
      subject: message.subject,
      text: message.text,
    });
    recordSpaceExpiryReminderSent(db, {
      spaceId: candidate.id,
      expiryDate: candidate.expiryDate,
      thresholdDays: thresholds.spaceSoonDays,
      recipientEmail: emailSettings.recipientEmail,
      sentAt: now,
    });
    sent += 1;
  }

  return { checked: true, sent };
}
