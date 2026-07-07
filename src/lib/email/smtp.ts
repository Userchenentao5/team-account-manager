import nodemailer from "nodemailer";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const smtpUrl = process.env.SMTP_URL;
  const from = process.env.SMTP_FROM;

  if (!smtpUrl || !from) {
    throw new Error("请先配置 SMTP_URL 和 SMTP_FROM 环境变量。");
  }

  const transporter = nodemailer.createTransport(smtpUrl);
  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
}
