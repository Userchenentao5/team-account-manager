import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
      className={cn(
        "relative min-h-36 overflow-hidden",
        "before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-primary/45",
        tone === "risk"
          ? "before:bg-destructive/70 shadow-[0_18px_50px_oklch(0.58_0.18_32_/_0.12)]"
          : undefined
      )}
    >
      <CardContent className="flex min-h-32 flex-col justify-between gap-4">
        <div className="text-xs font-medium text-muted-foreground">
          {label}
        </div>
        <div className="font-mono text-3xl font-semibold leading-none tracking-tight text-foreground">
          {value}
        </div>
        {description ? (
          <div className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
