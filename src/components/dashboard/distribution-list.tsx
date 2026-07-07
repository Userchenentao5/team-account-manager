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
  const subtotal = buckets.reduce((sum, bucket) => sum + bucket.usdMinor, 0);
  const reconciles = buckets.length > 0 && subtotal === totalUsdMinor;

  return (
    <Card size="sm" className="min-h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {buckets.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/35 p-4 text-sm text-muted-foreground">
            暂无支出分布
          </div>
        ) : (
          buckets.map((bucket) => (
            <div key={bucket.key} className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-4">
                <span className="min-w-0 truncate text-sm font-medium">
                  {bucket.label}
                </span>
                <span className="shrink-0 font-mono text-sm text-foreground">
                  ${formatMinor(bucket.usdMinor, 2)} USD
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted shadow-inner">
                  <div
                    className="h-2.5 rounded-full bg-primary/75 shadow-[0_0_18px_oklch(0.36_0.083_166_/_0.25)] transition-[width] duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, bucket.percentage))}%`,
                    }}
                  />
                </div>
                <span className="w-12 text-right font-mono text-xs text-muted-foreground">
                  {bucket.percentage}%
                </span>
              </div>
            </div>
          ))
        )}
        {reconciles ? (
          <div className="border-t pt-3 text-xs text-muted-foreground">
            小计与总计一致
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
