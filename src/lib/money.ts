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

/**
 * Freeze an original amount into USD minor units using an X→USD decimal string.
 *
 * Formula: round(amountMinor * rateToUsd * 10^(usdExp - srcExp)).
 * All scaling is done with BigInt so currency conversion never uses floats.
 */
export function freezeUsdMinor(
  amountMinor: number,
  srcExp: number,
  rateToUsd: string,
  usdExp = 2,
): number {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`amountMinor must be an integer, got: ${amountMinor}`);
  }
  if (!Number.isInteger(srcExp) || srcExp < 0) {
    throw new Error(`srcExp must be a non-negative integer, got: ${srcExp}`);
  }
  if (!Number.isInteger(usdExp) || usdExp < 0) {
    throw new Error(`usdExp must be a non-negative integer, got: ${usdExp}`);
  }

  const trimmed = rateToUsd.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid USD rate: "${rateToUsd}"`);
  }

  const [, whole, frac = ""] = match;
  const zero = BigInt(0);
  const one = BigInt(1);
  const two = BigInt(2);
  const ten = BigInt(10);
  const rateInt = BigInt(`${whole}${frac}`);
  if (rateInt <= zero) {
    throw new Error(`USD rate must be positive, got: "${rateToUsd}"`);
  }

  let num = BigInt(Math.abs(amountMinor)) * rateInt;
  let den = ten ** BigInt(frac.length);
  const exponentDelta = usdExp - srcExp;

  if (exponentDelta >= 0) {
    num *= ten ** BigInt(exponentDelta);
  } else {
    den *= ten ** BigInt(-exponentDelta);
  }

  const quotient = num / den;
  const remainder = num % den;
  const rounded = remainder * two >= den ? quotient + one : quotient;
  return amountMinor < 0 ? -Number(rounded) : Number(rounded);
}

/**
 * Convert frozen USD minor units into a target currency's minor units.
 *
 * `rateToUsd` is the target currency's X→USD rate. To show CNY from USD, divide
 * by CNY→USD, then scale from USD exponent to the target exponent.
 */
export function convertUsdMinorToCurrencyMinor(
  usdMinor: number,
  targetExp: number,
  rateToUsd: string,
  usdExp = 2,
): number {
  if (!Number.isInteger(usdMinor)) {
    throw new Error(`usdMinor must be an integer, got: ${usdMinor}`);
  }
  if (!Number.isInteger(targetExp) || targetExp < 0) {
    throw new Error(
      `targetExp must be a non-negative integer, got: ${targetExp}`,
    );
  }
  if (!Number.isInteger(usdExp) || usdExp < 0) {
    throw new Error(`usdExp must be a non-negative integer, got: ${usdExp}`);
  }

  const trimmed = rateToUsd.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid target rate: "${rateToUsd}"`);
  }

  const [, whole, frac = ""] = match;
  const zero = BigInt(0);
  const one = BigInt(1);
  const two = BigInt(2);
  const ten = BigInt(10);
  const rateInt = BigInt(`${whole}${frac}`);
  if (rateInt <= zero) {
    throw new Error(`Target rate must be positive, got: "${rateToUsd}"`);
  }

  let num = BigInt(Math.abs(usdMinor)) * (ten ** BigInt(frac.length));
  let den = rateInt;
  const exponentDelta = targetExp - usdExp;

  if (exponentDelta >= 0) {
    num *= ten ** BigInt(exponentDelta);
  } else {
    den *= ten ** BigInt(-exponentDelta);
  }

  const quotient = num / den;
  const remainder = num % den;
  const rounded = remainder * two >= den ? quotient + one : quotient;
  return usdMinor < 0 ? -Number(rounded) : Number(rounded);
}
