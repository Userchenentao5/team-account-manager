import Link from "next/link";
import { Eye } from "lucide-react";
import type { DashboardExpiringChildAccountRow } from "@/db/dashboard";
import { formatMinor } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
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

type ExpiringChildAccountTableProps = {
  accounts: DashboardExpiringChildAccountRow[];
  soonDays: number;
};

function formatDays(daysUntilExpiry: number) {
  if (daysUntilExpiry < 0) {
    return `逾期 ${Math.abs(daysUntilExpiry)} 天`;
  }
  if (daysUntilExpiry === 0) {
    return "今天到期";
  }
  return `${daysUntilExpiry} 天后到期`;
}

export function ExpiringChildAccountTable({
  accounts,
  soonDays,
}: ExpiringChildAccountTableProps) {
  if (accounts.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-4 overflow-hidden rounded-xl border border-dashed bg-card/58 px-6 py-12 text-center shadow-[0_18px_55px_oklch(0.32_0.04_155_/_0.08)] backdrop-blur">
        <h2 className="text-lg font-semibold tracking-tight">
          非自用账号暂无到期风险
        </h2>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          当前没有已到期、逾期或 {soonDays} 天内到期的出租子账号。
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card/70 shadow-[0_18px_55px_oklch(0.32_0.04_155_/_0.08)] backdrop-blur">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">状态</TableHead>
            <TableHead scope="col">子账号</TableHead>
            <TableHead scope="col">所属空间</TableHead>
            <TableHead scope="col">到期日</TableHead>
            <TableHead scope="col">剩余/逾期</TableHead>
            <TableHead scope="col" className="text-right">
              应收 USD
            </TableHead>
            <TableHead scope="col">联系</TableHead>
            <TableHead scope="col" className="text-right">
              操作
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <ExpiryBadge
                  expiryDate={row.nextPaymentDate}
                  soonDays={soonDays}
                  expireOnDate
                />
              </TableCell>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <span className="font-mono">{row.email}</span>
                  <Badge variant="outline">{row.seatType}</Badge>
                </div>
                {row.label ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {row.label}
                  </div>
                ) : null}
              </TableCell>
              <TableCell>
                <Link href={`/spaces/${row.spaceId}`} className="hover:underline">
                  {row.spaceName}
                </Link>
              </TableCell>
              <TableCell className="font-mono">{row.nextPaymentDate}</TableCell>
              <TableCell className="font-mono">
                {formatDays(row.daysUntilExpiry)}
              </TableCell>
              <TableCell className="text-right font-mono">
                ${formatMinor(row.revenueUsdMinor, 2)} USD
              </TableCell>
              <TableCell>{row.contact || "-"}</TableCell>
              <TableCell className="text-right">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      aria-label="查看所属空间"
                    >
                      <Link href={`/spaces/${row.spaceId}`}>
                        <Eye className="size-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>查看所属空间</TooltipContent>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
