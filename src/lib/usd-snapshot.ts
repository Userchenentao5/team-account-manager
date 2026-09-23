import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { getCurrencyMinorUnit } from "@/db/currencies";
import { getRate } from "@/db/fxRates";
import { ensureFreshRates } from "@/lib/fx/frankfurter";
import { freezeUsdMinor } from "@/lib/money";

type Db = BetterSQLite3Database<Record<string, unknown>>;

const NO_RATE_ERROR =
  "该币种暂无汇率，无法折算 USD。请先到「汇率」页刷新汇率后重试。";

export type FrozenUsdSnapshot = {
  rateUsed: string;
  rateAsOf: string;
  rateSource: string;
  amountUsd: number;
};

export type FrozenUsdSnapshotResult =
  | ({ ok: true } & FrozenUsdSnapshot)
  | { ok: false; error: string };

/**
 * Freeze an amount into the accounting USD snapshot used by Space and Child
 * Account mutations. Cache freshness, currency precision, missing-rate
 * handling, and rounding stay behind this interface.
 *
 * A zero-value self-use account is the one domain exception: it does not need
 * an FX lookup and records an explicit source for later readers.
 */
export async function freezeUsdSnapshot(
  db: Db,
  input: { amountMinor: number; currencyCode: string },
  options: { zeroAmountSource?: string; now?: Date } = {},
): Promise<FrozenUsdSnapshotResult> {
  const sourceMinorUnit = getCurrencyMinorUnit(db, input.currencyCode);
  if (sourceMinorUnit === undefined) {
    return { ok: false, error: "请选择有效的币种。" };
  }

  if (input.amountMinor === 0 && options.zeroAmountSource) {
    return {
      ok: true,
      rateUsed: "1",
      rateAsOf: (options.now ?? new Date()).toISOString(),
      rateSource: options.zeroAmountSource,
      amountUsd: 0,
    };
  }

  await ensureFreshRates();

  const rate = getRate(db, input.currencyCode);
  if (!rate) {
    return { ok: false, error: NO_RATE_ERROR };
  }

  return {
    ok: true,
    rateUsed: rate.rateToUsd,
    rateAsOf: rate.fetchedAt,
    rateSource: "frankfurter",
    amountUsd: freezeUsdMinor(
      input.amountMinor,
      sourceMinorUnit,
      rate.rateToUsd,
    ),
  };
}
