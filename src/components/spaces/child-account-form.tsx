"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  createChildAccount,
  updateChildAccount,
} from "@/actions/childAccounts";
import type { CurrencyRow } from "@/db/currencies";
import { formatMinor, parseToMinor } from "@/lib/money";
import {
  childAccountFormSchema,
  type ChildAccountFormInput,
} from "@/lib/validation/childAccount";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ChildAccountFormValue = ChildAccountFormInput & {
  id?: number;
};

type ChildAccountFormProps = {
  open: boolean;
  mode: "add" | "edit";
  spaceId: number;
  child?: ChildAccountFormValue;
  currencies: readonly CurrencyRow[];
  onOpenChange: (open: boolean) => void;
};

function defaultValues(): ChildAccountFormInput {
  return {
    seatType: "codex",
    email: "",
    contact: "",
    label: "",
    joinedDate: new Date().toISOString().slice(0, 10),
    monthlyAmountMinor: 1,
    monthlyCurrencyCode: "USD",
    monthlyPaymentDay: 1,
  };
}

export function ChildAccountForm({
  open,
  mode,
  spaceId,
  child,
  currencies,
  onOpenChange,
}: ChildAccountFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initialValues = child ?? defaultValues();
  const initialCurrency = currencies.find(
    (item) => item.code === initialValues.monthlyCurrencyCode,
  );
  const [amountInput, setAmountInput] = useState(() =>
    child
      ? formatMinor(
          initialValues.monthlyAmountMinor,
          initialCurrency?.minorUnit ?? 2,
        )
      : "",
  );
  const form = useForm<ChildAccountFormInput>({
    resolver: zodResolver(childAccountFormSchema),
    defaultValues: initialValues,
  });

  const selectedCurrency = useWatch({
    control: form.control,
    name: "monthlyCurrencyCode",
  });
  const selectedCurrencyMeta = useMemo(
    () => currencies.find((currency) => currency.code === selectedCurrency),
    [currencies, selectedCurrency],
  );

  function onSubmit(rawValues: ChildAccountFormInput) {
    const currency = currencies.find(
      (item) => item.code === rawValues.monthlyCurrencyCode,
    );
    if (!currency) {
      form.setError("monthlyCurrencyCode", { message: "请选择有效的币种。" });
      return;
    }

    let monthlyAmountMinor: number;
    try {
      monthlyAmountMinor = parseToMinor(amountInput, currency.minorUnit);
      if (monthlyAmountMinor <= 0) throw new Error("non-positive amount");
    } catch {
      form.setError("monthlyAmountMinor", { message: "请输入有效金额。" });
      return;
    }

    const values = { ...rawValues, monthlyAmountMinor };

    startTransition(async () => {
      try {
        const res =
          mode === "add"
            ? await createChildAccount(spaceId, values)
            : await updateChildAccount(child!.id!, values);

        if (res.ok) {
          toast.success(mode === "add" ? "已新增子账号" : "已保存修改");
          onOpenChange(false);
          router.refresh();
        } else {
          form.setError("root", { message: res.error });
          toast.error(res.error);
        }
      } catch {
        toast.error("保存失败，请重试。");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "新增子账号" : "编辑子账号"}
          </DialogTitle>
          <DialogDescription>
            只记录邮箱/登录名、席位信息和月度费用，不保存密码、令牌或任何凭据。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 md:grid-cols-2"
          >
            <FormField
              control={form.control}
              name="seatType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>席位类型</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="codex">codex</SelectItem>
                      <SelectItem value="chatgpt">chatgpt</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>邮箱/登录名</FormLabel>
                  <FormControl>
                    <Input placeholder="child@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>联系方式</FormLabel>
                  <FormControl>
                    <Input placeholder="微信/手机号" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>备注</FormLabel>
                  <FormControl>
                    <Input placeholder="例如：开发席位" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="joinedDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>加入日期</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="monthlyAmountMinor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>月度金额</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      placeholder="20.00"
                      value={amountInput}
                      onChange={(event) => {
                        setAmountInput(event.target.value);
                        field.onChange(Math.max(field.value, 1));
                      }}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {selectedCurrencyMeta
                      ? `${selectedCurrencyMeta.symbol} ${selectedCurrencyMeta.code} 使用 ${selectedCurrencyMeta.minorUnit} 位小数作为最小单位。`
                      : "金额会按所选币种的最小单位保存。"}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="monthlyCurrencyCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>月度币种</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.symbol} {currency.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="monthlyPaymentDay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>月付日</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      {...field}
                      onChange={(event) =>
                        field.onChange(Number(event.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.formState.errors.root ? (
              <p className="md:col-span-2 text-sm text-destructive">
                {form.formState.errors.root.message}
              </p>
            ) : null}
            <DialogFooter className="md:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "正在保存子账号..." : "保存子账号"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
