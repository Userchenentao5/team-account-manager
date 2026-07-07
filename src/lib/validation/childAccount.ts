import { z } from "zod";

export const seatTypeSchema = z.enum(["codex", "chatgpt"]);
export const billingPeriodUnitSchema = z.enum(["month", "quarter", "year"]);

export const childAccountFormSchema = z
  .object({
    seatType: seatTypeSchema,
    email: z.string().trim().min(1, "请输入子账号邮箱/登录名。"),
    contact: z.string().trim(),
    label: z.string().trim(),
    joinedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    monthlyAmountMinor: z.number().int().nonnegative("请输入有效的订阅金额。"),
    monthlyCurrencyCode: z.string().length(3, "请选择有效的订阅币种。"),
    monthlyPaymentDay: z
      .number()
      .int("付款日必须是整数。")
      .min(1, "付款日必须在 1 到 31 之间。")
      .max(31, "付款日必须在 1 到 31 之间。"),
    billingPeriodUnit: billingPeriodUnitSchema,
    billingPeriodCount: z.number().int().positive(),
  })
  .refine(
    (value) =>
      (value.billingPeriodUnit === "month" &&
        [1, 6].includes(value.billingPeriodCount)) ||
      (value.billingPeriodUnit === "quarter" &&
        value.billingPeriodCount === 1) ||
      (value.billingPeriodUnit === "year" && value.billingPeriodCount === 1),
    { message: "请选择有效的订阅周期。", path: ["billingPeriodCount"] },
  );

export type SeatType = z.infer<typeof seatTypeSchema>;
export type ChildAccountFormInput = z.infer<typeof childAccountFormSchema>;

export const childAccountIdSchema = z.object({
  id: z.number().int().positive(),
});
