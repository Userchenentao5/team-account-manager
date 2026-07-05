import { z } from "zod";

export const seatTypeSchema = z.enum(["codex", "chatgpt"]);

export const childAccountFormSchema = z.object({
  seatType: seatTypeSchema,
  email: z.string().trim().min(1, "请输入子账号邮箱/登录名。"),
  contact: z.string().trim(),
  label: z.string().trim(),
  joinedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monthlyAmountMinor: z.number().int().positive("请输入有效的月度金额。"),
  monthlyCurrencyCode: z.string().length(3, "请选择有效的月度币种。"),
  monthlyPaymentDay: z
    .number()
    .int("月付日必须是整数。")
    .min(1, "月付日必须在 1 到 31 之间。")
    .max(31, "月付日必须在 1 到 31 之间。"),
});

export type SeatType = z.infer<typeof seatTypeSchema>;
export type ChildAccountFormInput = z.infer<typeof childAccountFormSchema>;

export const childAccountIdSchema = z.object({
  id: z.number().int().positive(),
});
