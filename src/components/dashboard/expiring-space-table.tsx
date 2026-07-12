import Link from "next/link";
import { Eye } from "lucide-react";
import type { DashboardExpiringSpaceRow } from "@/db/dashboard";
import { formatMinor } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExpiryBadge } from "@/components/spaces/expiry-badge";

type ExpiringSpaceTableProps = {
  spaces: DashboardExpiringSpaceRow[];
  soonDays: number;
};

function formatDays(daysUntilExpiry: number) {
  if (daysUntilExpiry < 0) {
    return `已过期 ${Math.abs(daysUntilExpiry)} 天`;
  }
  if (daysUntilExpiry === 0) {
    return "今天到期";
  }
  return `${daysUntilExpiry} 天后到期`;
}

export function ExpiringSpaceTable({
  spaces,
  soonDays,
}: ExpiringSpaceTableProps) {
  if (spaces.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-card/70 px-6 py-12 text-center">
        <h2 className="text-lg font-semibold tracking-tight">暂无到期风险</h2>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          当前没有已过期或 {soonDays} 天内到期的空间。
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card/70">
      <Table className="min-w-[720px]">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">状态</TableHead>
          <TableHead scope="col">空间</TableHead>
          <TableHead scope="col">到期日</TableHead>
          <TableHead scope="col">剩余/逾期</TableHead>
          <TableHead scope="col" className="text-right">
            空间支出 USD
          </TableHead>
          <TableHead scope="col" className="text-right">
            子账号
          </TableHead>
          <TableHead scope="col">支付渠道</TableHead>
          <TableHead scope="col" className="text-right">
            操作
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {spaces.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <ExpiryBadge expiryDate={row.expiryDate} soonDays={soonDays} />
            </TableCell>
            <TableCell className="font-medium">
              <Link href={`/spaces/${row.id}`} className="hover:underline">
                {row.name}
              </Link>
              <div className="mt-1 text-xs text-muted-foreground">
                {row.country}
              </div>
            </TableCell>
            <TableCell className="font-mono">{row.expiryDate}</TableCell>
            <TableCell className="font-mono">
              {formatDays(row.daysUntilExpiry)}
            </TableCell>
            <TableCell className="text-right font-mono">
              ${formatMinor(row.amountUsdMinor, 2)} USD
            </TableCell>
            <TableCell className="text-right font-mono">
              {row.childAccountCount}
            </TableCell>
            <TableCell>{row.paymentChannelName}</TableCell>
            <TableCell className="text-right">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label="查看空间详情"
                  >
                    <Link href={`/spaces/${row.id}`}>
                      <Eye className="size-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>查看空间详情</TooltipContent>
              </Tooltip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      </Table>
    </div>
  );
}
