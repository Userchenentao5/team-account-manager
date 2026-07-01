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
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {buckets.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            暂无支出分布
          </div>
        ) : (
          buckets.map((bucket) => (
            <div key={bucket.key} className="space-y-2">
              <div className="flex items-baseline justify-between gap-4">
                <span className="truncate text-sm">{bucket.label}</span>
                <span className="font-mono text-sm">
                  ${formatMinor(bucket.usdMinor, 2)} USD
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary/70"
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
