export const RATE_BASES = ["USD", "CNY"] as const;

export type RateBase = (typeof RATE_BASES)[number];

export const DEFAULT_RATE_BASE: RateBase = "USD";

export function isRateBase(value: unknown): value is RateBase {
  return typeof value === "string" && RATE_BASES.includes(value as RateBase);
}

export function parseRateBase(value: unknown): RateBase {
  return isRateBase(value) ? value : DEFAULT_RATE_BASE;
}
