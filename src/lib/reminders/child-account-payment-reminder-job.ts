import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import {
  listDueChildAccountPaymentReminders,
  recordChildAccountReminderSent,
  wasChildAccountReminderSent,
} from "@/db/childAccountReminders";
import { getChildAccountEmailReminderSettings } from "@/db/settings";
import { composeChildAccountReminderEmail } from "@/lib/email/child-account-reminder";
import { sendEmail } from "@/lib/email/smtp";
import { runReminderDispatch } from "@/lib/reminders/reminder-dispatch";

type Db = BetterSQLite3Database<Record<string, unknown>>;

type EmailSender = typeof sendEmail;

export type ChildAccountPaymentReminderJobResult = Awaited<
  ReturnType<typeof runReminderDispatch>
>;

export async function runChildAccountPaymentReminderJob(
  db: Db,
  now = new Date(),
  emailSender: EmailSender = sendEmail,
): Promise<ChildAccountPaymentReminderJobResult> {
  const emailSettings = getChildAccountEmailReminderSettings(db);
  return runReminderDispatch({
    settings: emailSettings,
    now,
    emailSender,
    listCandidates: () => listDueChildAccountPaymentReminders(db, now),
    composeMessage: (candidate) =>
      composeChildAccountReminderEmail(candidate, {
        subject: emailSettings.templateSubject,
        body: emailSettings.templateBody,
      }),
    wasSent: (candidate, recipientEmail) =>
      wasChildAccountReminderSent(
        db,
        candidate.childAccountId,
        candidate.nextPaymentDate,
        recipientEmail,
      ),
    recordSent: (candidate, recipientEmail, sentAt) =>
      recordChildAccountReminderSent(db, {
        childAccountId: candidate.childAccountId,
        nextPaymentDate: candidate.nextPaymentDate,
        recipientEmail,
        sentAt,
      }),
  });
}
