import Link from "next/link";
import { db } from "@/db";
import { getCurrencyMinorUnit } from "@/db/currencies";
import { getDashboardOverview } from "@/db/dashboard";
import { getRate } from "@/db/fxRates";
import { convertUsdMinorToCurrencyMinor, formatMinor } from "@/lib/money";
import { DistributionList } from "@/components/dashboard/distribution-list";
import { MetricCard } from "@/components/dashboard/metric-card";
import { SpacePerformanceList } from "@/components/dashboard/space-performance-list";
import { Button } from "@/components/ui/button";

// better-sqlite3 is a native module - keep this RSC on the Node runtime.
export const dynamic = "force-dynamic";

function usd(amountMinor: number) {
  const sign = amountMinor < 0 ? "-" : "";
  return `${sign}$${formatMinor(Math.abs(amountMinor), 2)} USD`;
}

type CnyDisplayRate = {
  minorUnit: number;
  rateToUsd: string;
};

function cnyFromUsd(amountMinor: number, cnyRate: CnyDisplayRate | null) {
  if (!cnyRate) return null;
  const cnyMinor = convertUsdMinorToCurrencyMinor(
    amountMinor,
    cnyRate.minorUnit,
    cnyRate.rateToUsd,
  );
  const sign = cnyMinor < 0 ? "-" : "";
  return `${sign}¥${formatMinor(Math.abs(cnyMinor), cnyRate.minorUnit)} CNY`;
}

export default function DashboardPage() {
  const overview = getDashboardOverview(db);
  const { totals, counts, distributions, spacePerformance, thresholds } =
    overview;
  const cnyRateRow = getRate(db, "CNY");
  const cnyMinorUnit = getCurrencyMinorUnit(db, "CNY");
  const cnyRate =
    cnyRateRow && cnyMinorUnit !== undefined
      ? { minorUnit: cnyMinorUnit, rateToUsd: cnyRateRow.rateToUsd }
      : null;
  const receivableCny = cnyFromUsd(totals.childMonthlyRevenueUsdMinor, cnyRate);
  const netCny = cnyFromUsd(totals.netMonthlyUsdMinor, cnyRate);
  const spacePerformanceDisplay = spacePerformance.map((item) => ({
    ...item,
    netCny: cnyFromUsd(item.netUsdMinor, cnyRate),
  }));
  const hasAnyRisk =
    totals.renewalRiskSpaces > 0 || totals.renewalRiskChildAccounts > 0;
  const renewalRiskCount =
    totals.renewalRiskSpaces + totals.renewalRiskChildAccounts;
  const spaceUrgentRiskCount = counts.spacesByExpiryStatus.expired;
  const spaceUpcomingRiskCount = counts.spacesByExpiryStatus.soon;
  const childAccountUrgentRiskCount =
    counts.childAccountsByExpiryStatus.expired +
    counts.childAccountsByExpiryStatus.due;
  const childAccountUpcomingRiskCount = counts.childAccountsByExpiryStatus.soon;
  const urgentRiskCount = spaceUrgentRiskCount + childAccountUrgentRiskCount;
  const upcomingRiskCount =
    spaceUpcomingRiskCount + childAccountUpcomingRiskCount;
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-5 border-b border-border/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight">仪表盘</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            先处理续费风险，再核对本期成本与应收。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button asChild variant="outline" className="w-fit">
            <Link href="/spaces">管理空间</Link>
          </Button>
        </div>
      </header>

      {totals.totalSpaces === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 px-6 py-14 text-center">
          <h2 className="text-base font-semibold">还没有空间数据</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            先到空间列表新增空间。仪表盘会在有数据后显示空间支出、出租账号收入和到期风险。
          </p>
          <Button asChild variant="outline">
            <Link href="/spaces">前往空间列表</Link>
          </Button>
        </div>
      ) : (
        <main className="space-y-8 py-6">
          <section
            aria-label="重点概览"
            className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]"
          >
            <div
              id="renewal-risk"
              className="flex h-full scroll-mt-20 flex-col overflow-hidden rounded-lg border bg-card"
            >
              <div className="flex flex-col items-start gap-3 border-b border-border/70 bg-muted/25 px-5 py-4 sm:flex-row sm:justify-between sm:px-6">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    续费控制台
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    只汇总到期风险，不在仪表盘展开明细。
                  </p>
                </div>
                <span
                  className={
                    hasAnyRisk
                      ? "shrink-0 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-destructive"
                      : "shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-primary"
                  }
                >
                  {hasAnyRisk ? `待处理 ${renewalRiskCount}` : "当前清零"}
                </span>
              </div>
              <div className="flex flex-1 flex-col">
                <div className="grid gap-5 border-b border-border/70 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:px-6">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      全部到期风险
                    </p>
                    <p className="mt-2 font-mono text-4xl font-semibold tracking-tight tabular-nums">
                      {renewalRiskCount}
                      <span className="ml-1.5 font-sans text-sm font-normal text-muted-foreground">
                        项
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {hasAnyRisk
                        ? "先处理已过期和今日到期，再安排近期续费。"
                        : "当前没有已过期或近期到期项目。"}
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 sm:min-w-56">
                    <div className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2.5">
                      <dt className="text-xs font-medium text-destructive">
                        需立即处理
                      </dt>
                      <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-destructive">
                        {urgentRiskCount}
                      </dd>
                    </div>
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
                      <dt className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        近期关注
                      </dt>
                      <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                        {upcomingRiskCount}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="grid divide-y divide-border/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  <div className="px-5 py-4 sm:px-6">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-sm font-semibold">空间订阅</h3>
                      <span
                        className={`font-mono text-lg font-semibold tabular-nums ${
                          spaceUrgentRiskCount > 0
                            ? "text-destructive"
                            : spaceUpcomingRiskCount > 0
                              ? "text-amber-700 dark:text-amber-300"
                              : "text-foreground"
                        }`}
                      >
                        {totals.renewalRiskSpaces}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      已过期{" "}
                      <span className="font-mono font-semibold tabular-nums text-destructive">
                        {spaceUrgentRiskCount}
                      </span>{" "}
                      · {thresholds.spaceSoonDays} 天内{" "}
                      <span className="font-mono font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                        {spaceUpcomingRiskCount}
                      </span>
                    </p>
                  </div>
                  <div className="px-5 py-4 sm:px-6">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-sm font-semibold">出租账号收款</h3>
                      <span
                        className={`font-mono text-lg font-semibold tabular-nums ${
                          childAccountUrgentRiskCount > 0
                            ? "text-destructive"
                            : childAccountUpcomingRiskCount > 0
                              ? "text-amber-700 dark:text-amber-300"
                              : "text-foreground"
                        }`}
                      >
                        {totals.renewalRiskChildAccounts}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      逾期{" "}
                      <span className="font-mono font-semibold tabular-nums text-destructive">
                        {counts.childAccountsByExpiryStatus.expired}
                      </span>{" "}
                      · 今日{" "}
                      <span className="font-mono font-semibold tabular-nums text-destructive">
                        {counts.childAccountsByExpiryStatus.due}
                      </span>{" "}
                      · {thresholds.childAccountSoonDays} 天内{" "}
                      <span className="font-mono font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                        {childAccountUpcomingRiskCount}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="mt-auto flex flex-col gap-3 border-t border-border/70 bg-muted/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <p className="text-xs leading-5 text-muted-foreground">
                    空间管理默认按到期日排序，可继续查看并处理具体项目。
                  </p>
                  <Button asChild size="sm" variant={hasAnyRisk ? "default" : "outline"}>
                    <Link href={hasAnyRisk ? "/renewal-risks" : "/spaces"}>
                      {hasAnyRisk ? "前往处理风险" : "查看空间"}
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-primary/20 bg-accent/25 p-5 sm:p-6">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">本期现金流</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  空间订阅是你的成本，出租子账号构成应收收入。
                </p>
              </div>
              <div className="mt-6 grid gap-x-7 gap-y-6 sm:grid-cols-2">
                <MetricCard
                  label="空间支出"
                  value={usd(totals.spacePaymentUsdMinor)}
                  tone="expense"
                  description="所有空间的冻结 USD 成本"
                />
                <MetricCard
                  label="出租账号应收"
                  value={usd(totals.childMonthlyRevenueUsdMinor)}
                  tone="income"
                  description={receivableCny ? `折合 ${receivableCny}` : "CNY 汇率缺失"}
                />
              </div>
              <div className="mt-5 border-t border-primary/15 pt-4">
                <p className="text-xs text-muted-foreground">预计净收入</p>
                <p
                  className={`mt-2 font-mono text-xl font-semibold tabular-nums ${
                    totals.netMonthlyUsdMinor < 0
                      ? "text-destructive"
                      : "text-primary"
                  }`}
                >
                  {usd(totals.netMonthlyUsdMinor)}
                </p>
                {netCny ? (
                  <p className="mt-1 text-xs text-muted-foreground">折合 {netCny}</p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="border-t border-border/75 pt-8">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">运营规模</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                自用账号只计规模，出租账号同时进入应收计算。
              </p>
            </div>
            <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-5">
              <div className="bg-card px-5 py-4">
                <dt className="text-xs text-muted-foreground">空间总数</dt>
                <dd className="mt-2 font-mono text-2xl font-semibold tabular-nums">
                  {totals.totalSpaces}
                </dd>
              </div>
              <div className="bg-card px-5 py-4">
                <dt className="text-xs text-muted-foreground">出租账号</dt>
                <dd className="mt-2 font-mono text-2xl font-semibold tabular-nums">
                  {totals.rentedChildAccounts}
                </dd>
              </div>
              <div className="bg-card px-5 py-4">
                <dt className="text-xs text-muted-foreground">自用账号</dt>
                <dd className="mt-2 font-mono text-2xl font-semibold tabular-nums">
                  {totals.selfUseChildAccounts}
                </dd>
              </div>
              <div className="bg-card px-5 py-4">
                <dt className="text-xs text-muted-foreground">子账号总数</dt>
                <dd className="mt-2 font-mono text-2xl font-semibold tabular-nums">
                  {totals.totalChildAccounts}
                </dd>
              </div>
              <div className="bg-card px-5 py-4">
                <dt className="text-xs text-muted-foreground">席位余量</dt>
                <dd
                  className="mt-2 grid grid-cols-2 gap-3"
                  aria-label={`席位余量：空闲 ${totals.availableSeatCount} 个，超额 ${totals.overCapacitySeatCount} 个`}
                >
                  <span>
                    <span className="block text-xs text-muted-foreground">
                      空闲
                    </span>
                    <span
                      className={`mt-1 block font-mono text-2xl font-semibold tabular-nums ${
                        totals.availableSeatCount > 0
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-foreground"
                      }`}
                    >
                      {totals.availableSeatCount}
                    </span>
                  </span>
                  <span className="border-l border-border/70 pl-3">
                    <span className="block text-xs text-muted-foreground">
                      超额
                    </span>
                    <span
                      className={`mt-1 block font-mono text-2xl font-semibold tabular-nums ${
                        totals.overCapacitySeatCount > 0
                          ? "text-destructive"
                          : "text-foreground"
                      }`}
                    >
                      {totals.overCapacitySeatCount}
                    </span>
                  </span>
                </dd>
                <p className="mt-2 font-mono text-xs tabular-nums text-muted-foreground">
                  已使用 {totals.occupiedSeatCount} / 总席位 {totals.seatCapacity}
                </p>
              </div>
            </dl>
            <div className="mt-7 grid gap-4 border-t border-border/70 pt-5 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">全部席位</p>
                <p className="mt-2 font-mono tabular-nums">
                  codex {counts.allAccountsBySeatType.codex} / chatgpt{" "}
                  {counts.allAccountsBySeatType.chatgpt}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">母账号席位</p>
                <p className="mt-2 font-mono tabular-nums">
                  codex {counts.motherAccountsBySeatType.codex} / chatgpt{" "}
                  {counts.motherAccountsBySeatType.chatgpt}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">子账号席位</p>
                <p className="mt-2 font-mono tabular-nums">
                  codex {counts.childAccountsBySeatType.codex} / chatgpt{" "}
                  {counts.childAccountsBySeatType.chatgpt}
                </p>
              </div>
            </div>
          </section>

          <section className="border-t border-border/75 pt-8">
            <div className="mb-5">
              <h2 className="text-xl font-semibold tracking-tight">支出分布</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                按支付渠道查看资金去向，并核对各空间的成本覆盖情况。
              </p>
            </div>
            {totals.spacePaymentUsdMinor === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">
                暂无空间支出分布。新增带 USD 成本的空间后，这里会按渠道和空间汇总。
              </div>
            ) : (
              <div className="grid items-stretch gap-5 xl:grid-cols-2">
                <DistributionList
                  title="按支付渠道"
                  description="空间付款归属到对应的支付渠道。"
                  buckets={distributions.spendingByPaymentChannel}
                  totalUsdMinor={totals.spacePaymentUsdMinor}
                />
                <SpacePerformanceList items={spacePerformanceDisplay} />
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}
