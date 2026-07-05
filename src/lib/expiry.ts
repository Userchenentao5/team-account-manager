import {
  addMonths,
  addQuarters,
  addYears,
  differenceInCalendarDays,
  format,
} from "date-fns";

/**
 * Expiry helpers — calendar-aware period math and display status.
 *
 * Date-only strings are split into local Date parts before using date-fns so
 * UTC parsing cannot shift the base date in negative-offset runtimes.
 */
export type PeriodUnit = "month" | "quarter" | "year";

export type Period = {
  unit: PeriodUnit;
  count: number;
};

function localDateFromIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addPeriod(openingDate: string, period: Period): string {
  const base = localDateFromIsoDate(openingDate);
  const next =
    period.unit === "month"
      ? addMonths(base, period.count)
      : period.unit === "quarter"
        ? addQuarters(base, period.count)
        : addYears(base, period.count);

  return format(next, "yyyy-MM-dd");
}

export function expiryStatus(
  expiry: string,
  today = new Date(),
  soonDays = 7,
): "expired" | "soon" | "normal" {
  const days = differenceInCalendarDays(localDateFromIsoDate(expiry), today);
  if (days < 0) return "expired";
  if (days <= soonDays) return "soon";
  return "normal";
}

export function monthlyPaymentDueDate(
  paymentDay: number,
  today = new Date(),
): string {
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const day = Math.min(paymentDay, lastDay);
  return format(new Date(today.getFullYear(), today.getMonth(), day), "yyyy-MM-dd");
}
