"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { refreshRates } from "@/actions/fx";
import type { FxRateListRow } from "@/db/fxRates";
import {
  DEFAULT_RATE_BASE,
  RATE_BASES,
  isRateBase,
  type RateBase,
} from "@/lib/fx/base";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RateTableProps = {
  rates: FxRateListRow[];
  fetchedAt: string | null;
  stale: boolean;
  base: RateBase;
};

/** Format an ISO wall-clock string into a readable local "as of" label (D-05). */
function formatAsOf(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return format(d, "yyyy-MM-dd HH:mm");
}

function toPositiveNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatRate(value: number | null): string {
  if (value === null) return "—";
  return value.toPrecision(12).replace(/\.?0+$/, "");
}

function buildHref(base: RateBase): string {
  return base === DEFAULT_RATE_BASE
    ? "/reference-data/rates"
    : `/reference-data/rates?base=${base}`;
}

export function RateTable({ rates, fetchedAt, stale, base }: RateTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onRefresh() {
    startTransition(async () => {
      try {
        const res = await refreshRates(base);
        if (res.ok && !res.stale) {
          toast.success("汇率已更新");
        } else if (res.ok && res.stale) {
          toast.error("刷新失败，已保留上次缓存的汇率。");
        } else {
          toast.error("刷新失败，请重试。");
        }
        router.refresh();
      } catch {
        toast.error("刷新失败，请重试。");
      }
    });
  }

  function onBaseChange(value: string) {
    if (!isRateBase(value)) return;
    router.push(buildHref(value));
  }

  const asOf = formatAsOf(fetchedAt);
  const isEmpty = rates.length === 0;
  const baseRateToUsd =
    rates.find(({ rate }) => rate.currencyCode === base)?.rate.rateToUsd ??
    null;
  const baseRate = baseRateToUsd ? toPositiveNumber(baseRateToUsd) : null;
  // Two distinct negative states (Pitfall 5): stale banner only when a NON-EMPTY
  // cache exists; the empty state replaces the table entirely when there are no rows.
  const showStaleBanner = stale && !isEmpty;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b bg-background/95 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">汇率</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            汇率覆盖当前币种表，此页用于刷新缓存；新增币种后刷新一次即可获取对应汇率。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={base} onValueChange={onBaseChange}>
            <SelectTrigger className="w-36" aria-label="选择基准币种">
              <SelectValue placeholder="基准币" />
            </SelectTrigger>
            <SelectContent align="end" position="popper">
              {RATE_BASES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Refresh is always available (D-06); disabled only during its own transition. */}
          <Button onClick={onRefresh} disabled={isPending}>
            <RefreshCw
              className={isPending ? "size-4 animate-spin" : "size-4"}
            />
            刷新汇率
          </Button>
        </div>
      </div>

      {/* As-of label is always shown whenever a cache exists, stale or not (D-05). */}
      {asOf && (
        <p className="mt-4 text-sm text-muted-foreground">
          当前基准 {base} · 汇率截至 {asOf}
        </p>
      )}
      <p className="mt-2 text-sm text-muted-foreground">
        当前按 1 {base} 可兑换各币种展示；系统缓存仍统一保存为 X→USD，用于冻结空间和子账号的 USD 成本。
      </p>

      {showStaleBanner && (
        <Alert variant="destructive" className="mt-4">
          <TriangleAlert />
          <AlertTitle>汇率可能已过期</AlertTitle>
          <AlertDescription>
            无法连接汇率服务，当前显示上次缓存的汇率。请检查网络后重试“刷新汇率”。
          </AlertDescription>
        </Alert>
      )}
      </div>

      {isEmpty ? (
        <div className="m-4 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 py-12 text-center sm:m-6">
          <h2 className="text-lg font-semibold">暂无汇率数据</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            尚未获取到汇率。点击“刷新汇率”从 Frankfurter
            获取；若仍失败，请检查网络后稍后重试。
          </p>
          <Button onClick={onRefresh} disabled={isPending}>
            <RefreshCw
              className={isPending ? "size-4 animate-spin" : "size-4"}
            />
            刷新汇率
          </Button>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4 sm:px-6 lg:px-8">
          <table data-slot="table" className="w-full min-w-[620px] table-fixed caption-bottom text-sm">
          <colgroup>
            <col className="w-[15%]" />
            <col className="w-[13%]" />
            <col className="w-[36%]" />
            <col />
          </colgroup>
          <TableHeader className="sticky top-0 z-20 bg-background shadow-sm [&_th]:bg-background">
            <TableRow>
              <TableHead scope="col">代码</TableHead>
              <TableHead scope="col">符号</TableHead>
              <TableHead scope="col" className="text-right">
                汇率 (1 {base} 可兑换)
              </TableHead>
              <TableHead scope="col" className="text-right">
                更新时间
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.map(({ rate, currency }) => {
              const targetRate = toPositiveNumber(rate.rateToUsd);
              const displayRate =
                baseRate && targetRate ? baseRate / targetRate : null;

              return (
                <TableRow key={rate.currencyCode}>
                  <TableCell className="font-mono">
                    {rate.currencyCode}
                  </TableCell>
                  <TableCell className="font-mono">{currency.symbol}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatRate(displayRate)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatAsOf(rate.fetchedAt) ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          </table>
        </div>
      )}
    </div>
  );
}
