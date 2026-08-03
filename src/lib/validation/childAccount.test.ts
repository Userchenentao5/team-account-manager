import { describe, expect, it } from "vitest";
import { childAccountFormSchema } from "@/lib/validation/childAccount";

const validInput = {
  seatType: "chatgpt" as const,
  email: "child@example.com",
  contact: "wechat",
  label: "",
  joinedDate: "2026-08-03",
  monthlyAmountMinor: 2000,
  monthlyCurrencyCode: "CNY",
  monthlyPaymentDay: 3,
  billingPeriodUnit: "month" as const,
  billingPeriodCount: 1,
};

describe("childAccountFormSchema", () => {
  it.each([
    ["email", { email: "" }, "请输入子账号邮箱/登录名。"],
    ["joinedDate", { joinedDate: "" }, "请输入有效的加入日期。"],
  ] as const)("returns a visible message for missing %s", (field, values, message) => {
    const result = childAccountFormSchema.safeParse({ ...validInput, ...values });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors[field]).toContain(message);
    }
  });
});
