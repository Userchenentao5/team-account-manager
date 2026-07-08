import nodemailer from "nodemailer";

type SendEmailInput = {
  smtpUrl: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (!input.smtpUrl || !input.from) {
    throw new Error("请先在设置中配置 SMTP URL 和发件邮箱。");
  }

  const transporter = nodemailer.createTransport(input.smtpUrl);
  await transporter.sendMail({
    from: input.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}
