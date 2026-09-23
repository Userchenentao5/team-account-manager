import { format } from "date-fns";

/**
 * Space lifecycle timestamps are local wall-clock values. They intentionally
 * have no timezone suffix because they describe the time entered by the
 * operator in the space form.
 */
export const SPACE_DATE_TIME_INPUT_FORMAT = "yyyy-MM-dd'T'HH:mm:ss";
const SPACE_DATE_TIME_DISPLAY_FORMAT = "yyyy-MM-dd HH:mm:ss";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})$/;

function localDateFromParts(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date | null {
  const date = new Date(year, month - 1, day, hour, minute, second);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return null;
  }
  return date;
}

/**
 * Parses both the canonical local datetime and legacy date-only values.
 * Legacy values represent midnight so existing rows remain readable while
 * they are migrated or next saved.
 */
export function parseSpaceDateTime(value: string): Date | null {
  const dateTimeMatch = value.match(DATE_TIME_PATTERN);
  if (dateTimeMatch) {
    const [, year, month, day, hour, minute, second] = dateTimeMatch;
    return localDateFromParts(
      Number(year),
      Number(month),
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
  }

  const dateOnlyMatch = value.match(DATE_ONLY_PATTERN);
  if (!dateOnlyMatch) return null;

  const [, year, month, day] = dateOnlyMatch;
  return localDateFromParts(Number(year), Number(month), Number(day));
}

export function spaceDateTimeToDate(value: string): Date {
  const date = parseSpaceDateTime(value);
  if (!date) {
    throw new Error(`Invalid space date-time: ${value}`);
  }
  return date;
}

export function isValidSpaceDateTime(value: string): boolean {
  return parseSpaceDateTime(value) !== null;
}

/** Converts a database value to the exact format expected by datetime-local. */
export function toSpaceDateTimeInput(
  value: string | null | undefined,
): string {
  if (!value) return "";
  const date = parseSpaceDateTime(value);
  return date ? format(date, SPACE_DATE_TIME_INPUT_FORMAT) : value;
}

/** Stores a valid legacy or datetime-local value in canonical form. */
export function toSpaceDateTimeStorage(value: string): string {
  return format(spaceDateTimeToDate(value), SPACE_DATE_TIME_INPUT_FORMAT);
}

/** Formats a database value for user-facing space lifecycle displays. */
export function formatSpaceDateTime(
  value: string | null | undefined,
): string {
  if (!value) return "-";
  const date = parseSpaceDateTime(value);
  return date ? format(date, SPACE_DATE_TIME_DISPLAY_FORMAT) : value;
}

export function currentSpaceDateTimeInput(now = new Date()): string {
  return format(now, SPACE_DATE_TIME_INPUT_FORMAT);
}
