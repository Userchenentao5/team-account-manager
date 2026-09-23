import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { listChildAccounts, type ChildAccountListRow } from "./childAccounts";
import { listCurrencies } from "./currencies";
import { getRate } from "./fxRates";
import {
  calculateSeatAvailability,
  getSpaceDetail,
  listSpaceDetails,
  type SpaceListFilters,
  type SpaceListRow,
} from "./spaces";
import { formatCurrencyMinor } from "@/lib/currencies";
import { convertUsdMinorToCurrencyMinor } from "@/lib/money";

type Db = BetterSQLite3Database<Record<string, unknown>>;

type CnyReference = {
  currency: ReturnType<typeof listCurrencies>[number] | undefined;
  rate: ReturnType<typeof getRate>;
};

export type SpaceListOverviewRow = SpaceListRow & {
  cnyReference: string;
};

export type SpaceOverview = NonNullable<ReturnType<typeof getSpaceDetail>> & {
  childAccounts: ChildAccountListRow[];
  seatAvailability: ReturnType<typeof calculateSeatAvailability>;
  cnyReference: string;
};

function getCnyReference(db: Db): CnyReference {
  return {
    currency: listCurrencies(db).find((item) => item.code === "CNY"),
    rate: getRate(db, "CNY"),
  };
}

function formatCnyReference(
  amountUsd: number | null,
  reference: CnyReference,
): string {
  if (amountUsd === null || !reference.currency || !reference.rate) {
    return "暂无 CNY 参考";
  }

  return formatCurrencyMinor(
    convertUsdMinorToCurrencyMinor(
      amountUsd,
      reference.currency.minorUnit,
      reference.rate.rateToUsd,
    ),
    reference.currency,
  );
}

/**
 * Read model for the space list. It keeps account-derived seat facts and the
 * current CNY display reference beside the Space row consumed by the table.
 */
export function listSpaceOverview(
  db: Db,
  filters: SpaceListFilters = {},
): SpaceListOverviewRow[] {
  const reference = getCnyReference(db);
  return listSpaceDetails(db, filters).map((row) => ({
    ...row,
    cnyReference: formatCnyReference(row.space.amountUsd, reference),
  }));
}

/**
 * Read model for the space detail page. The page receives one coherent
 * projection instead of independently loading children and recalculating
 * seat availability and CNY display values.
 */
export function getSpaceOverview(
  db: Db,
  id: number,
): SpaceOverview | undefined {
  const detail = getSpaceDetail(db, id);
  if (!detail) return undefined;

  const childAccounts = listChildAccounts(db, id);
  const reference = getCnyReference(db);
  return {
    ...detail,
    childAccounts,
    seatAvailability: calculateSeatAvailability(detail.space.seatCapacity, [
      detail.motherAccount.seatType,
      ...childAccounts.map(({ childAccount }) => childAccount.seatType),
    ]),
    cnyReference: formatCnyReference(detail.space.amountUsd, reference),
  };
}
