import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { expiryStatus } from "@/lib/expiry";
import { childAccount, currency, paymentChannel, space } from "./schema";

type Db = BetterSQLite3Database<Record<string, unknown>>;

type ExpiryStatus = ReturnType<typeof expiryStatus>;

export type DashboardExpiringSpaceRow = {
  id: number;
  name: string;
  country: string;
  paymentChannelName: string;
  expiryDate: string;
  status: Exclude<ExpiryStatus, "normal">;
  amountUsdMinor: number;
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
};

export type DashboardOverview = {
  totals: {
    renewalRiskSpaces: number;
    totalUsdMinor: number;
    spacePaymentUsdMinor: number;
    childMonthlyUsdMinor: number;
    totalSpaces: number;
    totalChildAccounts: number;
  };
  expiringSpaces: DashboardExpiringSpaceRow[];
  distributions: {
    byCountry: DashboardSpendBucket[];
    byCurrency: DashboardSpendBucket[];
    byPaymentChannel: DashboardSpendBucket[];
  };
  counts: DashboardCountSummary;
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
  seatType: string;
  monthlyCurrencyCode: string;
  monthlyAmountUsd: number;
  spaceCountry: string;
  paymentChannelId: number;
  paymentChannelName: string;
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
  if (status === "soon") return 1;
  return 2;
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
      seatType: childAccount.seatType,
      monthlyCurrencyCode: childAccount.monthlyCurrencyCode,
      monthlyAmountUsd: childAccount.monthlyAmountUsd,
      spaceCountry: space.country,
      paymentChannelId: paymentChannel.id,
      paymentChannelName: paymentChannel.name,
    })
    .from(childAccount)
    .innerJoin(space, eq(space.id, childAccount.spaceId))
    .innerJoin(paymentChannel, eq(paymentChannel.id, space.paymentChannelId))
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
  };
  const countryBuckets = new Map<string, BucketSeed>();
  const currencyBuckets = new Map<string, BucketSeed>();
  const paymentChannelBuckets = new Map<string, BucketSeed>();

  let spacePaymentUsdMinor = 0;
  const expiringSpaces: DashboardExpiringSpaceRow[] = [];

  for (const row of spaceRows) {
    const amountUsdMinor = row.amountUsd ?? 0;
    spacePaymentUsdMinor += amountUsdMinor;
    addBucket(countryBuckets, row.country, row.country, amountUsdMinor);
    addBucket(currencyBuckets, row.currencyCode, row.currencyCode, amountUsdMinor);
    addBucket(
      paymentChannelBuckets,
      String(row.paymentChannelId),
      row.paymentChannelName,
      amountUsdMinor,
    );

    if (!row.expiryDate) {
      counts.spacesByExpiryStatus.normal += 1;
      continue;
    }

    const status = expiryStatus(row.expiryDate, today);
    counts.spacesByExpiryStatus[status] += 1;
    if (status !== "normal") {
      expiringSpaces.push({
        id: row.id,
        name: row.name,
        country: row.country,
        paymentChannelName: row.paymentChannelName,
        expiryDate: row.expiryDate,
        status,
        amountUsdMinor,
      });
    }
  }

  let childMonthlyUsdMinor = 0;
  for (const row of childRows) {
    childMonthlyUsdMinor += row.monthlyAmountUsd;
    addBucket(countryBuckets, row.spaceCountry, row.spaceCountry, row.monthlyAmountUsd);
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
    } else {
      counts.childAccountsBySeatType.codex += 1;
    }
  }

  expiringSpaces.sort((left, right) => {
    const byStatus = statusWeight(left.status) - statusWeight(right.status);
    if (byStatus !== 0) return byStatus;
    return left.expiryDate.localeCompare(right.expiryDate);
  });

  const totalUsdMinor = spacePaymentUsdMinor + childMonthlyUsdMinor;

  return {
    totals: {
      renewalRiskSpaces: expiringSpaces.length,
      totalUsdMinor,
      spacePaymentUsdMinor,
      childMonthlyUsdMinor,
      totalSpaces: spaceRows.length,
      totalChildAccounts: childRows.length,
    },
    expiringSpaces,
    distributions: {
      byCountry: toBuckets(countryBuckets, totalUsdMinor),
      byCurrency: toBuckets(currencyBuckets, totalUsdMinor),
      byPaymentChannel: toBuckets(paymentChannelBuckets, totalUsdMinor),
    },
    counts,
  };
}
