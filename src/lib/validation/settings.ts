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

export type StatusThresholdInput = z.infer<typeof statusThresholdSchema>;
