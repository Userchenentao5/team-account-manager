import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

type MetricCardProps = {
  label: string;
  value: string;
  description?: ReactNode;
  tone?: "default" | "risk";
};

export function MetricCard({
  label,
  value,
  description,
  tone = "default",
}: MetricCardProps) {
  return (
    <Card
      size="sm"
      className={
        tone === "risk" ? "border-l-4 border-l-destructive" : undefined
      }
    >
      <CardContent className="flex min-h-28 flex-col justify-between gap-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-mono text-2xl font-semibold leading-tight">
          {value}
        </div>
        {description ? (
          <div className="text-xs leading-snug text-muted-foreground">
            {description}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
