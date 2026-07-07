import type { SpaceExpiryReminderRow } from "@/db/spaceReminders";
import { formatMinor } from "@/lib/money";

export type SpaceExpiryReminderEmail = {
  subject: string;
  text: string;
};

export function composeSpaceExpiryReminderEmail(
  row: SpaceExpiryReminderRow,
): SpaceExpiryReminderEmail {
  const amountUsd = formatMinor(row.amountUsdMinor, 2);
  const text = `${row.name}空间即将在${row.daysUntilExpiry}天后到期，支付渠道${row.paymentChannelName}需要支付${row.name}空间${amountUsd} USD。`;

  return {
    subject: `${row.name}空间到期提醒`,
    text,
  };
}
