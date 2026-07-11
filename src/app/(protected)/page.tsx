import Link from "next/link";
import { db } from "@/db";
import { getCurrencyMinorUnit } from "@/db/currencies";
import { getDashboardOverview } from "@/db/dashboard";
import { getRate } from "@/db/fxRates";
import { convertUsdMinorToCurrencyMinor, formatMinor } from "@/lib/money";
import { DistributionList } from "@/components/dashboard/distribution-list";
import { ExpiringChildAccountTable } from "@/components/dashboard/expiring-child-account-table";
import { ExpiringSpaceTable } from "@/components/dashboard/expiring-space-table";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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
  const { totals, counts, distributions, thresholds } = overview;
  const cnyRateRow = getRate(db, "CNY");
  const cnyMinorUnit = getCurrencyMinorUnit(db, "CNY");
  const cnyRate =
    cnyRateRow && cnyMinorUnit !== undefined
      ? { minorUnit: cnyMinorUnit, rateToUsd: cnyRateRow.rateToUsd }
      : null;
  const receivableCny = cnyFromUsd(totals.childMonthlyRevenueUsdMinor, cnyRate);
  const netCny = cnyFromUsd(totals.netMonthlyUsdMinor, cnyRate);
  const hasAnyRisk =
    totals.renewalRiskSpaces > 0 || totals.renewalRiskChildAccounts > 0;

  return (
    <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-4 rounded-xl border bg-card/58 p-5 shadow-[0_18px_55px_oklch(0.32_0.04_155_/_0.08)] backdrop-blur lg:grid-cols-[minmax(0,1fr)_auto] lg:p-6">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary">
            RENEWAL DESK
          </p>
          <h1 className="text-3xl font-semibold leading-none tracking-tight sm:text-4xl">
            仪表盘
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            空间是你付费的成本，非自用子账号是出租出去的应收收入。
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2 lg:justify-end">
          {hasAnyRisk ? (
            <Button asChild className="w-fit">
              <a href="#renewal-risk">查看到期风险</a>
            </Button>
          ) : null}
          <Button asChild variant="outline" className="w-fit">
            <Link href="/spaces">管理空间</Link>
          </Button>
        </div>
      </div>

      {totals.totalSpaces === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-card/60 px-6 py-14 text-center shadow-[0_18px_55px_oklch(0.32_0.04_155_/_0.08)] backdrop-blur">
          <h2 className="text-base font-semibold">还没有空间数据</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            先到空间列表新增空间。仪表盘会在有数据后显示空间支出、出租账号收入和到期风险。
          </p>
          <Button asChild variant="outline">
            <Link href="/spaces">前往空间列表</Link>
          </Button>
        </div>
      ) : (
        <>
          <section className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="空间到期风险"
              value={String(totals.renewalRiskSpaces)}
              tone={
                counts.spacesByExpiryStatus.expired > 0
                  ? "risk"
                  : counts.spacesByExpiryStatus.soon > 0
                    ? "warning"
                    : "default"
              }
              description={
                <>
                  已过期 {counts.spacesByExpiryStatus.expired} /{" "}
                  {thresholds.spaceSoonDays} 天内{" "}
                  {counts.spacesByExpiryStatus.soon}
                </>
              }
            />
            <MetricCard
              label="非自用账号到期风险"
              value={String(totals.renewalRiskChildAccounts)}
              tone={
                counts.childAccountsByExpiryStatus.expired > 0 ||
                counts.childAccountsByExpiryStatus.due > 0
                  ? "risk"
                  : counts.childAccountsByExpiryStatus.soon > 0
                    ? "warning"
                    : "default"
              }
              description={
                <>
                  逾期 {counts.childAccountsByExpiryStatus.expired} / 今日{" "}
                  {counts.childAccountsByExpiryStatus.due} /{" "}
                  {thresholds.childAccountSoonDays} 天内{" "}
                  {counts.childAccountsByExpiryStatus.soon}
                </>
              }
            />
            <MetricCard
              label="空间支出"
              value={usd(totals.spacePaymentUsdMinor)}
              tone="expense"
              description="你为所有空间支付的冻结 USD 成本"
            />
            <MetricCard
              label="出租账号应收"
              value={usd(totals.childMonthlyRevenueUsdMinor)}
              tone="income"
              description={
                <>
                  {receivableCny ? `折合 ${receivableCny}` : "CNY 汇率缺失"}
                  <br />
                  净额 {usd(totals.netMonthlyUsdMinor)}
                  {netCny ? ` / ${netCny}` : ""}
                </>
              }
            />
          </section>

          <section
            id="renewal-risk"
            className="grid gap-5 scroll-mt-20 xl:grid-cols-2"
          >
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  空间到期风险
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  空间是你的付费成本，已过期和 {thresholds.spaceSoonDays}{" "}
                  天内到期的空间优先处理。
                </p>
              </div>
              <ExpiringSpaceTable
                spaces={overview.expiringSpaces}
                soonDays={thresholds.spaceSoonDays}
              />
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  非自用账号到期风险
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  只看出租出去、需要向用户收费的子账号；自用账号不进入收款风险。
                </p>
              </div>
              <ExpiringChildAccountTable
                accounts={overview.expiringChildAccounts}
                soonDays={thresholds.childAccountSoonDays}
              />
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">现金流概览</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                支出来自空间付费，收入来自非自用子账号出租。自用账号只计数量，不计应收。
              </p>
            </div>
            <div className="grid gap-4 rounded-xl border bg-card/70 p-5 shadow-[0_18px_55px_oklch(0.32_0.04_155_/_0.08)] backdrop-blur sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">空间总数</p>
                <p className="font-mono text-2xl font-semibold">
                  {totals.totalSpaces}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">非自用账号</p>
                <p className="font-mono text-2xl font-semibold">
                  {totals.rentedChildAccounts}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">席位类型</p>
                <div className="font-mono text-sm leading-6">
                  <p>
                    全部 codex {counts.allAccountsBySeatType.codex} / chatgpt{" "}
                    {counts.allAccountsBySeatType.chatgpt}
                  </p>
                  <Separator className="my-2" />
                  <p>
                    母账号 codex {counts.motherAccountsBySeatType.codex} / chatgpt{" "}
                    {counts.motherAccountsBySeatType.chatgpt}
                  </p>
                  <p>
                    子账号 codex {counts.childAccountsBySeatType.codex} / chatgpt{" "}
                    {counts.childAccountsBySeatType.chatgpt}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">支出分布</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                只展示空间支出，按支付渠道和空间拆分，方便判断钱主要花在哪。
              </p>
            </div>
            {totals.spacePaymentUsdMinor === 0 ? (
              <div className="rounded-xl border border-dashed bg-card/60 p-5 text-sm text-muted-foreground">
                暂无空间支出分布。新增带 USD 成本的空间后，这里会按渠道和空间汇总。
              </div>
            ) : (
              <div className="grid items-stretch gap-4 xl:grid-cols-2">
                <DistributionList
                  title="按支付渠道"
                  description="空间付款归属到对应支付渠道。"
                  buckets={distributions.spendingByPaymentChannel}
                  totalUsdMinor={totals.spacePaymentUsdMinor}
                />
                <DistributionList
                  title="按空间"
                  description="每个空间自身的付费成本占比。"
                  buckets={distributions.spendingBySpace}
                  totalUsdMinor={totals.spacePaymentUsdMinor}
                />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
