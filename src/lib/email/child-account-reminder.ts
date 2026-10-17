import type { ChildAccountPaymentReminderRow } from "@/db/childAccountReminders";
import {
  DEFAULT_CHILD_ACCOUNT_EMAIL_TEMPLATE_BODY,
  DEFAULT_CHILD_ACCOUNT_EMAIL_TEMPLATE_SUBJECT,
} from "@/db/settings";
import {
  renderChildAccountReminderContent,
  type ChildAccountReminderValues,
} from "@/lib/email/child-account-reminder-content";
import { formatMinor } from "@/lib/money";

export type ChildAccountReminderEmail = {
  subject: string;
  text: string;
  html: string;
};

export type ChildAccountReminderTemplate = {
  subject: string;
  body: string;
};

function templateValues(
  row: ChildAccountPaymentReminderRow,
): ChildAccountReminderValues {
  const amount = formatMinor(row.amountMinor, row.currencyMinorUnit);
  return {
    amount,
    amountUsd: amount,
    contact: row.childAccountContact || "未填写",
    childAccountEmail: row.childAccountEmail,
    childAccountLabel: row.childAccountLabel,
    currencyCode: row.currencyCode,
    daysUntilPayment: String(row.daysUntilPayment),
    nextPaymentDate: row.nextPaymentDate,
    spaceName: row.spaceName,
  };
}

export function renderChildAccountReminderTemplate(
  template: ChildAccountReminderTemplate,
  row: ChildAccountPaymentReminderRow,
): ChildAccountReminderEmail {
  return renderChildAccountReminderContent(template, templateValues(row));
}

export function composeChildAccountReminderEmail(
  row: ChildAccountPaymentReminderRow,
  template: ChildAccountReminderTemplate = {
    subject: DEFAULT_CHILD_ACCOUNT_EMAIL_TEMPLATE_SUBJECT,
    body: DEFAULT_CHILD_ACCOUNT_EMAIL_TEMPLATE_BODY,
  },
): ChildAccountReminderEmail {
  return renderChildAccountReminderTemplate(template, row);
}
