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

export type ExpiryStatus = "expired" | "soon" | "normal";
export type ExpiryStatusWithDue = ExpiryStatus | "due";

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
  today?: Date,
  soonDays?: number,
  expireOnDate?: false,
): ExpiryStatus;
export function expiryStatus(
  expiry: string,
  today: Date | undefined,
  soonDays: number | undefined,
  expireOnDate: true,
): ExpiryStatusWithDue;
export function expiryStatus(
  expiry: string,
  today: Date | undefined,
  soonDays: number | undefined,
  expireOnDate: boolean,
): ExpiryStatusWithDue;
export function expiryStatus(
  expiry: string,
  today = new Date(),
  soonDays = 7,
  expireOnDate = false,
): ExpiryStatusWithDue {
  const days = differenceInCalendarDays(localDateFromIsoDate(expiry), today);
  if (days < 0) return "expired";
  if (expireOnDate && days === 0) return "due";
  if (days <= soonDays) return "soon";
  return "normal";
}

export function monthlyPaymentDueDate(
  paymentDay: number,
  today = new Date(),
): string {
  return format(paymentDateInMonth(today, paymentDay), "yyyy-MM-dd");
}

export function nextMonthlyPaymentDueDate(
  paymentDay: number,
  from: string | Date = new Date(),
): string {
  return nextPaymentDueDate(paymentDay, { unit: "month", count: 1 }, from);
}

function addPeriodToDate(base: Date, period: Period): Date {
  return period.unit === "month"
    ? addMonths(base, period.count)
    : period.unit === "quarter"
      ? addQuarters(base, period.count)
      : addYears(base, period.count);
}

function paymentDateInMonth(base: Date, paymentDay: number): Date {
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const day = Math.min(paymentDay, lastDay);
  return new Date(base.getFullYear(), base.getMonth(), day);
}

export function nextPaymentDueDate(
  paymentDay: number,
  period: Period,
  from: string | Date = new Date(),
): string {
  const base = typeof from === "string" ? localDateFromIsoDate(from) : from;
  const dueThisMonth = paymentDateInMonth(base, paymentDay);
  const due =
    differenceInCalendarDays(dueThisMonth, base) <= 0
      ? paymentDateInMonth(addPeriodToDate(dueThisMonth, period), paymentDay)
      : dueThisMonth;

  return format(due, "yyyy-MM-dd");
}

export function renewMonthlyPaymentDueDate(
  paymentDay: number,
  currentDueDate?: string | null,
  today = new Date(),
): string {
  return renewPaymentDueDate(
    paymentDay,
    { unit: "month", count: 1 },
    currentDueDate,
    today,
  );
}

export function renewPaymentDueDate(
  paymentDay: number,
  period: Period,
  currentDueDate?: string | null,
  today = new Date(),
): string {
  const todayIso = format(today, "yyyy-MM-dd");
  const base = currentDueDate && currentDueDate > todayIso ? currentDueDate : today;
  return nextPaymentDueDate(paymentDay, period, base);
}
