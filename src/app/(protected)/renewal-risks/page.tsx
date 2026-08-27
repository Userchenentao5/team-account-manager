import Link from "next/link";
import { db } from "@/db";
import { getDashboardOverview } from "@/db/dashboard";
import { ExpiringChildAccountTable } from "@/components/dashboard/expiring-child-account-table";
import { ExpiringSpaceTable } from "@/components/dashboard/expiring-space-table";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

// better-sqlite3 is a native module - keep this RSC on the Node runtime.
export const dynamic = "force-dynamic";

export default function RenewalRisksPage() {
  const overview = getDashboardOverview(db);
  const { counts, expiringChildAccounts, expiringSpaces, thresholds, totals } =
    overview;
  const hasUrgentSpaceRisk = counts.spacesByExpiryStatus.expired > 0;
  const hasUrgentChildAccountRisk =
    counts.childAccountsByExpiryStatus.expired > 0 ||
    counts.childAccountsByExpiryStatus.due > 0;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8">
      <PageHeader
        title="续费风险"
        description="只显示已过期、今日到期和近期到期的空间与出租账号。"
        actions={
          <Button asChild variant="outline" className="w-fit">
            <Link href="/">返回仪表盘</Link>
          </Button>
        }
      />

      <div className="space-y-8 py-6">
        <section aria-labelledby="space-renewal-risk">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="space-renewal-risk"
                className="text-xl font-semibold tracking-tight"
              >
                空间续费
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                处理空间订阅成本，列表按到期时间排序。
              </p>
            </div>
            <span
              className={`w-fit font-mono text-sm font-semibold tabular-nums ${
                hasUrgentSpaceRisk
                  ? "text-destructive"
                  : totals.renewalRiskSpaces > 0
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-muted-foreground"
              }`}
            >
              {totals.renewalRiskSpaces} 项风险
            </span>
          </div>
          <ExpiringSpaceTable
            spaces={expiringSpaces}
            soonDays={thresholds.spaceSoonDays}
          />
        </section>

        <section aria-labelledby="child-account-renewal-risk">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="child-account-renewal-risk"
                className="text-xl font-semibold tracking-tight"
              >
                出租账号收款
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                处理出租账号的逾期、今日到期和近期收款。
              </p>
            </div>
            <span
              className={`w-fit font-mono text-sm font-semibold tabular-nums ${
                hasUrgentChildAccountRisk
                  ? "text-destructive"
                  : totals.renewalRiskChildAccounts > 0
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-muted-foreground"
              }`}
            >
              {totals.renewalRiskChildAccounts} 项风险
            </span>
          </div>
          <ExpiringChildAccountTable
            accounts={expiringChildAccounts}
            soonDays={thresholds.childAccountSoonDays}
          />
        </section>
      </div>
    </div>
  );
}
