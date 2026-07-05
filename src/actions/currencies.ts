"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  countCurrencyUsage,
  deleteCurrencyRow,
  findCurrencyByCode,
  insertCurrency,
  updateCurrencyRow,
} from "@/db/currencies";
import { findRateSupportedCurrency } from "@/lib/currencies";
import {
  currencyCodeSchema,
  currencySchema,
  currencyUpdateSchema,
  type CurrencyInput,
  type CurrencyUpdateInput,
} from "@/lib/validation/currency";
import { isRateBase } from "@/lib/fx/base";

export type CurrencyActionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      field?: keyof CurrencyInput | keyof CurrencyUpdateInput;
    };

const CURRENCY_PATHS = [
  "/reference-data/currencies",
  "/reference-data/rates",
  "/spaces",
];

export async function addCurrency(
  input: CurrencyInput,
): Promise<CurrencyActionResult> {
  const parsed = currencySchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? "请输入有效币种。",
      field: issue?.path[0] as keyof CurrencyInput | undefined,
    };
  }

  const supported = findRateSupportedCurrency(parsed.data.code);
  if (!supported || supported.countryCode !== parsed.data.countryCode) {
    return {
      ok: false,
      error: "请选择汇率服务支持的国家/地区。",
      field: "countryCode",
    };
  }

  if (findCurrencyByCode(db, supported.code)) {
    return { ok: false, error: "已存在同代码币种。", field: "code" };
  }

  insertCurrency(db, supported);
  for (const path of CURRENCY_PATHS) {
    revalidatePath(path);
  }
  return { ok: true };
}

export async function updateCurrency(
  code: string,
  input: CurrencyUpdateInput,
): Promise<CurrencyActionResult> {
  const parsedCode = currencyCodeSchema.safeParse({ code });
  if (!parsedCode.success) {
    return { ok: false, error: "无效的币种。", field: "name" };
  }

  const parsed = currencyUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? "请输入有效币种。",
      field: issue?.path[0] as keyof CurrencyUpdateInput | undefined,
    };
  }

  const current = findCurrencyByCode(db, parsedCode.data.code);
  if (!current) {
    return { ok: false, error: "币种不存在。", field: "name" };
  }

  const usage = countCurrencyUsage(db, parsedCode.data.code);
  if (
    usage.spaces + usage.childAccounts > 0 &&
    parsed.data.minorUnit !== current.minorUnit
  ) {
    return {
      ok: false,
      error: "该币种已有金额记录,不能修改最小单位位数。",
      field: "minorUnit",
    };
  }

  updateCurrencyRow(db, parsedCode.data.code, parsed.data);
  for (const path of CURRENCY_PATHS) {
    revalidatePath(path);
  }
  return { ok: true };
}

export async function deleteCurrency(
  code: string,
): Promise<CurrencyActionResult> {
  const parsedCode = currencyCodeSchema.safeParse({ code });
  if (!parsedCode.success) {
    return { ok: false, error: "无效的币种。", field: "code" };
  }

  if (isRateBase(parsedCode.data.code)) {
    return {
      ok: false,
      error: `${parsedCode.data.code} 是汇率基准币,不能删除。`,
      field: "code",
    };
  }

  if (!findCurrencyByCode(db, parsedCode.data.code)) {
    return { ok: false, error: "币种不存在。", field: "code" };
  }

  const usage = countCurrencyUsage(db, parsedCode.data.code);
  if (usage.spaces + usage.childAccounts > 0) {
    return {
      ok: false,
      error: "已有空间或子账号使用该币种,不能删除。",
      field: "code",
    };
  }

  deleteCurrencyRow(db, parsedCode.data.code);
  for (const path of CURRENCY_PATHS) {
    revalidatePath(path);
  }
  return { ok: true };
}
