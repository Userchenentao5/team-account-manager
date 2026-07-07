import { z } from "zod";

const thresholdDays = z
  .number({ error: "请输入有效天数。" })
  .int("请输入整数天数。")
  .min(0, "阈值不能小于 0 天。")
  .max(365, "阈值不能超过 365 天。");

export const statusThresholdSchema = z.object({
  spaceSoonDays: thresholdDays,
  childAccountSoonDays: thresholdDays,
});

const emailAddress = z.string().email();

export const spaceEmailReminderSchema = z
  .object({
    enabled: z.boolean(),
    recipientEmail: z
      .string()
      .trim()
      .max(254, "邮箱长度不能超过 254 个字符。")
      .refine(
        (value) => value === "" || emailAddress.safeParse(value).success,
        "请输入有效的接收邮箱。",
      ),
  })
  .refine((value) => !value.enabled || value.recipientEmail.length > 0, {
    path: ["recipientEmail"],
    message: "开启空间邮件提醒后请输入接收邮箱。",
  });

export type StatusThresholdInput = z.infer<typeof statusThresholdSchema>;
export type SpaceEmailReminderInput = z.infer<
  typeof spaceEmailReminderSchema
>;
