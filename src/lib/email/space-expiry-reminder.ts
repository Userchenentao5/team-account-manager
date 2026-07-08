import type { SpaceExpiryReminderRow } from "@/db/spaceReminders";
import {
  DEFAULT_SPACE_EMAIL_TEMPLATE_BODY,
  DEFAULT_SPACE_EMAIL_TEMPLATE_SUBJECT,
} from "@/db/settings";
import {
  renderRichTextTemplateBody,
  renderTemplateText,
} from "@/lib/email/rich-text";
import { formatMinor } from "@/lib/money";

export type SpaceExpiryReminderEmail = {
  subject: string;
  text: string;
  html: string;
};

export type SpaceExpiryReminderTemplate = {
  subject: string;
  body: string;
};

function templateValues(row: SpaceExpiryReminderRow): Record<string, string> {
  return {
    amountUsd: formatMinor(row.amountUsdMinor, 2),
    daysUntilExpiry: String(row.daysUntilExpiry),
    expiryDate: row.expiryDate,
    paymentChannelName: row.paymentChannelName,
    spaceName: row.name,
  };
}

export function renderSpaceExpiryReminderTemplate(
  template: SpaceExpiryReminderTemplate,
  row: SpaceExpiryReminderRow,
): SpaceExpiryReminderEmail {
  const values = templateValues(row);
  const body = renderRichTextTemplateBody(template.body, values);

  return {
    subject: renderTemplateText(template.subject, values),
    text: body.text,
    html: body.html,
  };
}

export function composeSpaceExpiryReminderEmail(
  row: SpaceExpiryReminderRow,
  template: SpaceExpiryReminderTemplate = {
    subject: DEFAULT_SPACE_EMAIL_TEMPLATE_SUBJECT,
    body: DEFAULT_SPACE_EMAIL_TEMPLATE_BODY,
  },
): SpaceExpiryReminderEmail {
  return renderSpaceExpiryReminderTemplate(template, row);
}
