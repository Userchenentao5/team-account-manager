import type { sendEmail } from "@/lib/email/smtp";

export type ReminderEmailSettings = {
  enabled: boolean;
  recipientEmail: string;
  sendTime: string;
  smtpUrl: string;
  smtpFrom: string;
};

export type ReminderDispatchResult = {
  checked: boolean;
  sent: number;
  reason?:
    | "disabled"
    | "missing-recipient"
    | "missing-smtp"
    | "not-scheduled-time";
};

type ReminderMessage = {
  subject: string;
  text: string;
  html: string;
};

type ReminderDispatchInput<T> = {
  settings: ReminderEmailSettings;
  now: Date;
  emailSender: typeof sendEmail;
  listCandidates: () => T[];
  composeMessage: (candidate: T) => ReminderMessage;
  wasSent?: (candidate: T, recipientEmail: string) => boolean;
  recordSent: (candidate: T, recipientEmail: string, sentAt: Date) => void;
};

function timeText(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

/**
 * Shared reminder dispatch policy. Candidate queries, message composition and
 * persistence stay as adapters because Space and Child Account reminders have
 * different rows and log keys.
 */
export async function runReminderDispatch<T>({
  settings,
  now,
  emailSender,
  listCandidates,
  composeMessage,
  wasSent,
  recordSent,
}: ReminderDispatchInput<T>): Promise<ReminderDispatchResult> {
  if (!settings.enabled) {
    return { checked: false, sent: 0, reason: "disabled" };
  }
  if (!settings.recipientEmail) {
    return { checked: false, sent: 0, reason: "missing-recipient" };
  }
  if (!settings.smtpUrl || !settings.smtpFrom) {
    return { checked: false, sent: 0, reason: "missing-smtp" };
  }
  if (timeText(now) !== settings.sendTime) {
    return { checked: false, sent: 0, reason: "not-scheduled-time" };
  }

  let sent = 0;
  for (const candidate of listCandidates()) {
    if (wasSent?.(candidate, settings.recipientEmail)) continue;

    const message = composeMessage(candidate);
    await emailSender({
      smtpUrl: settings.smtpUrl,
      from: settings.smtpFrom,
      to: settings.recipientEmail,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    recordSent(candidate, settings.recipientEmail, now);
    sent += 1;
  }

  return { checked: true, sent };
}
