import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import {
  listDueChildAccountPaymentReminders,
  recordChildAccountReminderSent,
  wasChildAccountReminderSent,
} from "@/db/childAccountReminders";
import { getChildAccountEmailReminderSettings } from "@/db/settings";
import { composeChildAccountReminderEmail } from "@/lib/email/child-account-reminder";
import { sendEmail } from "@/lib/email/smtp";

type Db = BetterSQLite3Database<Record<string, unknown>>;

type EmailSender = typeof sendEmail;

export type ChildAccountPaymentReminderJobResult = {
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

export async function runChildAccountPaymentReminderJob(
  db: Db,
  now = new Date(),
  emailSender: EmailSender = sendEmail,
): Promise<ChildAccountPaymentReminderJobResult> {
  const emailSettings = getChildAccountEmailReminderSettings(db);
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

  const candidates = listDueChildAccountPaymentReminders(db, now);
  let sent = 0;

  for (const candidate of candidates) {
    const message = composeChildAccountReminderEmail(candidate, {
      subject: emailSettings.templateSubject,
      body: emailSettings.templateBody,
    });
    const recipientEmail = emailSettings.recipientEmail;
    if (
      wasChildAccountReminderSent(
        db,
        candidate.childAccountId,
        candidate.nextPaymentDate,
        recipientEmail,
      )
    ) {
      continue;
    }

    await emailSender({
      smtpUrl: emailSettings.smtpUrl,
      from: emailSettings.smtpFrom,
      to: recipientEmail,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    recordChildAccountReminderSent(db, {
      childAccountId: candidate.childAccountId,
      nextPaymentDate: candidate.nextPaymentDate,
      recipientEmail,
      sentAt: now,
    });
    sent += 1;
  }

  return { checked: true, sent };
}
