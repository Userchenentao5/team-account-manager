import { escapeHtml } from "@/lib/email/rich-text";

type ReminderLayout = {
  subject: string;
  category: string;
  preheader: string;
  status: string;
  body: { text: string; html: string };
  primary: { label: string; value: string; suffix?: string; fontSize?: 28 | 36 };
  secondary: { label: string; value: string };
  details: { title: string; rows: readonly (readonly [string, string])[] };
  footer: string;
};

// The body must come from renderRichTextTemplateBody. All other dynamic values
// are escaped here; trusted layout styles stay outside the editable template.
export function renderReminderLayout(input: ReminderLayout) {
  const { subject, category, status, body, primary, secondary, details, footer } = input;
  const primaryValue = [primary.value, primary.suffix].filter(Boolean).join(" ");
  const detailRows = details.rows.map(([label, value]) => `
    <tr>
      <th scope="row" width="88" align="left" valign="top" style="width:88px;padding:12px 12px 12px 0;border-bottom:1px solid #e5e7eb;color:#475569;font-size:14px;font-weight:400;">${escapeHtml(label)}</th>
      <td valign="top" style="padding:12px 0;border-bottom:1px solid #e5e7eb;color:#0f172a;font-size:16px;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(value)}</td>
    </tr>`).join("");
  const messageHtml = body.html
    .replace(/<p>/g, '<p style="margin:0 0 12px;">')
    .replace(/<(ul|ol)>/g, '<$1 style="margin:0 0 12px;padding-left:24px;">');

  return {
    subject,
    text: [
      `${status} · ${category}`,
      `${primary.label}：${primaryValue}`,
      `${secondary.label}：${secondary.value}`,
      ...details.rows.map(([label, value]) => `${label}：${value}`),
      "",
      body.text,
      "",
      footer,
    ].join("\n"),
    html: `<div lang="zh-CN" style="margin:0;background-color:#f1f5f9;color:#0f172a;font-family:Arial,'Microsoft YaHei','PingFang SC',sans-serif;font-size:16px;line-height:1.6;text-align:left;color-scheme:light;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(input.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
    <tr><td align="center" style="padding:24px 12px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;table-layout:fixed;border-collapse:separate;border-spacing:0;background-color:#ffffff;border:1px solid #e2e8f0;border-top:4px solid #0f766e;border-radius:12px;">
        <tr><td style="padding:28px 24px 20px;">
          <p style="margin:0 0 12px;color:#0f766e;font-size:13px;font-weight:700;letter-spacing:1px;">账号管理 / ${escapeHtml(category)}</p>
          <h1 style="margin:0;color:#0f172a;font-size:24px;line-height:1.4;font-weight:700;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(subject)}</h1>
        </td></tr>
        <tr><td style="padding:0 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;border-collapse:separate;border-spacing:0;background-color:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;">
            <tr><td style="padding:20px;">
              <p style="margin:0 0 4px;color:#115e59;font-size:14px;">${escapeHtml(primary.label)}</p>
              <p style="margin:0;color:#0f172a;font-size:${primary.fontSize ?? 36}px;line-height:1.3;font-weight:700;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(primary.value)}${primary.suffix ? ` <span style="font-size:16px;font-weight:400;color:#115e59;">${escapeHtml(primary.suffix)}</span>` : ""}</p>
              <p style="margin:16px 0 0;color:#334155;font-size:14px;">${escapeHtml(secondary.label)} <strong style="color:#0f172a;">${escapeHtml(secondary.value)}</strong></p>
              <p style="margin:4px 0 0;color:#9a3412;font-size:14px;font-weight:700;">${escapeHtml(status)}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 24px 24px;">
          <table aria-label="${escapeHtml(details.title)}" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;border-collapse:collapse;">${detailRows}
          </table>
          <div style="padding-top:20px;color:#334155;font-size:16px;line-height:1.75;overflow-wrap:anywhere;word-break:break-word;">${messageHtml}</div>
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;background-color:#f8fafc;border-radius:0 0 12px 12px;">
          <p style="margin:0;color:#475569;font-size:12px;line-height:1.7;">${escapeHtml(footer)}</p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</div>`,
  };
}
