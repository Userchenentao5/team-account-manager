import { CircleAlert, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function seatUsageStatus(
  occupiedSeatCount: number,
  seatCapacity: number,
): "over" | "under" | "full" {
  if (occupiedSeatCount > seatCapacity) return "over";
  if (occupiedSeatCount < seatCapacity) return "under";
  return "full";
}

export function SeatUsage({
  occupiedSeatCount,
  seatCapacity,
}: {
  occupiedSeatCount: number;
  seatCapacity: number;
}) {
  const status = seatUsageStatus(occupiedSeatCount, seatCapacity);
  const label = `${occupiedSeatCount}/${seatCapacity}`;
  if (status === "full") {
    return (
      <span
        className="inline-flex h-6 min-w-14 items-center justify-center font-mono font-medium tabular-nums text-foreground"
        aria-label={`席位已满：已使用 ${occupiedSeatCount} 个，总席位 ${seatCapacity} 个`}
      >
        {label}
      </span>
    );
  }

  const isOver = status === "over";
  const Icon = isOver ? TriangleAlert : CircleAlert;
  return (
    <Badge
      variant={isOver ? "destructive" : "outline"}
      className={
        isOver
          ? "h-6 min-w-14 gap-1 border-destructive/30 px-2 font-mono font-semibold tabular-nums"
          : "h-6 min-w-14 gap-1 border-amber-500/35 bg-amber-500/10 px-2 font-mono font-semibold tabular-nums text-amber-700 dark:text-amber-300"
      }
      aria-label={`${isOver ? "席位超员" : "席位未满"}：已使用 ${occupiedSeatCount} 个，总席位 ${seatCapacity} 个`}
    >
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}
