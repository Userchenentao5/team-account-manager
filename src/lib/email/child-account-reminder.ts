import type { ChildAccountPaymentReminderRow } from "@/db/childAccountReminders";
import {
  DEFAULT_CHILD_ACCOUNT_EMAIL_TEMPLATE_BODY,
  DEFAULT_CHILD_ACCOUNT_EMAIL_TEMPLATE_SUBJECT,
} from "@/db/settings";
import {
  renderRichTextTemplateBody,
  renderTemplateText,
} from "@/lib/email/rich-text";
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
): Record<string, string> {
  const amount = formatMinor(row.amountMinor, row.currencyMinorUnit);
  return {
    amount,
    amountUsd: amount,
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
  const values = templateValues(row);
  const body = renderRichTextTemplateBody(template.body, values);

  return {
    subject: renderTemplateText(template.subject, values),
    text: body.text,
    html: body.html,
  };
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
