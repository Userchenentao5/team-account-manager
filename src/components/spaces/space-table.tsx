"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { ChannelRow } from "@/db/channels";
import type { CurrencyRow } from "@/db/currencies";
import type { SpaceListRow } from "@/db/spaces";
import { formatCountryLabel } from "@/lib/countries";
import { formatCurrencyMinor } from "@/lib/currencies";
import { formatMinor } from "@/lib/money";
import { Button } from "@/components/ui/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExpiryBadge } from "./expiry-badge";
import { SpaceDeleteDialog } from "./space-delete-dialog";
import { SpaceForm, type SpaceFormValue } from "./space-form";

type SpaceTableProps = {
  spaces: SpaceListRow[];
  filterSpaces: SpaceListRow[];
  channels: ChannelRow[];
  currencies: CurrencyRow[];
  cnyReferences: Record<number, string>;
  selectedCountry?: string;
  selectedChannel?: number;
  spaceSoonDays: number;
};

const PAGE_SIZE = 10;

type SortKey = "name" | "country" | "channel" | "amount" | "expiry";
type SortDirection = "asc" | "desc";

type SortState = {
  key: SortKey;
  direction: SortDirection;
};

function toFormValue(row: SpaceListRow): SpaceFormValue {
  const { space, motherAccount } = row;
  return {
    id: space.id,
    name: space.name,
    country: space.country,
    paymentChannelId: space.paymentChannelId,
    currencyCode: space.currencyCode,
    amountMinor: space.amountMinor,
    openingDate: space.openingDate ?? "",
    currentPeriodStartDate:
      space.currentPeriodStartDate ?? space.openingDate ?? "",
    periodUnit: (space.periodUnit ?? "month") as SpaceFormValue["periodUnit"],
    periodCount: space.periodCount ?? 1,
    motherEmail: motherAccount.email,
  };
}

function buildHref(country?: string, channel?: number): string {
  const params = new URLSearchParams();
  if (country) params.set("country", country);
  if (channel) params.set("channel", String(channel));
  const query = params.toString();
  return query ? `/spaces?${query}` : "/spaces";
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "zh-Hans-CN", {
    numeric: true,
    sensitivity: "base",
  });
}

function compareNullableText(
  left: string | null,
  right: string | null,
): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return compareText(left, right);
}

function compareRows(
  left: SpaceListRow,
  right: SpaceListRow,
  key: SortKey,
): number {
  switch (key) {
    case "name":
      return compareText(left.space.name, right.space.name);
    case "country":
      return compareText(
        formatCountryLabel(left.space.country),
        formatCountryLabel(right.space.country),
      );
    case "channel":
      return compareText(left.paymentChannel.name, right.paymentChannel.name);
    case "amount":
      return left.space.amountMinor - right.space.amountMinor;
    case "expiry":
      return compareNullableText(left.space.expiryDate, right.space.expiryDate);
    default:
      return 0;
  }
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  const Icon = active
    ? sort.direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;
  return (
    <TableHead scope="col" className="text-center">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mx-auto h-8 px-1.5 font-medium"
        aria-sort={
          active
            ? sort.direction === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
        onClick={() => onSort(sortKey)}
      >
        {label}
        <Icon className="size-3.5" />
      </Button>
    </TableHead>
  );
}

export function SpaceTable({
  spaces,
  filterSpaces,
  channels,
  currencies,
  cnyReferences,
  selectedCountry,
  selectedChannel,
  spaceSoonDays,
}: SpaceTableProps) {
  const router = useRouter();
  const [formState, setFormState] =
    useState<{ mode: "add" } | { mode: "edit"; space: SpaceFormValue } | null>(
      null,
    );
  const [deleteTarget, setDeleteTarget] = useState<SpaceListRow | null>(null);
  const [sort, setSort] = useState<SortState>({
    key: "expiry",
    direction: "asc",
  });
  const [page, setPage] = useState(1);
  const countryOptions = useMemo(() => {
    const rows = selectedChannel
      ? filterSpaces.filter(
          ({ space }) => space.paymentChannelId === selectedChannel,
        )
      : filterSpaces;
    const options = new Map<string, string>();
    for (const { space } of rows) {
      options.set(space.country, formatCountryLabel(space.country));
    }
    return Array.from(options, ([code, label]) => ({ code, label })).sort(
      (left, right) => left.label.localeCompare(right.label, "zh-Hans-CN"),
    );
  }, [filterSpaces, selectedChannel]);
  const channelOptions = useMemo(() => {
    const rows = selectedCountry
      ? filterSpaces.filter(({ space }) => space.country === selectedCountry)
      : filterSpaces;
    const options = new Map<number, string>();
    for (const { paymentChannel } of rows) {
      options.set(paymentChannel.id, paymentChannel.name);
    }
    return Array.from(options, ([id, name]) => ({ id, name })).sort((left, right) =>
      left.name.localeCompare(right.name, "zh-Hans-CN"),
    );
  }, [filterSpaces, selectedCountry]);
  const hasFilters = Boolean(selectedCountry || selectedChannel);
  const sortedSpaces = useMemo(() => {
    return [...spaces].sort((left, right) => {
      const result = compareRows(left, right, sort.key);
      return sort.direction === "asc" ? result : -result;
    });
  }, [spaces, sort]);
  const pageCount = Math.max(1, Math.ceil(sortedSpaces.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleSpaces = sortedSpaces.slice(pageStart, pageStart + PAGE_SIZE);
  const rangeStart = sortedSpaces.length === 0 ? 0 : pageStart + 1;
  const rangeEnd = Math.min(pageStart + PAGE_SIZE, sortedSpaces.length);

  function setCountry(value: string) {
    setPage(1);
    router.push(buildHref(value === "all" ? undefined : value, selectedChannel));
  }

  function setChannel(value: string) {
    setPage(1);
    router.push(
      buildHref(
        selectedCountry,
        value === "all" ? undefined : Number(value),
      ),
    );
  }

  function setSortKey(key: SortKey) {
    setPage(1);
    setSort((current) =>
      current.key === key
        ? {
            key,
            direction: current.direction === "asc" ? "desc" : "asc",
          }
        : { key, direction: "asc" },
    );
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b bg-background/95 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">空间</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            按国家/地区、支付渠道筛选空间，并查看冻结成本与到期状态。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedCountry ?? "all"} onValueChange={setCountry}>
            <SelectTrigger className="w-40" aria-label="按国家/地区筛选">
              <SelectValue placeholder="全部国家/地区" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部国家/地区</SelectItem>
              {countryOptions.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {country.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedChannel ? String(selectedChannel) : "all"}
            onValueChange={setChannel}
          >
            <SelectTrigger className="w-40" aria-label="按支付渠道筛选">
              <SelectValue placeholder="全部渠道" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部渠道</SelectItem>
              {channelOptions.map((channel) => (
                <SelectItem key={channel.id} value={String(channel.id)}>
                  {channel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setFormState({ mode: "add" })}>
            <Plus className="size-4" />
            新增空间
          </Button>
        </div>
      </div>
      </div>

      {spaces.length === 0 ? (
        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6 lg:px-8">
          {hasFilters ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 py-12 text-center">
            <h2 className="text-lg font-semibold">没有符合条件的空间</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              调整或清除筛选条件后再试。
            </p>
          </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 py-12 text-center">
            <h2 className="text-lg font-semibold">还没有空间</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              创建你的第一个空间，记录归属国家、支付渠道、金额与订阅周期，系统会自动算出到期日并冻结 USD 金额。
            </p>
            <Button onClick={() => setFormState({ mode: "add" })}>
              <Plus className="size-4" />
              新增空间
            </Button>
          </div>
          )}
        </div>
      ) : (
        <>
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4 sm:px-6 lg:px-8">
            <table
              data-slot="table"
              className="w-full min-w-[980px] caption-bottom text-sm"
            >
          <TableHeader className="sticky top-0 z-20 bg-background shadow-sm [&_th]:bg-background">
            <TableRow>
              <SortableHead
                label="名称"
                sortKey="name"
                sort={sort}
                onSort={setSortKey}
              />
              <TableHead scope="col" className="text-center">
                母号邮箱
              </TableHead>
              <SortableHead
                label="国家/地区"
                sortKey="country"
                sort={sort}
                onSort={setSortKey}
              />
              <SortableHead
                label="支付渠道"
                sortKey="channel"
                sort={sort}
                onSort={setSortKey}
              />
              <SortableHead
                label="金额"
                sortKey="amount"
                sort={sort}
                onSort={setSortKey}
              />
              <SortableHead
                label="到期日"
                sortKey="expiry"
                sort={sort}
                onSort={setSortKey}
              />
              <TableHead scope="col" className="text-center">
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleSpaces.map((row) => {
              const { space, motherAccount, paymentChannel, currency } = row;
              return (
                <TableRow key={space.id}>
                  <TableCell className="text-center font-medium">
                    <Link
                      href={`/spaces/${space.id}`}
                      className="hover:underline"
                    >
                      {space.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    {motherAccount.email}
                  </TableCell>
                  <TableCell className="text-center">
                    {formatCountryLabel(space.country)}
                  </TableCell>
                  <TableCell className="text-center">{paymentChannel.name}</TableCell>
                  <TableCell className="text-center font-mono">
                    <div className="inline-flex flex-col items-start gap-1.5 text-left tabular-nums">
                      <span className="font-medium text-foreground">
                        {formatCurrencyMinor(space.amountMinor, currency)}
                      </span>
                      <span className="flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
                        <span>
                          {space.amountUsd === null
                            ? "暂无 USD"
                            : `$${formatMinor(space.amountUsd, 2)} USD`}
                        </span>
                        <span aria-hidden className="h-3 w-px bg-border" />
                        <span>
                          {cnyReferences[space.id] ?? "暂无 CNY 参考"}
                        </span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-mono">
                        {space.expiryDate ?? "-"}
                      </span>
                      <ExpiryBadge
                        expiryDate={space.expiryDate}
                        soonDays={spaceSoonDays}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="size-11"
                            aria-label={`查看 ${space.name}`}
                          >
                            <Link href={`/spaces/${space.id}`}>
                              <Eye className="size-4" />
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>详情</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-11"
                            aria-label={`编辑 ${space.name}`}
                            onClick={() =>
                              setFormState({
                                mode: "edit",
                                space: toFormValue(row),
                              })
                            }
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>编辑</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-11"
                            aria-label={`删除 ${space.name}`}
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>删除</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
            </table>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-background px-4 py-3 sm:px-6 lg:px-8">
            <p className="text-sm text-muted-foreground">
              显示 {rangeStart}-{rangeEnd} 条，共 {sortedSpaces.length} 条
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="size-4" />
                上一页
              </Button>
              <span className="min-w-16 text-center text-sm text-muted-foreground">
                {currentPage} / {pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((current) => Math.min(pageCount, current + 1))
                }
                disabled={currentPage >= pageCount}
              >
                下一页
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {formState ? (
        <SpaceForm
          key={formState.mode === "edit" ? formState.space.id : "add"}
          open
          mode={formState.mode}
          space={formState.mode === "edit" ? formState.space : undefined}
          channels={channels}
          currencies={currencies}
          onOpenChange={(open) => {
            if (!open) setFormState(null);
          }}
        />
      ) : null}
      {deleteTarget ? (
        <SpaceDeleteDialog
          open
          space={{
            id: deleteTarget.space.id,
            name: deleteTarget.space.name,
          }}
          childCount={deleteTarget.childCount}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}
