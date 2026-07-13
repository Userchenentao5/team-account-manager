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
      <CardContent className="pt-4">
        {buckets.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/35 p-5 text-sm text-muted-foreground">
            暂无支出分布
          </div>
        ) : (
          <div className="overflow-x-auto pb-1">
            <div className="grid min-w-[23rem] grid-cols-[2rem_minmax(0,1fr)] gap-3">
              <div
                aria-hidden="true"
                className="grid h-44 grid-rows-4 text-right font-mono text-[10px] text-muted-foreground"
              >
                <span className="-translate-y-1">100</span>
                <span className="-translate-y-1">75</span>
                <span className="-translate-y-1">50</span>
                <span className="-translate-y-1">25</span>
              </div>
              <div
                className="flex min-w-0 gap-3"
                role="list"
                aria-label={`${title}支出分布柱状图`}
              >
                {buckets.map((bucket) => (
                  <div
                    key={bucket.key}
                    role="listitem"
                    className="flex min-w-[4.75rem] flex-1 flex-col gap-2"
                  >
                    <div className="relative h-44">
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 grid grid-rows-4"
                      >
                        <span className="border-t border-border/65" />
                        <span className="border-t border-border/45" />
                        <span className="border-t border-border/45" />
                        <span className="border-t border-border/45" />
                      </div>
                      <div className="absolute inset-x-0 bottom-0 top-1 flex items-end px-1">
                        <div
                          className="min-h-1 w-full rounded-t-sm bg-primary/85"
                          style={{
                            height: `${Math.min(100, Math.max(0, bucket.percentage))}%`,
                          }}
                          title={`${bucket.label}: $${formatMinor(bucket.usdMinor, 2)} USD (${bucket.percentage}%)`}
                        />
                      </div>
                    </div>
                    <div className="min-h-10 text-center">
                      <p className="truncate font-mono text-[11px] font-medium tabular-nums text-foreground">
                        ${formatMinor(bucket.usdMinor, 2)}
                      </p>
                      <p className="line-clamp-2 text-xs leading-4 text-muted-foreground">
                        {bucket.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="ml-11 mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>占总支出比例</span>
              <span>0%</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
