"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { refreshRates } from "@/actions/fx";
import type { FxRateRow } from "@/db/fxRates";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RateTableProps = {
  rates: FxRateRow[];
  fetchedAt: string | null;
  stale: boolean;
};

/** Format an ISO wall-clock string into a readable local "as of" label (D-05). */
function formatAsOf(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return format(d, "yyyy-MM-dd HH:mm");
}

export function RateTable({ rates, fetchedAt, stale }: RateTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onRefresh() {
    startTransition(async () => {
      try {
        const res = await refreshRates();
        if (res.ok && !res.stale) {
          toast.success("汇率已更新");
        } else if (res.ok && res.stale) {
          toast.error("刷新失败,已保留上次缓存的汇率。");
        } else {
          toast.error("刷新失败,请重试。");
        }
        router.refresh();
      } catch {
        toast.error("刷新失败,请重试。");
      }
    });
  }

  const asOf = formatAsOf(fetchedAt);
  const isEmpty = rates.length === 0;
  // Two distinct negative states (Pitfall 5): stale banner only when a NON-EMPTY
  // cache exists; the empty state replaces the table entirely when there are no rows.
  const showStaleBanner = stale && !isEmpty;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold leading-tight">汇率</h1>
        {/* Refresh is always available (D-06); disabled only during its own transition. */}
        <Button onClick={onRefresh} disabled={isPending}>
          <RefreshCw className={isPending ? "size-4 animate-spin" : "size-4"} />
          刷新汇率
        </Button>
      </div>

      {/* As-of label is always shown whenever a cache exists, stale or not (D-05). */}
      {asOf && (
        <p className="text-sm text-muted-foreground">汇率截至 {asOf}</p>
      )}

      {showStaleBanner && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>汇率可能已过期</AlertTitle>
          <AlertDescription>
            无法连接汇率服务,当前显示上次缓存的汇率。请检查网络后重试“刷新汇率”。
          </AlertDescription>
        </Alert>
      )}

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-12 text-center">
          <h2 className="text-lg font-semibold">暂无汇率数据</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            尚未获取到汇率。点击“刷新汇率”从 Frankfurter
            获取;若仍失败,请检查网络后稍后重试。
          </p>
          <Button onClick={onRefresh} disabled={isPending}>
            <RefreshCw
              className={isPending ? "size-4 animate-spin" : "size-4"}
            />
            刷新汇率
          </Button>
        </div>
      ) : (
        <Table>
          <TableCaption className="text-sm text-muted-foreground">
            汇率以 1 单位外币折算为美元 (USD) 计;美元固定为 1。
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">代码</TableHead>
              <TableHead scope="col" className="text-right">
                汇率 (折合 USD)
              </TableHead>
              <TableHead scope="col" className="text-right">
                更新时间
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.map((rate) => (
              <TableRow key={rate.currencyCode}>
                <TableCell className="font-mono">{rate.currencyCode}</TableCell>
                <TableCell className="text-right font-mono">
                  {rate.rateToUsd}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatAsOf(rate.fetchedAt) ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
