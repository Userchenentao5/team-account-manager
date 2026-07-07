import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { differenceInCalendarDays } from "date-fns";
import { formatCountryLabel } from "@/lib/countries";
import { expiryStatus, nextPaymentDueDate, type Period } from "@/lib/expiry";
import { getStatusThresholds, type StatusThresholds } from "./settings";
import {
  childAccount,
  currency,
  motherAccount,
  paymentChannel,
  space,
} from "./schema";

type Db = BetterSQLite3Database<Record<string, unknown>>;

type ExpiryStatus = ReturnType<typeof expiryStatus>;
type ChildExpiryStatus = Exclude<
  ReturnType<typeof expiryStatus>,
  "normal"
>;

const SELF_USE_RATE_SOURCE = "self-use";

export type DashboardExpiringSpaceRow = {
  id: number;
  name: string;
  country: string;
  paymentChannelName: string;
  expiryDate: string;
  daysUntilExpiry: number;
  status: Exclude<ExpiryStatus, "normal">;
  amountUsdMinor: number;
  childAccountCount: number;
};

export type DashboardExpiringChildAccountRow = {
  id: number;
  spaceId: number;
  email: string;
  label: string;
  contact: string;
  seatType: string;
  spaceName: string;
  nextPaymentDate: string;
  daysUntilExpiry: number;
  status: ChildExpiryStatus;
  revenueUsdMinor: number;
};

export type DashboardSpendBucket = {
  key: string;
  label: string;
  usdMinor: number;
  percentage: number;
};

export type DashboardCountSummary = {
  spacesByExpiryStatus: {
    expired: number;
    soon: number;
    normal: number;
  };
  childAccountsBySeatType: {
    codex: number;
    chatgpt: number;
  };
  motherAccountsBySeatType: {
    codex: number;
    chatgpt: number;
  };
  allAccountsBySeatType: {
    codex: number;
    chatgpt: number;
  };
  childAccountsByUse: {
    selfUse: number;
    rented: number;
  };
  childAccountsByExpiryStatus: {
    expired: number;
    due: number;
    soon: number;
    normal: number;
  };
};

export type DashboardOverview = {
  totals: {
    renewalRiskSpaces: number;
    renewalRiskChildAccounts: number;
    grossCashflowUsdMinor: number;
    spacePaymentUsdMinor: number;
    childMonthlyRevenueUsdMinor: number;
    netMonthlyUsdMinor: number;
    totalSpaces: number;
    totalChildAccounts: number;
    rentedChildAccounts: number;
    selfUseChildAccounts: number;
  };
  expiringSpaces: DashboardExpiringSpaceRow[];
  expiringChildAccounts: DashboardExpiringChildAccountRow[];
  distributions: {
    byCountry: DashboardSpendBucket[];
    byCurrency: DashboardSpendBucket[];
    byPaymentChannel: DashboardSpendBucket[];
    spendingByPaymentChannel: DashboardSpendBucket[];
    spendingBySpace: DashboardSpendBucket[];
  };
  counts: DashboardCountSummary;
  thresholds: StatusThresholds;
};

type SpaceDashboardRow = {
  id: number;
  name: string;
  country: string;
  currencyCode: string;
  amountUsd: number | null;
  expiryDate: string | null;
  paymentChannelId: number;
  paymentChannelName: string;
};

type ChildDashboardRow = {
  id: number;
  spaceId: number;
  email: string;
  label: string;
  contact: string;
  seatType: string;
  joinedDate: string;
  monthlyCurrencyCode: string;
  monthlyAmountUsd: number;
  monthlyRateSource: string;
  monthlyPaymentDay: number;
  billingPeriodUnit: string;
  billingPeriodCount: number;
  nextPaymentDate: string | null;
  spaceName: string;
  spaceCountry: string;
  paymentChannelId: number;
  paymentChannelName: string;
};

type MotherDashboardRow = {
  seatType: string;
};

type BucketSeed = {
  key: string;
  label: string;
  usdMinor: number;
};

function addBucket(
  buckets: Map<string, BucketSeed>,
  key: string,
  label: string,
  usdMinor: number,
) {
  const current = buckets.get(key);
  if (current) {
    current.usdMinor += usdMinor;
    return;
  }
  buckets.set(key, { key, label, usdMinor });
}

function toBuckets(
  buckets: Map<string, BucketSeed>,
  totalUsdMinor: number,
): DashboardSpendBucket[] {
  return Array.from(buckets.values())
    .filter((bucket) => bucket.usdMinor !== 0)
    .sort((left, right) => {
      const byAmount = right.usdMinor - left.usdMinor;
      return byAmount !== 0 ? byAmount : left.label.localeCompare(right.label);
    })
    .map((bucket) => ({
      ...bucket,
      percentage:
        totalUsdMinor === 0
          ? 0
          : Number(((bucket.usdMinor / totalUsdMinor) * 100).toFixed(1)),
    }));
}

function statusWeight(status: ExpiryStatus) {
  if (status === "expired") return 0;
  if (status === "due") return 1;
  if (status === "soon") return 1;
  return 2;
}

function localDateFromIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function daysUntilExpiry(expiryDate: string, today: Date): number {
  return differenceInCalendarDays(localDateFromIsoDate(expiryDate), today);
}

function childBillingPeriod(row: ChildDashboardRow): Period {
  return {
    unit: row.billingPeriodUnit as Period["unit"],
    count: row.billingPeriodCount,
  };
}

function childNextPaymentDate(row: ChildDashboardRow): string {
  return (
    row.nextPaymentDate ??
    nextPaymentDueDate(row.monthlyPaymentDay, childBillingPeriod(row), row.joinedDate)
  );
}

function isSelfUseChild(row: ChildDashboardRow): boolean {
  return row.monthlyRateSource === SELF_USE_RATE_SOURCE || row.monthlyAmountUsd === 0;
}

/**
 * DASH-01..04 — read-only aggregate facade for the root dashboard.
 *
 * Space payments and child monthly costs are read as separate cost classes and
 * merged after the fact. Do not sum `space.amountUsd` through a child join.
 */
export function getDashboardOverview(
  db: Db,
  today = new Date(),
): DashboardOverview {
  const thresholds = getStatusThresholds(db);
  const spaceRows: SpaceDashboardRow[] = db
    .select({
      id: space.id,
      name: space.name,
      country: space.country,
      currencyCode: currency.code,
      amountUsd: space.amountUsd,
      expiryDate: space.expiryDate,
      paymentChannelId: paymentChannel.id,
      paymentChannelName: paymentChannel.name,
    })
    .from(space)
    .innerJoin(paymentChannel, eq(paymentChannel.id, space.paymentChannelId))
    .innerJoin(currency, eq(currency.code, space.currencyCode))
    .all();

  const childRows: ChildDashboardRow[] = db
    .select({
      id: childAccount.id,
      spaceId: childAccount.spaceId,
      email: childAccount.email,
      label: childAccount.label,
      contact: childAccount.contact,
      seatType: childAccount.seatType,
      joinedDate: childAccount.joinedDate,
      monthlyCurrencyCode: childAccount.monthlyCurrencyCode,
      monthlyAmountUsd: childAccount.monthlyAmountUsd,
      monthlyRateSource: childAccount.monthlyRateSource,
      monthlyPaymentDay: childAccount.monthlyPaymentDay,
      billingPeriodUnit: childAccount.billingPeriodUnit,
      billingPeriodCount: childAccount.billingPeriodCount,
      nextPaymentDate: childAccount.nextPaymentDate,
      spaceName: space.name,
      spaceCountry: space.country,
      paymentChannelId: paymentChannel.id,
      paymentChannelName: paymentChannel.name,
    })
    .from(childAccount)
    .innerJoin(space, eq(space.id, childAccount.spaceId))
    .innerJoin(paymentChannel, eq(paymentChannel.id, space.paymentChannelId))
    .all();

  const motherRows: MotherDashboardRow[] = db
    .select({
      seatType: motherAccount.seatType,
    })
    .from(motherAccount)
    .all();

  const counts: DashboardCountSummary = {
    spacesByExpiryStatus: {
      expired: 0,
      soon: 0,
      normal: 0,
    },
    childAccountsBySeatType: {
      codex: 0,
      chatgpt: 0,
    },
    motherAccountsBySeatType: {
      codex: 0,
      chatgpt: 0,
    },
    allAccountsBySeatType: {
      codex: 0,
      chatgpt: 0,
    },
    childAccountsByUse: {
      selfUse: 0,
      rented: 0,
    },
    childAccountsByExpiryStatus: {
      expired: 0,
      due: 0,
      soon: 0,
      normal: 0,
    },
  };
  const countryBuckets = new Map<string, BucketSeed>();
  const currencyBuckets = new Map<string, BucketSeed>();
  const paymentChannelBuckets = new Map<string, BucketSeed>();
  const spendingByPaymentChannelBuckets = new Map<string, BucketSeed>();
  const spendingBySpaceBuckets = new Map<string, BucketSeed>();
  const childCountBySpace = new Map<number, number>();

  for (const row of childRows) {
    childCountBySpace.set(
      row.spaceId,
      (childCountBySpace.get(row.spaceId) ?? 0) + 1,
    );
  }

  let spacePaymentUsdMinor = 0;
  const expiringSpaces: DashboardExpiringSpaceRow[] = [];

  for (const row of spaceRows) {
    const amountUsdMinor = row.amountUsd ?? 0;
    spacePaymentUsdMinor += amountUsdMinor;
    addBucket(
      countryBuckets,
      row.country,
      formatCountryLabel(row.country),
      amountUsdMinor,
    );
    addBucket(currencyBuckets, row.currencyCode, row.currencyCode, amountUsdMinor);
    addBucket(
      paymentChannelBuckets,
      String(row.paymentChannelId),
      row.paymentChannelName,
      amountUsdMinor,
    );
    addBucket(
      spendingByPaymentChannelBuckets,
      String(row.paymentChannelId),
      row.paymentChannelName,
      amountUsdMinor,
    );
    addBucket(
      spendingBySpaceBuckets,
      String(row.id),
      row.name,
      amountUsdMinor,
    );

    if (!row.expiryDate) {
      counts.spacesByExpiryStatus.normal += 1;
      continue;
    }

    const status = expiryStatus(row.expiryDate, today, thresholds.spaceSoonDays);
    counts.spacesByExpiryStatus[status] += 1;
    if (status !== "normal") {
      expiringSpaces.push({
        id: row.id,
        name: row.name,
        country: formatCountryLabel(row.country),
        paymentChannelName: row.paymentChannelName,
        expiryDate: row.expiryDate,
        daysUntilExpiry: daysUntilExpiry(row.expiryDate, today),
        status,
        amountUsdMinor,
        childAccountCount: childCountBySpace.get(row.id) ?? 0,
      });
    }
  }

  let childMonthlyRevenueUsdMinor = 0;
  const expiringChildAccounts: DashboardExpiringChildAccountRow[] = [];

  for (const row of childRows) {
    const selfUse = isSelfUseChild(row);

    if (selfUse) {
      counts.childAccountsByUse.selfUse += 1;
    } else {
      counts.childAccountsByUse.rented += 1;
      childMonthlyRevenueUsdMinor += row.monthlyAmountUsd;
    }

    addBucket(
      countryBuckets,
      row.spaceCountry,
      formatCountryLabel(row.spaceCountry),
      row.monthlyAmountUsd,
    );
    addBucket(
      currencyBuckets,
      row.monthlyCurrencyCode,
      row.monthlyCurrencyCode,
      row.monthlyAmountUsd,
    );
    addBucket(
      paymentChannelBuckets,
      String(row.paymentChannelId),
      row.paymentChannelName,
      row.monthlyAmountUsd,
    );

    if (row.seatType === "chatgpt") {
      counts.childAccountsBySeatType.chatgpt += 1;
      counts.allAccountsBySeatType.chatgpt += 1;
    } else {
      counts.childAccountsBySeatType.codex += 1;
      counts.allAccountsBySeatType.codex += 1;
    }

    if (!selfUse) {
      const nextPaymentDate = childNextPaymentDate(row);
      const status = expiryStatus(
        nextPaymentDate,
        today,
        thresholds.childAccountSoonDays,
        true,
      );
      counts.childAccountsByExpiryStatus[status] += 1;

      if (status !== "normal") {
        expiringChildAccounts.push({
          id: row.id,
          spaceId: row.spaceId,
          email: row.email,
          label: row.label,
          contact: row.contact,
          seatType: row.seatType,
          spaceName: row.spaceName,
          nextPaymentDate,
          daysUntilExpiry: daysUntilExpiry(nextPaymentDate, today),
          status,
          revenueUsdMinor: row.monthlyAmountUsd,
        });
      }
    }
  }

  for (const row of motherRows) {
    if (row.seatType === "chatgpt") {
      counts.motherAccountsBySeatType.chatgpt += 1;
      counts.allAccountsBySeatType.chatgpt += 1;
    } else {
      counts.motherAccountsBySeatType.codex += 1;
      counts.allAccountsBySeatType.codex += 1;
    }
  }

  expiringSpaces.sort((left, right) => {
    const byStatus = statusWeight(left.status) - statusWeight(right.status);
    if (byStatus !== 0) return byStatus;
    return left.expiryDate.localeCompare(right.expiryDate);
  });

  expiringChildAccounts.sort((left, right) => {
    const byStatus = statusWeight(left.status) - statusWeight(right.status);
    if (byStatus !== 0) return byStatus;
    return left.nextPaymentDate.localeCompare(right.nextPaymentDate);
  });

  const grossCashflowUsdMinor =
    spacePaymentUsdMinor + childMonthlyRevenueUsdMinor;
  const netMonthlyUsdMinor = childMonthlyRevenueUsdMinor - spacePaymentUsdMinor;

  return {
    totals: {
      renewalRiskSpaces: expiringSpaces.length,
      renewalRiskChildAccounts: expiringChildAccounts.length,
      grossCashflowUsdMinor,
      spacePaymentUsdMinor,
      childMonthlyRevenueUsdMinor,
      netMonthlyUsdMinor,
      totalSpaces: spaceRows.length,
      totalChildAccounts: childRows.length,
      rentedChildAccounts: counts.childAccountsByUse.rented,
      selfUseChildAccounts: counts.childAccountsByUse.selfUse,
    },
    expiringSpaces,
    expiringChildAccounts,
    distributions: {
      byCountry: toBuckets(countryBuckets, grossCashflowUsdMinor),
      byCurrency: toBuckets(currencyBuckets, grossCashflowUsdMinor),
      byPaymentChannel: toBuckets(paymentChannelBuckets, grossCashflowUsdMinor),
      spendingByPaymentChannel: toBuckets(
        spendingByPaymentChannelBuckets,
        spacePaymentUsdMinor,
      ),
      spendingBySpace: toBuckets(spendingBySpaceBuckets, spacePaymentUsdMinor),
    },
    counts,
    thresholds,
  };
}
