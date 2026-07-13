"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { addCurrency, updateCurrency } from "@/actions/currencies";
import type { CurrencyRow } from "@/db/currencies";
import type { CurrencyMeta } from "@/lib/currencies";
import {
  currencySchema,
  type CurrencyValue,
} from "@/lib/validation/currency";
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

type CurrencyDialogProps = {
  open: boolean;
  mode: "add" | "edit";
  currency?: CurrencyRow;
  rateCurrencies: readonly CurrencyMeta[];
  existingCodes: string[];
  onOpenChange: (open: boolean) => void;
};

export function CurrencyDialog({
  open,
  mode,
  currency,
  rateCurrencies,
  existingCodes,
  onOpenChange,
}: CurrencyDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [countryQuery, setCountryQuery] = useState("");
  const form = useForm<CurrencyValue>({
    resolver: zodResolver(currencySchema),
    defaultValues: {
      code: "",
      countryCode: "",
      countryName: "",
      name: "",
      symbol: "",
      minorUnit: 2,
    },
  });
  const addableCurrencies = useMemo(
    () =>
      rateCurrencies.filter(
        (option) => !existingCodes.includes(option.code),
      ),
    [existingCodes, rateCurrencies],
  );
  const normalizedCountryQuery = countryQuery.trim().toLowerCase();
  const filteredAddableCurrencies = normalizedCountryQuery
    ? addableCurrencies.filter((option) =>
        [
          option.countryName,
          option.countryCode,
          option.name,
          option.code,
        ].some((value) =>
          value.toLowerCase().includes(normalizedCountryQuery),
        ),
      )
    : addableCurrencies;
  const selectedCountryCode = useWatch({
    control: form.control,
    name: "countryCode",
  });
  const selectedRateCurrency = useMemo(
    () =>
      addableCurrencies.find(
        (option) => option.countryCode === selectedCountryCode,
      ),
    [addableCurrencies, selectedCountryCode],
  );

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && currency) {
      form.reset({
        code: currency.code,
        countryCode: currency.countryCode,
        countryName: currency.countryName,
        name: currency.name,
        symbol: currency.symbol,
        minorUnit: currency.minorUnit,
      });
      return;
    }
    form.reset({
      code: "",
      countryCode: "",
      countryName: "",
      name: "",
      symbol: "",
      minorUnit: 2,
    });
  }, [currency, form, mode, open]);

  function close(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setCountryQuery("");
      form.reset({
        code: "",
        countryCode: "",
        countryName: "",
        name: "",
        symbol: "",
        minorUnit: 2,
      });
    }
  }

  function applyRateCountry(countryCode: string) {
    const option = rateCurrencies.find(
      (item) => item.countryCode === countryCode,
    );
    if (!option) return;
    form.setValue("code", option.code, { shouldValidate: true });
    form.setValue("countryCode", option.countryCode, { shouldValidate: true });
    form.setValue("countryName", option.countryName, { shouldValidate: true });
    form.setValue("name", option.name, { shouldValidate: true });
    form.setValue("symbol", option.symbol, { shouldValidate: true });
    form.setValue("minorUnit", option.minorUnit, { shouldValidate: true });
  }

  function onSubmit(values: CurrencyValue) {
    startTransition(async () => {
      try {
        const res =
          mode === "add"
            ? await addCurrency(values)
            : await updateCurrency(currency!.code, {
                name: values.name,
                symbol: values.symbol,
                minorUnit: values.minorUnit,
              });
        if (res.ok) {
          toast.success(mode === "add" ? "已添加币种" : "已保存币种");
          close(false);
        } else {
          form.setError(res.field ?? "code", { message: res.error });
        }
      } catch {
        toast.error("保存失败，请重试。");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "新增币种" : "编辑币种"}</DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "选择国家/地区后会自动加入对应币种。新增后刷新汇率即可获取该币种缓存。"
              : "修改名称、符号或最小单位位数；代码保持不变。"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 sm:grid-cols-2"
          >
            {mode === "add" ? (
              <div className="sm:col-span-2">
                <Input
                  value={countryQuery}
                  onChange={(event) => setCountryQuery(event.target.value)}
                  placeholder="筛选国家/地区"
                />
              </div>
            ) : null}
            <FormField
              control={form.control}
              name={mode === "add" ? "countryCode" : "code"}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{mode === "add" ? "国家/地区" : "代码"}</FormLabel>
                  {mode === "add" ? (
                    <Select
                      value={field.value || undefined}
                      onValueChange={(value) => {
                        field.onChange(value);
                        applyRateCountry(value);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="选择国家/地区" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredAddableCurrencies.map((option) => (
                          <SelectItem
                            key={option.code}
                            value={option.countryCode}
                          >
                            {option.countryName} - {option.name} ({option.code})
                          </SelectItem>
                        ))}
                        {filteredAddableCurrencies.length === 0 ? (
                          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                            没有匹配的国家/地区
                          </div>
                        ) : null}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormControl>
                      <Input disabled {...field} />
                    </FormControl>
                  )}
                  {mode === "add" && addableCurrencies.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      汇率服务支持的国家/地区均已加入币种表。
                    </p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />
            {mode === "add" && selectedRateCurrency ? (
              <div className="rounded-lg border p-3 text-sm sm:col-span-2">
                <div className="font-medium">
                  将添加 {selectedRateCurrency.countryName}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {selectedRateCurrency.name} ({selectedRateCurrency.code}) ·{" "}
                  {selectedRateCurrency.symbol} · 最小单位{" "}
                  {selectedRateCurrency.minorUnit} 位
                </div>
              </div>
            ) : null}
            <FormField
              control={form.control}
              name="symbol"
              render={({ field }) => (
                <FormItem className={mode === "add" ? "hidden" : undefined}>
                  <FormLabel>符号</FormLabel>
                  <FormControl>
                    <Input placeholder="A$" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className={mode === "add" ? "hidden" : undefined}>
                  <FormLabel>名称</FormLabel>
                  <FormControl>
                    <Input placeholder="澳大利亚元" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="minorUnit"
              render={({ field }) => (
                <FormItem className={mode === "add" ? "hidden" : undefined}>
                  <FormLabel>最小单位位数</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={6}
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
            <DialogFooter className="sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => close(false)}
                disabled={isPending}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={
                  isPending ||
                  (mode === "add" &&
                    (addableCurrencies.length === 0 || !selectedRateCurrency))
                }
              >
                {isPending ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
