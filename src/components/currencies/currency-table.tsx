"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { CurrencyRow } from "@/db/currencies";
import type { CurrencyMeta } from "@/lib/currencies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CurrencyDialog } from "./currency-dialog";
import { CurrencyDeleteDialog } from "./currency-delete-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type CurrencyTableProps = {
  currencies: CurrencyRow[];
  rateCurrencies: readonly CurrencyMeta[];
};

type DialogState =
  | { mode: "add" }
  | { mode: "edit"; currency: CurrencyRow }
  | null;

export function CurrencyTable({
  currencies,
  rateCurrencies,
}: CurrencyTableProps) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleteTarget, setDeleteTarget] = useState<CurrencyRow | null>(null);
  const [countryQuery, setCountryQuery] = useState("");
  const existingCodes = currencies.map((currency) => currency.code);
  const normalizedCountryQuery = countryQuery.trim().toLowerCase();
  const filteredCurrencies = normalizedCountryQuery
    ? currencies.filter((currency) =>
        [
          currency.countryName,
          currency.countryCode,
          currency.name,
          currency.code,
        ].some((value) =>
          value.toLowerCase().includes(normalizedCountryQuery),
        ),
      )
    : currencies;

  return (
    <div className="flex h-[calc(100vh-3rem)] min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b bg-background p-6 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold leading-tight">币种</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              币种是系统参考数据,用于金额输入、汇率缓存和 USD 成本折算。新增币种只保存元数据,不会自动生成汇率;没有缓存汇率时,创建空间会被阻断。
            </p>
          </div>
          <Button onClick={() => setDialog({ mode: "add" })}>
            <Plus className="size-4" />
            新增币种
          </Button>
        </div>

        <div className="mt-4 max-w-sm">
          <Input
            value={countryQuery}
            onChange={(event) => setCountryQuery(event.target.value)}
            placeholder="筛选国家/地区"
          />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          最小单位位数表示金额允许的小数位数,以币种元数据为准。
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-6 pb-4">
      <table data-slot="table" className="w-full caption-bottom text-sm">
        <TableHeader className="sticky top-0 z-20 bg-background shadow-sm [&_th]:bg-background">
          <TableRow>
            <TableHead scope="col">国家/地区</TableHead>
            <TableHead scope="col">代码</TableHead>
            <TableHead scope="col">符号</TableHead>
            <TableHead scope="col">名称</TableHead>
            <TableHead scope="col" className="text-right">
              最小单位位数
            </TableHead>
            <TableHead scope="col" className="text-right">
              操作
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredCurrencies.map((row) => (
            <TableRow key={row.code}>
              <TableCell>{row.countryName}</TableCell>
              <TableCell className="font-mono">{row.code}</TableCell>
              <TableCell className="font-mono">{row.symbol}</TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell className="text-right font-mono">
                {row.minorUnit}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-11"
                        aria-label={`编辑 ${row.code}`}
                        onClick={() => setDialog({ mode: "edit", currency: row })}
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
                        aria-label={`删除 ${row.code}`}
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
          ))}
          {filteredCurrencies.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                没有匹配的国家/地区
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </table>
      </div>

      <CurrencyDialog
        open={dialog !== null}
        mode={dialog?.mode ?? "add"}
        currency={dialog?.mode === "edit" ? dialog.currency : undefined}
        rateCurrencies={rateCurrencies}
        existingCodes={existingCodes}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      />
      <CurrencyDeleteDialog
        currency={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
