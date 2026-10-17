import type { SpaceExpiryReminderRow } from "@/db/spaceReminders";
import {
  DEFAULT_SPACE_EMAIL_TEMPLATE_BODY,
  DEFAULT_SPACE_EMAIL_TEMPLATE_SUBJECT,
} from "@/db/settings";
import {
  renderSpaceExpiryReminderContent,
  type SpaceExpiryReminderValues,
} from "@/lib/email/space-expiry-reminder-content";
import { formatMinor } from "@/lib/money";
import { formatSpaceDateTime } from "@/lib/space-date-time";

export type SpaceExpiryReminderEmail = {
  subject: string;
  text: string;
  html: string;
};

export type SpaceExpiryReminderTemplate = {
  subject: string;
  body: string;
};

function templateValues(row: SpaceExpiryReminderRow): SpaceExpiryReminderValues {
  return {
    amountUsd: formatMinor(row.amountUsdMinor, 2),
    daysUntilExpiry: String(row.daysUntilExpiry),
    expiryDate: formatSpaceDateTime(row.expiryDate),
    paymentChannelName: row.paymentChannelName,
    spaceName: row.name,
  };
}

export function renderSpaceExpiryReminderTemplate(
  template: SpaceExpiryReminderTemplate,
  row: SpaceExpiryReminderRow,
): SpaceExpiryReminderEmail {
  return renderSpaceExpiryReminderContent(template, templateValues(row));
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
