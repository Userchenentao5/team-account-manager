export type ReminderTemplatePlaceholder = {
  key: string;
  label: string;
  example: string;
};

export const SPACE_REMINDER_TEMPLATE_PLACEHOLDERS = [
  { key: "spaceName", label: "空间名称", example: "US Team" },
  { key: "daysUntilExpiry", label: "距到期天数", example: "7" },
  { key: "paymentChannelName", label: "支付渠道", example: "Visa" },
  { key: "amountUsd", label: "订阅金额（美元）", example: "25.99" },
  { key: "expiryDate", label: "到期日期", example: "2026-07-14" },
] as const satisfies readonly ReminderTemplatePlaceholder[];

export const CHILD_ACCOUNT_REMINDER_TEMPLATE_PLACEHOLDERS = [
  { key: "spaceName", label: "所属空间", example: "US Team" },
  {
    key: "childAccountEmail",
    label: "子账号邮箱",
    example: "member@example.com",
  },
  { key: "childAccountLabel", label: "子账号备注", example: "Team seat" },
  { key: "contact", label: "联系方式", example: "wx-member" },
  { key: "amount", label: "应付金额", example: "12.99" },
  { key: "currencyCode", label: "币种代码", example: "CNY" },
  { key: "nextPaymentDate", label: "下一付款日", example: "2026-07-14" },
  { key: "daysUntilPayment", label: "距付款日天数", example: "0" },
] as const satisfies readonly ReminderTemplatePlaceholder[];

export const SPACE_REMINDER_TEMPLATE_KEYS =
  SPACE_REMINDER_TEMPLATE_PLACEHOLDERS.map(({ key }) => key);

export const CHILD_ACCOUNT_REMINDER_TEMPLATE_KEYS = [
  ...CHILD_ACCOUNT_REMINDER_TEMPLATE_PLACEHOLDERS.map(({ key }) => key),
  "amountUsd",
];
