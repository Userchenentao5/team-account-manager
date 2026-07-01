import Link from "next/link";
import { db } from "@/db";
import { getDashboardOverview } from "@/db/dashboard";
import { formatMinor } from "@/lib/money";
import { DistributionList } from "@/components/dashboard/distribution-list";
import { ExpiringSpaceTable } from "@/components/dashboard/expiring-space-table";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// better-sqlite3 is a native module — keep this RSC on the Node runtime.
export const dynamic = "force-dynamic";

function usd(amountMinor: number) {
  return `$${formatMinor(amountMinor, 2)} USD`;
}

export default function DashboardPage() {
  const overview = getDashboardOverview(db);
  const { totals, counts, distributions } = overview;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold leading-tight">仪表盘</h1>
          <p className="text-sm text-muted-foreground">
            一眼查看续费风险和冻结 USD 成本。
          </p>
        </div>
        {totals.renewalRiskSpaces > 0 ? (
          <Button asChild>
            <a href="#renewal-risk">查看到期空间</a>
          </Button>
        ) : null}
      </div>

      {totals.totalSpaces === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-12 text-center">
          <h2 className="text-base font-semibold">还没有空间数据</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            先到空间列表新增空间。仪表盘会在有数据后显示到期风险、冻结 USD 成本和账号数量。
          </p>
          <Button asChild variant="outline">
            <Link href="/spaces">前往空间列表</Link>
          </Button>
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="到期风险空间"
              value={String(totals.renewalRiskSpaces)}
              tone={totals.renewalRiskSpaces > 0 ? "risk" : "default"}
              description={
                <>
                  已过期 {counts.spacesByExpiryStatus.expired} / 7 天内{" "}
                  {counts.spacesByExpiryStatus.soon}
                </>
              }
            />
            <MetricCard
              label="冻结 USD 成本合计"
              value={usd(totals.totalUsdMinor)}
              description={
                <>
                  空间付款 USD {usd(totals.spacePaymentUsdMinor)}
                  <br />
                  子账号月度 USD {usd(totals.childMonthlyUsdMinor)}
                </>
              }
            />
            <MetricCard
              label="空间总数"
              value={String(totals.totalSpaces)}
              description={`正常 ${counts.spacesByExpiryStatus.normal} 个空间`}
            />
            <MetricCard
              label="子账号总数"
              value={String(totals.totalChildAccounts)}
              description={`codex ${counts.childAccountsBySeatType.codex} / chatgpt ${counts.childAccountsBySeatType.chatgpt}`}
            />
          </section>

          <section id="renewal-risk" className="space-y-4 scroll-mt-4">
            <div>
              <h2 className="text-base font-semibold">到期风险空间</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                已过期和 7 天内到期的空间优先显示。
              </p>
            </div>
            <ExpiringSpaceTable spaces={overview.expiringSpaces} />
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">支出分布</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                按国家、币种和支付渠道汇总冻结 USD 成本。
              </p>
            </div>
            {totals.totalUsdMinor === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                暂无支出分布。新增带冻结 USD 金额的空间后，这里会按国家、币种和支付渠道汇总。
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                <DistributionList
                  title="按国家"
                  description="空间付款和子账号月度成本归属到所属空间国家。"
                  buckets={distributions.byCountry}
                  totalUsdMinor={totals.totalUsdMinor}
                />
                <DistributionList
                  title="按币种"
                  description="空间原始币种和子账号月度币种分别归属。"
                  buckets={distributions.byCurrency}
                  totalUsdMinor={totals.totalUsdMinor}
                />
                <DistributionList
                  title="按支付渠道"
                  description="空间付款和子账号成本归属到所属空间支付渠道。"
                  buckets={distributions.byPaymentChannel}
                  totalUsdMinor={totals.totalUsdMinor}
                />
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">数量概览</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                空间状态和子账号席位类型的二级汇总。
              </p>
            </div>
            <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">空间总数</p>
                <p className="font-mono text-2xl font-semibold">
                  {totals.totalSpaces}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">已过期</p>
                <p className="font-mono text-2xl font-semibold">
                  {counts.spacesByExpiryStatus.expired}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">7 天内到期</p>
                <p className="font-mono text-2xl font-semibold">
                  {counts.spacesByExpiryStatus.soon}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">正常空间</p>
                <p className="font-mono text-2xl font-semibold">
                  {counts.spacesByExpiryStatus.normal}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">子账号总数</p>
                <p className="font-mono text-2xl font-semibold">
                  {totals.totalChildAccounts}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">席位类型</p>
                <p className="font-mono text-sm">
                  codex {counts.childAccountsBySeatType.codex}
                  <Separator className="my-2" />
                  chatgpt {counts.childAccountsBySeatType.chatgpt}
                </p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
