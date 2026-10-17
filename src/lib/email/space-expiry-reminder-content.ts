import { renderReminderLayout } from "@/lib/email/reminder-layout";
import { renderRichTextTemplateBody, renderTemplateText } from "@/lib/email/rich-text";

export type SpaceExpiryReminderValues = {
  amountUsd: string;
  daysUntilExpiry: string;
  expiryDate: string;
  paymentChannelName: string;
  spaceName: string;
};

// Keep the preview, test sends, and scheduled reminders on the same renderer.
export function renderSpaceExpiryReminderContent(
  template: { subject: string; body: string },
  values: SpaceExpiryReminderValues,
) {
  const days = Number(values.daysUntilExpiry);
  const status = days === 0
    ? "今天到期"
    : days > 0
      ? `${days} 天后到期`
      : `已到期 ${Math.abs(days)} 天`;

  return renderReminderLayout({
    subject: renderTemplateText(template.subject, values),
    category: "空间到期提醒",
    preheader: `${values.spaceName} · ${status} · 到期 ${values.expiryDate} · ${values.amountUsd} USD`,
    status,
    body: renderRichTextTemplateBody(template.body, values),
    primary: { label: "空间到期时间", value: values.expiryDate, fontSize: 28 },
    secondary: { label: "订阅金额（美元）", value: `${values.amountUsd} USD` },
    details: {
      title: "空间订阅信息",
      rows: [
        ["空间名称", values.spaceName],
        ["支付渠道", values.paymentChannelName || "未填写"],
      ],
    },
    footer: "此邮件由账号管理系统自动发送，仅作为到期提醒，续费与扣款状态请自行核实。",
  });
}
