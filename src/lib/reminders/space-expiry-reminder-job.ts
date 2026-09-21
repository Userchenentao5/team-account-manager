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
import { runReminderDispatch } from "@/lib/reminders/reminder-dispatch";

type Db = BetterSQLite3Database<Record<string, unknown>>;

type EmailSender = typeof sendEmail;

export type SpaceExpiryReminderJobResult = Awaited<
  ReturnType<typeof runReminderDispatch>
>;

export async function runSpaceExpiryReminderJob(
  db: Db,
  now = new Date(),
  emailSender: EmailSender = sendEmail,
): Promise<SpaceExpiryReminderJobResult> {
  const emailSettings = getSpaceEmailReminderSettings(db);
  const thresholds = getStatusThresholds(db);
  return runReminderDispatch({
    settings: emailSettings,
    now,
    emailSender,
    listCandidates: () =>
      listDueSpaceExpiryReminders(db, thresholds.spaceSoonDays, now),
    composeMessage: (candidate) =>
      composeSpaceExpiryReminderEmail(candidate, {
        subject: emailSettings.templateSubject,
        body: emailSettings.templateBody,
      }),
    recordSent: (candidate, recipientEmail, sentAt) =>
      recordSpaceExpiryReminderSent(db, {
        spaceId: candidate.id,
        expiryDate: candidate.expiryDate,
        thresholdDays: thresholds.spaceSoonDays,
        recipientEmail,
        sentAt,
      }),
  });
}
