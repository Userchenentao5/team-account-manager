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
const reminderSendTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "请选择有效的发送时间。");
const smtpUrl = z.string().refine((value) => {
  if (value === "") return true;
  try {
    const url = new URL(value);
    return url.protocol === "smtp:" || url.protocol === "smtps:";
  } catch {
    return false;
  }
}, "请输入有效的 SMTP URL，例如 smtp://user:pass@smtp.example.com:587。");

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
    sendTime: reminderSendTime,
    smtpUrl: z.string().trim().max(500, "SMTP URL 不能超过 500 个字符。").pipe(smtpUrl),
    smtpFrom: z
      .string()
      .trim()
      .max(254, "发件邮箱长度不能超过 254 个字符。")
      .refine(
        (value) => value === "" || emailAddress.safeParse(value).success,
        "请输入有效的发件邮箱。",
      ),
    templateSubject: z
      .string()
      .trim()
      .min(1, "邮件标题模板不能为空。")
      .max(120, "邮件标题模板不能超过 120 个字符。"),
    templateBody: z
      .string()
      .trim()
      .min(1, "邮件正文模板不能为空。")
      .max(1000, "邮件正文模板不能超过 1000 个字符。"),
  })
  .refine((value) => !value.enabled || value.recipientEmail.length > 0, {
    path: ["recipientEmail"],
    message: "开启空间邮件提醒后请输入接收邮箱。",
  })
  .refine((value) => !value.enabled || value.smtpUrl.length > 0, {
    path: ["smtpUrl"],
    message: "开启空间邮件提醒后请输入 SMTP URL。",
  })
  .refine((value) => !value.enabled || value.smtpFrom.length > 0, {
    path: ["smtpFrom"],
    message: "开启空间邮件提醒后请输入发件邮箱。",
  });

export const childAccountEmailReminderSchema = z
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
    sendTime: reminderSendTime,
    smtpUrl: z
      .string()
      .trim()
      .max(500, "SMTP URL 不能超过 500 个字符。")
      .pipe(smtpUrl),
    smtpFrom: z
      .string()
      .trim()
      .max(254, "发件邮箱长度不能超过 254 个字符。")
      .refine(
        (value) => value === "" || emailAddress.safeParse(value).success,
        "请输入有效的发件邮箱。",
      ),
    templateSubject: z
      .string()
      .trim()
      .min(1, "邮件标题模板不能为空。")
      .max(120, "邮件标题模板不能超过 120 个字符。"),
    templateBody: z
      .string()
      .trim()
      .min(1, "邮件正文模板不能为空。")
      .max(1000, "邮件正文模板不能超过 1000 个字符。"),
  })
  .refine((value) => !value.enabled || value.recipientEmail.length > 0, {
    path: ["recipientEmail"],
    message: "开启子账号邮件提醒后请输入自己的接收邮箱。",
  })
  .refine((value) => !value.enabled || value.smtpUrl.length > 0, {
    path: ["smtpUrl"],
    message: "开启子账号邮件提醒后请输入 SMTP URL。",
  })
  .refine((value) => !value.enabled || value.smtpFrom.length > 0, {
    path: ["smtpFrom"],
    message: "开启子账号邮件提醒后请输入发件邮箱。",
  });


export type StatusThresholdInput = z.infer<typeof statusThresholdSchema>;
export type SpaceEmailReminderInput = z.infer<
  typeof spaceEmailReminderSchema
>;
export type ChildAccountEmailReminderInput = z.infer<
  typeof childAccountEmailReminderSchema
>;
