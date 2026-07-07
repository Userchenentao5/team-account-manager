"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  createChildAccount,
  renewChildAccount,
  updateChildAccount,
} from "@/actions/childAccounts";
import type { ChildAccountListRow } from "@/db/childAccounts";
import type { CurrencyRow } from "@/db/currencies";
import { formatCurrencyMinor } from "@/lib/currencies";
import { nextPaymentDueDate, type Period } from "@/lib/expiry";
import { formatMinor, parseToMinor } from "@/lib/money";
import {
  childAccountFormSchema,
  type ChildAccountFormInput,
} from "@/lib/validation/childAccount";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ChildAccountDeleteDialog } from "./child-account-delete-dialog";
import { ExpiryBadge } from "./expiry-badge";

type ChildAccountTableProps = {
  spaceId: number;
  accounts: ChildAccountListRow[];
  currencies: CurrencyRow[];
  childAccountSoonDays: number;
};

const CONTACT_REQUIRED_ERROR = "非自用子账号请输入联系方式。";

const BILLING_PERIOD_OPTIONS = [
  { label: "月", unit: "month", count: 1 },
  { label: "季", unit: "quarter", count: 1 },
  { label: "半年", unit: "month", count: 6 },
  { label: "年", unit: "year", count: 1 },
] as const;

type ChildAccountFormValue = ChildAccountFormInput & {
  id?: number;
};

type BillingPeriodValue = {
  billingPeriodUnit: string;
  billingPeriodCount: number;
};

type InlineChildAccountRowProps = {
  mode: "add" | "edit";
  spaceId: number;
  initialValue: ChildAccountFormValue;
  currencies: readonly CurrencyRow[];
  childAccountSoonDays: number;
  onCancel: () => void;
  onSaved: () => void;
};

function defaultFormValue(currencies: readonly CurrencyRow[]): ChildAccountFormValue {
  const today = new Date();
  return {
    seatType: "codex",
    email: "",
    contact: "",
    label: "",
    joinedDate: localIsoDate(today),
    monthlyAmountMinor: 1,
    monthlyCurrencyCode:
      currencies.find((currency) => currency.code === "CNY")?.code ??
      currencies[0]?.code ??
      "CNY",
    billingPeriodUnit: "month",
    billingPeriodCount: 1,
    monthlyPaymentDay: today.getDate(),
  };
}

function localIsoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toFormValue(row: ChildAccountListRow): ChildAccountFormValue {
  const child = row.childAccount;
  return {
    id: child.id,
    seatType: child.seatType as ChildAccountFormValue["seatType"],
    email: child.email,
    contact: child.contact,
    label: child.label,
    joinedDate: child.joinedDate,
    monthlyAmountMinor: child.monthlyAmountMinor,
    monthlyCurrencyCode: child.monthlyCurrencyCode,
    billingPeriodUnit:
      child.billingPeriodUnit as ChildAccountFormValue["billingPeriodUnit"],
    billingPeriodCount: child.billingPeriodCount,
    monthlyPaymentDay: child.monthlyPaymentDay,
  };
}

function childExpiryDate(child: ChildAccountListRow["childAccount"]): string {
  return (
    child.nextPaymentDate ??
    nextPaymentDueDate(child.monthlyPaymentDay, childBillingPeriod(child))
  );
}

function childDisplayStatus(
  child: ChildAccountListRow["childAccount"],
): "self" | undefined {
  return child.monthlyRateSource === "self-use" ? "self" : undefined;
}

function draftExpiryDate(draft: ChildAccountFormValue): string | null {
  return Number.isInteger(draft.monthlyPaymentDay) &&
    draft.monthlyPaymentDay >= 1 &&
    draft.monthlyPaymentDay <= 31
    ? nextPaymentDueDate(
        draft.monthlyPaymentDay,
        childBillingPeriod(draft),
        draft.joinedDate,
      )
    : null;
}

function childBillingPeriod(value: BillingPeriodValue): Period {
  return {
    unit: value.billingPeriodUnit as Period["unit"],
    count: value.billingPeriodCount,
  };
}

function billingPeriodValue(value: BillingPeriodValue): string {
  return `${value.billingPeriodUnit}:${value.billingPeriodCount}`;
}

function billingPeriodLabel(value: BillingPeriodValue): string {
  return (
    BILLING_PERIOD_OPTIONS.find(
      (option) =>
        option.unit === value.billingPeriodUnit &&
        option.count === value.billingPeriodCount,
    )?.label ?? "月"
  );
}

function parseBillingPeriod(value: string) {
  const option = BILLING_PERIOD_OPTIONS.find(
    (item) => `${item.unit}:${item.count}` === value,
  );
  return option ?? BILLING_PERIOD_OPTIONS[0];
}

function InlineChildAccountRow({
  mode,
  spaceId,
  initialValue,
  currencies,
  childAccountSoonDays,
  onCancel,
  onSaved,
}: InlineChildAccountRowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<{
    field?: keyof ChildAccountFormInput;
    message: string;
  } | null>(null);
  const [draft, setDraft] = useState<ChildAccountFormValue>(initialValue);
  const initialCurrency = currencies.find(
    (currency) => currency.code === initialValue.monthlyCurrencyCode,
  );
  const [amountInput, setAmountInput] = useState(() =>
    mode === "edit"
      ? formatMinor(
          initialValue.monthlyAmountMinor,
          initialCurrency?.minorUnit ?? 2,
        )
      : "",
  );
  const selectedCurrency = useMemo(
    () => currencies.find((currency) => currency.code === draft.monthlyCurrencyCode),
    [currencies, draft.monthlyCurrencyCode],
  );
  const draftAmountMinor = useMemo(() => {
    if (!selectedCurrency || amountInput.trim() === "") return draft.monthlyAmountMinor;
    try {
      return parseToMinor(amountInput, selectedCurrency.minorUnit);
    } catch {
      return draft.monthlyAmountMinor;
    }
  }, [amountInput, draft.monthlyAmountMinor, selectedCurrency]);

  function updateDraft<Key extends keyof ChildAccountFormInput>(
    key: Key,
    value: ChildAccountFormInput[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function onSave() {
    const currency = selectedCurrency;
    if (!currency) {
      setError({ field: "monthlyCurrencyCode", message: "请选择有效的月度币种。" });
      return;
    }

    let monthlyAmountMinor: number;
    try {
      monthlyAmountMinor = parseToMinor(amountInput, currency.minorUnit);
      if (monthlyAmountMinor < 0) throw new Error("negative amount");
    } catch {
      setError({ field: "monthlyAmountMinor", message: "请输入有效的月度金额。" });
      return;
    }

    const parsed = childAccountFormSchema.safeParse({
      ...draft,
      monthlyAmountMinor,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path[0];
      setError({
        field:
          typeof field === "string"
            ? (field as keyof ChildAccountFormInput)
            : undefined,
        message: issue?.message ?? "子账号信息无效。",
      });
      return;
    }

    startTransition(async () => {
      try {
        const res =
          mode === "add"
            ? await createChildAccount(spaceId, parsed.data)
            : await updateChildAccount(draft.id!, parsed.data);

        if (res.ok) {
          toast.success(mode === "add" ? "已新增子账号" : "已保存子账号");
          onSaved();
          router.refresh();
        } else {
          setError({
            field: res.error === CONTACT_REQUIRED_ERROR ? "contact" : undefined,
            message: res.error,
          });
          toast.error(res.error);
        }
      } catch {
        toast.error("保存失败，请重试。");
      }
    });
  }

  return (
    <>
      <TableRow className="bg-muted/30 hover:bg-muted/30">
        <TableCell className="min-w-28">
          <Select
            value={draft.seatType}
            onValueChange={(value) =>
              updateDraft(
                "seatType",
                value as ChildAccountFormInput["seatType"],
              )
            }
          >
            <SelectTrigger className="w-24" aria-label="席位类型">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="codex">codex</SelectItem>
              <SelectItem value="chatgpt">chatgpt</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="min-w-64">
          <Input
            value={draft.email}
            onChange={(event) => updateDraft("email", event.target.value)}
            placeholder="child@example.com"
            disabled={isPending}
            className="font-mono"
          />
        </TableCell>
        <TableCell className="min-w-48">
          <div className="space-y-1">
            <Input
              value={draft.contact}
              onChange={(event) => updateDraft("contact", event.target.value)}
              placeholder="微信/手机号"
              disabled={isPending}
              aria-invalid={error?.field === "contact"}
            />
            {error?.field === "contact" ? (
              <p className="text-xs text-destructive">{error.message}</p>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="min-w-40">
          <Input
            type="date"
            value={draft.joinedDate}
            onChange={(event) => updateDraft("joinedDate", event.target.value)}
            disabled={isPending}
            className="font-mono"
          />
        </TableCell>
        <TableCell className="min-w-56">
          <div className="flex justify-center gap-2">
            <Input
              inputMode="decimal"
              value={amountInput}
              onChange={(event) => {
                setAmountInput(event.target.value);
                setError(null);
              }}
              placeholder="20.00"
              disabled={isPending}
              className="w-24 text-right font-mono"
            />
            <Select
              value={draft.monthlyCurrencyCode}
              onValueChange={(value) =>
                updateDraft("monthlyCurrencyCode", value)
              }
            >
              <SelectTrigger className="w-24" aria-label="订阅币种">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64" position="popper">
                {currencies.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.symbol} {currency.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TableCell>
        <TableCell className="min-w-44">
          <div className="space-y-1">
            <div className="flex justify-center gap-2">
              <Select
                value={billingPeriodValue(draft)}
                onValueChange={(value) => {
                  const period = parseBillingPeriod(value);
                  setDraft((current) => ({
                    ...current,
                    billingPeriodUnit: period.unit,
                    billingPeriodCount: period.count,
                  }));
                  setError(null);
                }}
              >
                <SelectTrigger className="w-20" aria-label="订阅周期">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_PERIOD_OPTIONS.map((option) => (
                    <SelectItem
                      key={`${option.unit}:${option.count}`}
                      value={`${option.unit}:${option.count}`}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                max={31}
                value={draft.monthlyPaymentDay}
                onChange={(event) =>
                  updateDraft("monthlyPaymentDay", Number(event.target.value))
                }
                disabled={isPending}
                className="w-16 font-mono"
                aria-label="付款日"
                aria-invalid={error?.field === "monthlyPaymentDay"}
              />
            </div>
            {error?.field === "monthlyPaymentDay" ||
            error?.field === "billingPeriodCount" ? (
              <p className="text-xs text-destructive">{error.message}</p>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="font-mono">
          {draftAmountMinor === 0 ? "-" : draftExpiryDate(draft)}
        </TableCell>
        <TableCell>
          <ExpiryBadge
            expiryDate={draftExpiryDate(draft)}
            soonDays={childAccountSoonDays}
            displayStatus={draftAmountMinor === 0 ? "self" : undefined}
            expireOnDate
          />
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  className="size-9"
                  onClick={onSave}
                  disabled={isPending}
                  aria-label={mode === "add" ? "保存新增子账号" : "保存子账号修改"}
                >
                  <Check className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>保存</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9"
                  onClick={onCancel}
                  disabled={isPending}
                  aria-label="取消编辑子账号"
                >
                  <X className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>取消</TooltipContent>
            </Tooltip>
          </div>
        </TableCell>
      </TableRow>
      {error && !error.field ? (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={9} className="pt-0 text-sm text-destructive">
            {error.message}
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

export function ChildAccountTable({
  spaceId,
  accounts,
  currencies,
  childAccountSoonDays,
}: ChildAccountTableProps) {
  const [formState, setFormState] =
    useState<
      | { mode: "add" }
      | { mode: "edit"; child: ChildAccountFormValue }
      | null
    >(null);
  const [deleteTarget, setDeleteTarget] = useState<
    ChildAccountListRow["childAccount"] | null
  >(null);
  const [renewTarget, setRenewTarget] = useState<
    ChildAccountListRow["childAccount"] | null
  >(null);
  const [renewAmount, setRenewAmount] = useState("");
  const router = useRouter();
  const [isRenewPending, startRenewTransition] = useTransition();
  const isEditingRow = formState !== null;
  const shouldShowTable = accounts.length > 0 || formState?.mode === "add";

  function onRenew() {
    if (!renewTarget || renewAmount.trim() === "") return;

    startRenewTransition(async () => {
      try {
        const res = await renewChildAccount(renewTarget.id);
        if (res.ok) {
          toast.success("已续费，状态已恢复正常");
          setRenewTarget(null);
          setRenewAmount("");
          router.refresh();
        } else {
          toast.error(res.error);
        }
      } catch {
        toast.error("续费失败，请重试。");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">子账号</h2>
          <p className="text-sm text-muted-foreground">
            在当前空间下管理 codex 或 chatgpt 子账号。
          </p>
        </div>
        <Button
          onClick={() => setFormState({ mode: "add" })}
          disabled={isEditingRow}
        >
          <Plus className="size-4" />
          {formState?.mode === "add" ? "正在新增" : "新增子账号"}
        </Button>
      </div>

      {shouldShowTable ? (
        <Table className="[&_td]:text-center [&_th]:text-center">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">类型</TableHead>
              <TableHead scope="col">邮箱/登录名</TableHead>
              <TableHead scope="col">联系方式</TableHead>
              <TableHead scope="col">加入日期</TableHead>
              <TableHead scope="col" className="text-right">
                订阅原价
              </TableHead>
              <TableHead scope="col">周期 / 付款日</TableHead>
              <TableHead scope="col">到期日</TableHead>
              <TableHead scope="col">状态</TableHead>
              <TableHead scope="col" className="text-right">
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formState?.mode === "add" ? (
              <InlineChildAccountRow
                key="add"
                mode="add"
                spaceId={spaceId}
                initialValue={defaultFormValue(currencies)}
                currencies={currencies}
                childAccountSoonDays={childAccountSoonDays}
                onCancel={() => setFormState(null)}
                onSaved={() => setFormState(null)}
              />
            ) : null}
            {accounts.map((row) => {
              const child = row.childAccount;
              const displayStatus = childDisplayStatus(child);
              const isSelfUse = displayStatus === "self";
              const isEditingCurrent =
                formState?.mode === "edit" && formState.child.id === child.id;

              if (isEditingCurrent) {
                return (
                  <InlineChildAccountRow
                    key={child.id}
                    mode="edit"
                    spaceId={spaceId}
                    initialValue={formState.child}
                    currencies={currencies}
                    childAccountSoonDays={childAccountSoonDays}
                    onCancel={() => setFormState(null)}
                    onSaved={() => setFormState(null)}
                  />
                );
              }

              return (
                <TableRow key={child.id}>
                  <TableCell>
                    <Badge
                      variant={child.seatType === "codex" ? "secondary" : "outline"}
                    >
                      {child.seatType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{child.email}</TableCell>
                  <TableCell>{child.contact || "-"}</TableCell>
                  <TableCell className="font-mono">{child.joinedDate}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrencyMinor(child.monthlyAmountMinor, row.currency)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {isSelfUse
                      ? "-"
                      : `${billingPeriodLabel(child)} / ${child.monthlyPaymentDay} 日`}
                  </TableCell>
                  <TableCell className="font-mono">
                    {isSelfUse ? "-" : childExpiryDate(child)}
                  </TableCell>
                  <TableCell>
                    <ExpiryBadge
                      expiryDate={childExpiryDate(child)}
                      soonDays={childAccountSoonDays}
                      displayStatus={displayStatus}
                      expireOnDate
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-center gap-1">
                      {isSelfUse ? null : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-11"
                              aria-label={`续费 ${child.email}`}
                              onClick={() => setRenewTarget(child)}
                              disabled={isEditingRow || isRenewPending}
                            >
                              <RefreshCw className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>续费</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-11"
                            aria-label={`编辑 ${child.email}`}
                            onClick={() =>
                              setFormState({
                                mode: "edit",
                                child: toFormValue(row),
                              })
                            }
                            disabled={isEditingRow}
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
                            aria-label={`删除 ${child.email}`}
                            onClick={() => setDeleteTarget(child)}
                            disabled={isEditingRow}
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
        </Table>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-12 text-center">
          <h3 className="text-base font-semibold">还没有子账号</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            在当前空间下新增 codex 或 chatgpt 子账号，只记录邮箱/登录名和席位信息，不保存密码或凭据。
          </p>
        </div>
      )}

      <ChildAccountDeleteDialog
        child={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
      <AlertDialog
        open={renewTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenewTarget(null);
            setRenewAmount("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认子账号续费</AlertDialogTitle>
            <AlertDialogDescription>
              请输入对方交钱的数额，留空无法续费。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="child-renew-amount" className="text-sm font-medium">
              对方交钱数额
            </label>
            <Input
              id="child-renew-amount"
              inputMode="decimal"
              value={renewAmount}
              onChange={(event) => setRenewAmount(event.target.value)}
              placeholder="例如：20.00"
              disabled={isRenewPending}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRenewPending}>取消</AlertDialogCancel>
            <Button
              onClick={onRenew}
              disabled={isRenewPending || renewAmount.trim() === ""}
            >
              {isRenewPending ? "续费中..." : "确认续费"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
