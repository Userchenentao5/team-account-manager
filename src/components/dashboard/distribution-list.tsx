import type { DashboardSpendBucket } from "@/db/dashboard";
import { formatMinor } from "@/lib/money";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type DistributionListProps = {
  title: string;
  description: string;
  buckets: DashboardSpendBucket[];
  totalUsdMinor: number;
};

export function DistributionList({
  title,
  description,
  buckets,
  totalUsdMinor,
}: DistributionListProps) {
  const barHeightClassName =
    buckets.length <= 3 ? "h-20" : buckets.length <= 5 ? "h-12" : "h-8";
  const barGapClassName =
    buckets.length <= 3 ? "gap-7" : buckets.length <= 5 ? "gap-4" : "gap-3";

  return (
    <Card size="sm" className="min-h-full">
      <CardHeader className="border-b border-border/70 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle as="h3">{title}</CardTitle>
            <CardDescription className="mt-1 leading-5">
              {description}
            </CardDescription>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-medium text-muted-foreground">
              总支出
            </p>
            <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
              ${formatMinor(totalUsdMinor, 2)}
            </p>
            <p className="text-[10px] text-muted-foreground">USD</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 pt-4">
        {buckets.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/35 p-5 text-sm text-muted-foreground">
            暂无支出分布
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 overflow-x-auto pb-1">
            <div className="flex min-w-[27rem] flex-1 flex-col">
              <p className="ml-[7.25rem] text-[10px] font-medium text-muted-foreground">
                占总支出比例
              </p>
              <div
                className={`flex flex-1 flex-col justify-center py-2 ${barGapClassName}`}
                role="list"
                aria-label={`${title}支出分布柱状图`}
              >
                {buckets.map((bucket) => (
                  <div
                    key={bucket.key}
                    role="listitem"
                    aria-label={`${bucket.label}，${formatMinor(bucket.usdMinor, 2)} 美元，占总支出 ${bucket.percentage}%`}
                    className="grid grid-cols-[6.5rem_minmax(14rem,1fr)_3rem] items-center gap-3"
                  >
                    <p
                      className="truncate text-xs font-medium text-foreground"
                      title={bucket.label}
                    >
                      {bucket.label}
                    </p>
                    <div className={`relative ${barHeightClassName}`}>
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 grid grid-cols-4 border-x border-border/45"
                      >
                        <span className="border-r border-border/45" />
                        <span className="border-r border-border/45" />
                        <span className="border-r border-border/45" />
                        <span />
                      </div>
                      <div
                        aria-hidden="true"
                        className="absolute inset-y-0 left-0 min-w-px rounded-r-sm bg-primary/85"
                        style={{
                          width: `${Math.min(100, Math.max(0, bucket.percentage))}%`,
                        }}
                        title={`${bucket.label}: $${formatMinor(bucket.usdMinor, 2)} USD (${bucket.percentage}%)`}
                      />
                    </div>
                    <p className="font-mono text-xs font-semibold tabular-nums text-foreground">
                      {bucket.percentage}%
                    </p>
                  </div>
                ))}
              </div>
              <div
                aria-hidden="true"
                className="mt-2 grid grid-cols-[6.5rem_minmax(14rem,1fr)_3rem] gap-3"
              >
                <span />
                <div className="relative h-5 border-t border-border/65 font-mono text-[10px] text-muted-foreground">
                  <span className="absolute left-0 top-1.5">0%</span>
                  <span className="absolute left-1/4 top-1.5 -translate-x-1/2">25%</span>
                  <span className="absolute left-1/2 top-1.5 -translate-x-1/2">50%</span>
                  <span className="absolute left-3/4 top-1.5 -translate-x-1/2">75%</span>
                  <span className="absolute right-0 top-1.5">100%</span>
                </div>
                <span />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
