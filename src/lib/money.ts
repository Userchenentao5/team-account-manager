/**
 * Money helpers — integer minor units, currency-aware exponent.
 *
 * Money is always stored as integer minor units (e.g. 1999 = $19.99). The
 * authoritative number of decimal places is the currency's ISO-4217 exponent
 * (`currency.minor_unit`): JPY = 0, USD/CNY/EUR/GBP/HKD = 2. These helpers
 * format/parse keyed by that exponent — never a hardcoded ×100, which would
 * corrupt 0-decimal currencies like JPY (Pattern 3 / Pitfall 3).
 */

/** Format integer minor units to a plain decimal string using the exponent. */
export function formatMinor(amountMinor: number, exponent: number): string {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`amountMinor must be an integer, got: ${amountMinor}`);
  }
  if (!Number.isInteger(exponent) || exponent < 0) {
    throw new Error(`exponent must be a non-negative integer, got: ${exponent}`);
  }
  const sign = amountMinor < 0 ? "-" : "";
  const abs = Math.abs(amountMinor);
  if (exponent === 0) return `${sign}${abs}`;
  const divisor = 10 ** exponent;
  const whole = Math.floor(abs / divisor);
  const frac = abs % divisor;
  return `${sign}${whole}.${String(frac).padStart(exponent, "0")}`;
}

/** Parse a decimal string into integer minor units using the exponent. */
export function parseToMinor(input: string, exponent: number): number {
  if (!Number.isInteger(exponent) || exponent < 0) {
    throw new Error(`exponent must be a non-negative integer, got: ${exponent}`);
  }
  const trimmed = input.trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid money input: "${input}"`);
  }
  const [, sign, whole, fracRaw = ""] = match;
  if (fracRaw.length > exponent) {
    throw new Error(
      `Too many decimal places for exponent ${exponent}: "${input}"`,
    );
  }
  const frac = fracRaw.padEnd(exponent, "0");
  const value = Number(`${whole}${frac}`);
  return sign === "-" ? -value : value;
}
