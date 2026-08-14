import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string;
  description?: ReactNode;
  tone?: "default" | "warning" | "risk" | "expense" | "income";
};

const toneClassNames = {
  default: "before:bg-primary/55",
  warning: "before:bg-amber-500/75",
  risk: "before:bg-destructive",
  expense: "before:bg-foreground/45",
  income: "before:bg-primary",
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
        "relative min-h-28 py-4 pl-4 before:absolute before:inset-y-4 before:left-0 before:w-0.5 before:rounded-full",
        toneClassNames[tone],
      )}
    >
      <div className="text-xs font-medium leading-5 text-muted-foreground">
        {label}
      </div>
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
