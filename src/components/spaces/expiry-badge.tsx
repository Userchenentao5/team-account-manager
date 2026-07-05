import { expiryStatus } from "@/lib/expiry";
import { Badge } from "@/components/ui/badge";

type ExpiryBadgeProps = {
  expiryDate: string | null;
  soonDays?: number;
  displayStatus?: "self";
};

const STATUS_BADGE = {
  expired: {
    label: "已过期",
    className:
      "border-[#fecaca] bg-[#fee2e2] text-[#dc2626] hover:bg-[#fee2e2] dark:border-[#7f1d1d] dark:bg-[#450a0a] dark:text-[#fca5a5]",
  },
  soon: {
    label: "即将到期",
    className:
      "border-[#fde68a] bg-[#fef3c7] text-[#d97706] hover:bg-[#fef3c7] dark:border-[#78350f] dark:bg-[#451a03] dark:text-[#fbbf24]",
  },
  normal: {
    label: "正常",
    className:
      "border-[#bbf7d0] bg-[#dcfce7] text-[#16a34a] hover:bg-[#dcfce7] dark:border-[#14532d] dark:bg-[#052e16] dark:text-[#86efac]",
  },
  self: {
    label: "自用",
    className:
      "border-[#bfdbfe] bg-[#dbeafe] text-[#2563eb] hover:bg-[#dbeafe] dark:border-[#1e3a8a] dark:bg-[#172554] dark:text-[#93c5fd]",
  },
  unknown: {
    label: "信息缺失",
    className:
      "border-[#e5e7eb] bg-[#f3f4f6] text-[#6b7280] hover:bg-[#f3f4f6] dark:border-[#374151] dark:bg-[#111827] dark:text-[#d1d5db]",
  },
} as const;

export function ExpiryBadge({
  expiryDate,
  soonDays = 7,
  displayStatus,
}: ExpiryBadgeProps) {
  if (displayStatus) {
    const badge = STATUS_BADGE[displayStatus];
    return <Badge className={badge.className}>{badge.label}</Badge>;
  }

  if (!expiryDate) {
    const unknown = STATUS_BADGE.unknown;
    return <Badge className={unknown.className}>{unknown.label}</Badge>;
  }

  const status = expiryStatus(expiryDate, new Date(), soonDays);
  const badge = STATUS_BADGE[status];
  return <Badge className={badge.className}>{badge.label}</Badge>;
}
