"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { createSpace, updateSpace } from "@/actions/spaces";
import type { ChannelRow } from "@/db/channels";
import type { CurrencyRow } from "@/db/currencies";
import { cn } from "@/lib/utils";
import { formatMinor, parseToMinor } from "@/lib/money";
import {
  spaceFormSchema,
  type SpaceFormInput,
} from "@/lib/validation/space";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

export type SpaceFormValue = SpaceFormInput & {
  id?: number;
};

type CountryCurrencyOption = {
  code: string;
  label: string;
  currencyCode: string;
  currencyName: string;
  symbol: string;
};

type SpaceFormProps = {
  open: boolean;
  mode: "add" | "edit";
  space?: SpaceFormValue;
  channels: Pick<ChannelRow, "id" | "name">[];
  currencies: readonly CurrencyRow[];
  onOpenChange: (open: boolean) => void;
};

type SpaceEditorFormProps = {
  mode: "add" | "edit";
  space?: SpaceFormValue;
  channels: Pick<ChannelRow, "id" | "name">[];
  currencies: readonly CurrencyRow[];
  onCancel: () => void;
  onSaved?: () => void;
  layout?: "dialog" | "detail";
  formId?: string;
};

const PERIOD_LABELS = {
  month: "月",
  quarter: "季度",
  year: "年",
} as const;

function defaultValues(
  channels: Pick<ChannelRow, "id">[],
  currencies: readonly CurrencyRow[],
): SpaceFormInput {
  const defaultCurrency =
    currencies.find((currency) => currency.code === "USD") ?? currencies[0];
  const today = new Date().toISOString().slice(0, 10);
  return {
    name: "",
    country: defaultCurrency?.countryCode ?? "US",
    paymentChannelId: channels[0]?.id ?? 1,
    currencyCode: defaultCurrency?.code ?? "USD",
    amountMinor: 1,
    openingDate: today,
    currentPeriodStartDate: today,
    periodUnit: "month",
    periodCount: 1,
    motherEmail: "",
  };
}

function SpaceEditorForm({
  mode,
  space,
  channels,
  currencies,
  onCancel,
  onSaved,
  layout = "dialog",
  formId,
}: SpaceEditorFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isComposingCountryQuery = useRef(false);
  const [countryInputValue, setCountryInputValue] = useState("");
  const [countryQuery, setCountryQuery] = useState("");
  const initialValues = space ?? defaultValues(channels, currencies);
  const initialCurrency = currencies.find(
    (item) => item.code === initialValues.currencyCode,
  );
  const countryOptions = useMemo<CountryCurrencyOption[]>(() => {
    const seen = new Set<string>();
    const options: CountryCurrencyOption[] = [];
    for (const currency of currencies) {
      if (!currency.countryCode || !currency.countryName) continue;
      if (seen.has(currency.countryCode)) continue;
      seen.add(currency.countryCode);
      options.push({
        code: currency.countryCode,
        label: currency.countryName,
        currencyCode: currency.code,
        currencyName: currency.name,
        symbol: currency.symbol,
      });
    }
    return options.sort((left, right) =>
      left.label.localeCompare(right.label, "zh-Hans-CN"),
    );
  }, [currencies]);
  const normalizedCountryQuery = countryQuery.trim().toLowerCase();
  const filteredCountryOptions = normalizedCountryQuery
    ? countryOptions.filter((option) =>
        [
          option.label,
          option.code,
          option.currencyCode,
          option.currencyName,
        ].some((value) =>
          value.toLowerCase().includes(normalizedCountryQuery),
        ),
      )
    : countryOptions;
  const [amountInput, setAmountInput] = useState(() =>
    space
      ? formatMinor(initialValues.amountMinor, initialCurrency?.minorUnit ?? 2)
      : "",
  );
  const form = useForm<SpaceFormInput>({
    resolver: zodResolver(spaceFormSchema),
    defaultValues: initialValues,
  });

  const selectedCurrency = useWatch({
    control: form.control,
    name: "currencyCode",
  });
  const selectedCountry = useWatch({
    control: form.control,
    name: "country",
  });
  const selectedCurrencyMeta = useMemo(
    () => currencies.find((currency) => currency.code === selectedCurrency),
    [currencies, selectedCurrency],
  );
  const selectedCountryOption = useMemo(
    () => countryOptions.find((option) => option.code === selectedCountry),
    [countryOptions, selectedCountry],
  );
  const isDetailLayout = layout === "detail";
  const detailCellClass = isDetailLayout
    ? "min-h-[92px] rounded-md border bg-muted/20 p-3"
    : undefined;

  function setCountryAndCurrency(countryCode: string) {
    form.setValue("country", countryCode, { shouldValidate: true });
    const currency = currencies.find(
      (item) => item.countryCode === countryCode,
    );
    if (currency) {
      form.setValue("currencyCode", currency.code, { shouldValidate: true });
    }
  }

  function setCurrencyAndCountry(currencyCode: string) {
    form.setValue("currencyCode", currencyCode, { shouldValidate: true });
    const currency = currencies.find((item) => item.code === currencyCode);
    if (currency) {
      form.setValue("country", currency.countryCode, { shouldValidate: true });
    }
  }

  function onSubmit(rawValues: SpaceFormInput) {
    const currency = currencies.find(
      (item) => item.code === rawValues.currencyCode,
    );
    if (!currency) {
      form.setError("currencyCode", { message: "请选择有效的币种。" });
      return;
    }

    let amountMinor: number;
    try {
      amountMinor = parseToMinor(amountInput, currency.minorUnit);
      if (amountMinor <= 0) throw new Error("non-positive amount");
    } catch {
      form.setError("amountMinor", { message: "请输入有效金额。" });
      return;
    }

    const values = { ...rawValues, amountMinor };

    startTransition(async () => {
      try {
        const res =
          mode === "add"
            ? await createSpace(values)
            : await updateSpace(space!.id!, values);

        if (res.ok) {
          toast.success(mode === "add" ? "已创建空间" : "已保存修改");
          onSaved?.();
          router.refresh();
        } else {
          form.setError("root", { message: res.error });
          toast.error(res.error);
        }
      } catch {
        toast.error("保存失败,请重试。");
      }
    });
  }

  return (
    <Form {...form}>
      <form
        id={formId}
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn(
          "grid",
          isDetailLayout
            ? "gap-6 md:grid-cols-2 xl:grid-cols-3"
            : "gap-4 md:grid-cols-2",
        )}
      >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className={detailCellClass}>
                  <FormLabel>空间名称</FormLabel>
                  <FormControl>
                    <Input placeholder="例如:Team Pro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="motherEmail"
              render={({ field }) => (
                <FormItem className={detailCellClass}>
                  <FormLabel>
                    {isDetailLayout ? "母账号" : "母账号邮箱/登录名"}
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="owner@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem className={detailCellClass}>
                  <FormLabel>国家/地区</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={setCountryAndCurrency}
                  >
                    <FormControl>
                      <SelectTrigger
                        className={cn(isDetailLayout ? "h-10" : "h-12", "w-full")}
                      >
                        <span className="flex min-w-0 flex-1 items-center justify-between gap-3 leading-tight">
                          <span className="min-w-0 truncate text-left">
                            {selectedCountryOption?.label ?? "选择国家/地区"}
                          </span>
                          {isDetailLayout ? null : (
                            <span className="ml-auto max-w-[55%] shrink-0 truncate text-right font-mono text-xs text-muted-foreground">
                              {selectedCountryOption
                                ? `${selectedCountryOption.symbol} ${selectedCountryOption.currencyCode} · ${selectedCountryOption.currencyName}`
                                : "选择后自动填充币种"}
                            </span>
                          )}
                        </span>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-80" position="popper">
                      <div className="sticky top-0 z-10 bg-popover p-2">
                        <Input
                          value={countryInputValue}
                          onChange={(event) => {
                            const input = event.currentTarget;
                            const value = event.target.value;
                            setCountryInputValue(value);
                            if (isComposingCountryQuery.current) return;
                            setCountryQuery(value);
                            requestAnimationFrame(() => input.focus());
                          }}
                          onCompositionStart={() => {
                            isComposingCountryQuery.current = true;
                          }}
                          onCompositionEnd={(event) => {
                            const input = event.currentTarget;
                            const value = input.value;
                            isComposingCountryQuery.current = false;
                            setCountryInputValue(value);
                            setCountryQuery(value);
                            requestAnimationFrame(() => input.focus());
                          }}
                          onKeyDownCapture={(event) =>
                            event.stopPropagation()
                          }
                          onKeyDown={(event) => event.stopPropagation()}
                          placeholder="搜索国家/地区或币种"
                          className="h-8"
                        />
                      </div>
                      {filteredCountryOptions.map((country) => (
                        <SelectItem
                          key={country.code}
                          value={country.code}
                          className="py-2"
                        >
                          <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="truncate">{country.label}</span>
                              <span className="font-mono text-xs text-muted-foreground">
                                {country.code}
                              </span>
                            </span>
                            <span className="ml-auto max-w-[52%] shrink-0 truncate text-right font-mono text-xs text-muted-foreground">
                              {country.symbol} {country.currencyCode} ·{" "}
                              {country.currencyName}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                      {filteredCountryOptions.length === 0 ? (
                        <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                          没有匹配的国家/地区
                        </div>
                      ) : null}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="paymentChannelId"
              render={({ field }) => (
                <FormItem className={detailCellClass}>
                  <FormLabel>支付渠道</FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {channels.map((channel) => (
                        <SelectItem key={channel.id} value={String(channel.id)}>
                          {channel.name}
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
              name="amountMinor"
              render={({ field }) => (
                <FormItem className={detailCellClass}>
                  <FormLabel>金额</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      placeholder="19.99"
                      value={amountInput}
                      onChange={(event) => {
                        setAmountInput(event.target.value);
                        field.onChange(Math.max(field.value, 1));
                      }}
                    />
                  </FormControl>
                  {isDetailLayout ? null : (
                    <p className="text-xs text-muted-foreground">
                      {selectedCurrencyMeta
                        ? `${selectedCurrencyMeta.symbol} ${selectedCurrencyMeta.code} 使用 ${selectedCurrencyMeta.minorUnit} 位小数作为最小单位。`
                        : "金额会按所选币种的最小单位保存。"}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currencyCode"
              render={({ field }) => (
                <FormItem className={detailCellClass}>
                  <FormLabel>币种</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={setCurrencyAndCountry}
                  >
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
              name="openingDate"
              render={({ field }) => (
                <FormItem className={detailCellClass}>
                  <FormLabel>
                    {isDetailLayout ? "首次开通日" : "首次开通日期"}
                  </FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currentPeriodStartDate"
              render={({ field }) => (
                <FormItem className={detailCellClass}>
                  <FormLabel>当前周期开始日</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div
              className={cn(
                isDetailLayout
                  ? "min-h-[92px] space-y-2 rounded-md border bg-muted/20 p-3"
                  : "grid grid-cols-[1fr_120px] gap-2",
              )}
            >
              {isDetailLayout ? (
                <p className="text-sm font-medium leading-none">订阅周期</p>
              ) : null}
              <div
                className={cn(
                  "grid grid-cols-[1fr_120px] gap-2",
                  isDetailLayout && "items-start",
                )}
              >
              <FormField
                control={form.control}
                name="periodUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={isDetailLayout ? "sr-only" : undefined}>
                      周期单位
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(PERIOD_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
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
                name="periodCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={isDetailLayout ? "sr-only" : undefined}>
                      数量
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
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
              </div>
            </div>
            {form.formState.errors.root ? (
              <p
                className={cn(
                  "text-sm text-destructive",
                  isDetailLayout ? "md:col-span-2 xl:col-span-3" : "md:col-span-2",
                )}
              >
                {form.formState.errors.root.message}
              </p>
            ) : null}
            {isDetailLayout ? null : (
              <div className="flex justify-end gap-2 md:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isPending}
                >
                  取消
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "保存中…" : "保存"}
                </Button>
              </div>
            )}
          </form>
        </Form>
  );
}

export function SpaceInlineEditor({
  space,
  channels,
  currencies,
  cancelHref,
  formId,
}: Omit<SpaceEditorFormProps, "mode" | "onCancel" | "onSaved"> & {
  cancelHref: string;
}) {
  const router = useRouter();

  function closeEditor() {
    router.push(cancelHref);
    router.refresh();
  }

  return (
    <SpaceEditorForm
      mode="edit"
      space={space}
      channels={channels}
      currencies={currencies}
      onCancel={() => router.push(cancelHref)}
      onSaved={closeEditor}
      layout="detail"
      formId={formId}
    />
  );
}

export function SpaceForm({
  open,
  mode,
  space,
  channels,
  currencies,
  onOpenChange,
}: SpaceFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "新增空间" : "编辑空间"}</DialogTitle>
          <DialogDescription>
            记录归属国家、支付渠道、金额与订阅周期,系统会自动算出到期日,并在保存时按当前汇率固定 USD 成本。
          </DialogDescription>
        </DialogHeader>
        <SpaceEditorForm
          mode={mode}
          space={space}
          channels={channels}
          currencies={currencies}
          onCancel={() => onOpenChange(false)}
          onSaved={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
