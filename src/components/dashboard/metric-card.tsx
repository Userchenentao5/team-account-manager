import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string;
  description?: ReactNode;
  tone?: "default" | "warning" | "risk" | "expense" | "income";
};

const toneClassNames = {
  default: "border-primary/55",
  warning: "border-amber-500/75",
  risk: "border-destructive",
  expense: "border-foreground/45",
  income: "border-primary",
} as const;

const valueClassNames = {
  default: "text-foreground",
  warning: "text-amber-700 dark:text-amber-300",
  risk: "text-destructive",
  expense: "text-foreground",
  income: "text-primary",
} as const;

export function MetricCard({
  label,
  value,
  description,
  tone = "default",
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "min-h-28 border-t-2 py-4",
        toneClassNames[tone],
      )}
    >
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-3 whitespace-nowrap font-mono text-2xl font-semibold leading-none tabular-nums",
          valueClassNames[tone],
        )}
      >
        {value}
      </div>
      {description ? (
        <div className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {description}
        </div>
      ) : null}
    </div>
  );
}
