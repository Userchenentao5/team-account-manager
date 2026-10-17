import {
  renderRichTextTemplateBody,
  renderTemplateText,
} from "@/lib/email/rich-text";
import { renderReminderLayout } from "@/lib/email/reminder-layout";

export type ChildAccountReminderValues = {
  amount: string;
  amountUsd: string;
  contact: string;
  childAccountEmail: string;
  childAccountLabel: string;
  currencyCode: string;
  daysUntilPayment: string;
  nextPaymentDate: string;
  spaceName: string;
};

// Shared by the settings preview, test sends, and scheduled reminders.
// Only the sanitized message is editable; layout styles are application-owned.
export function renderChildAccountReminderContent(
  template: { subject: string; body: string },
  values: ChildAccountReminderValues,
): { subject: string; text: string; html: string } {
  const subject = renderTemplateText(template.subject, values);
  const body = renderRichTextTemplateBody(template.body, values);
  const days = Number(values.daysUntilPayment);
  const status = days === 0
    ? "今天到期"
    : days > 0
      ? `${days} 天后到期`
      : `已到期 ${Math.abs(days)} 天`;
  const details: [string, string][] = [
    ["所属空间", values.spaceName],
    ["子账号邮箱", values.childAccountEmail],
    ["联系方式", values.contact || "未填写"],
    ...(values.childAccountLabel ? [["账号备注", values.childAccountLabel] satisfies [string, string]] : []),
  ];
  return renderReminderLayout({
    subject,
    category: "子账号付款提醒",
    preheader: `${values.spaceName} · ${status} · 应收 ${values.amount} ${values.currencyCode} · ${values.nextPaymentDate}`,
    status,
    body,
    primary: { label: "本期应收金额", value: values.amount, suffix: values.currencyCode },
    secondary: { label: "下一付款日", value: values.nextPaymentDate },
    details: { title: "子账号信息", rows: details },
    footer: "此邮件由账号管理系统自动发送，仅作为到期提醒，收款状态请自行核实。",
  });
}
