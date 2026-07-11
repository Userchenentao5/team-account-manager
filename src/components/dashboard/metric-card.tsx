import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string;
  description?: ReactNode;
  tone?: "default" | "warning" | "risk" | "expense" | "income";
};

const toneClassNames = {
  default:
    "before:bg-emerald-500/70 border-emerald-500/20 bg-emerald-500/[0.035]",
  warning:
    "before:bg-amber-500 border-amber-500/45 bg-amber-500/[0.08] shadow-[0_18px_50px_oklch(0.77_0.16_75_/_0.12)]",
  risk:
    "before:bg-destructive border-destructive/50 bg-destructive/[0.075] shadow-[0_18px_50px_oklch(0.58_0.18_32_/_0.14)]",
  expense:
    "before:bg-orange-500 border-orange-500/30 bg-orange-500/[0.055]",
  income:
    "before:bg-cyan-500 border-cyan-500/30 bg-cyan-500/[0.055]",
} as const;

const valueClassNames = {
  default: "text-emerald-700 dark:text-emerald-300",
  warning: "text-amber-700 dark:text-amber-300",
  risk: "text-destructive",
  expense: "text-orange-700 dark:text-orange-300",
  income: "text-cyan-700 dark:text-cyan-300",
} as const;

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
        "before:absolute before:inset-x-0 before:top-0 before:h-1",
        toneClassNames[tone],
      )}
    >
      <CardContent className="flex min-h-32 flex-col justify-between gap-4">
        <div className="text-xs font-medium text-muted-foreground">
          {label}
        </div>
        <div
          className={cn(
            "font-mono text-3xl font-semibold leading-none tracking-tight",
            valueClassNames[tone],
          )}
        >
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
