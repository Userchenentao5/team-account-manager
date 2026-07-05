import { z } from "zod";

export const currencyCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3}$/, "请输入 3 位大写币种代码。")),
});

export const currencySchema = z.object({
  code: currencyCodeSchema.shape.code,
  countryCode: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().min(1, "请选择国家/地区。")),
  countryName: z.string().trim().min(1, "请选择国家/地区。"),
  name: z.string().trim().min(1, "请输入币种名称。"),
  symbol: z.string().trim().min(1, "请输入币种符号。"),
  minorUnit: z
    .number()
    .int("最小单位位数必须是整数。")
    .min(0, "最小单位位数不能小于 0。")
    .max(6, "最小单位位数不能超过 6。"),
});

export const currencyUpdateSchema = currencySchema.omit({
  code: true,
  countryCode: true,
  countryName: true,
});

export type CurrencyInput = z.input<typeof currencySchema>;
export type CurrencyValue = z.output<typeof currencySchema>;
export type CurrencyUpdateInput = z.input<typeof currencyUpdateSchema>;
export type CurrencyUpdateValue = z.output<typeof currencyUpdateSchema>;
