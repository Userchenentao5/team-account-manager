"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  getChildAccountEmailReminderSettings,
  getSpaceEmailReminderSettings,
  setChildAccountEmailReminderSettings,
  setSpaceEmailReminderSettings,
  setStatusThresholds,
} from "@/db/settings";
import { getRandomChildAccountPaymentReminderRow } from "@/db/childAccountReminders";
import { getRandomSpaceExpiryReminderRow } from "@/db/spaceReminders";
import { renderChildAccountReminderTemplate } from "@/lib/email/child-account-reminder";
import { renderSpaceExpiryReminderTemplate } from "@/lib/email/space-expiry-reminder";
import { sendEmail } from "@/lib/email/smtp";
import {
  childAccountEmailReminderSchema,
  spaceEmailReminderSchema,
  statusThresholdSchema,
  type ChildAccountEmailReminderInput,
  type SpaceEmailReminderInput,
  type StatusThresholdInput,
} from "@/lib/validation/settings";

export type SettingsActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateStatusThresholds(
  input: StatusThresholdInput,
): Promise<SettingsActionResult> {
  const parsed = statusThresholdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "状态阈值无效。",
    };
  }

  setStatusThresholds(db, parsed.data);
  revalidatePath("/");
  revalidatePath("/spaces");
  revalidatePath("/spaces/[id]", "page");
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateSpaceEmailReminderSettings(
  input: SpaceEmailReminderInput,
): Promise<SettingsActionResult> {
  const parsed = spaceEmailReminderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "空间邮件提醒设置无效。",
    };
  }

  setSpaceEmailReminderSettings(db, parsed.data);
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateChildAccountEmailReminderSettings(
  input: ChildAccountEmailReminderInput,
): Promise<SettingsActionResult> {
  const parsed = childAccountEmailReminderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "子账号邮件提醒设置无效。",
    };
  }

  setChildAccountEmailReminderSettings(db, parsed.data);
  revalidatePath("/settings");
  return { ok: true };
}

export async function sendSpaceEmailReminderTest(
  input?: SpaceEmailReminderInput,
): Promise<SettingsActionResult> {
  const parsed = spaceEmailReminderSchema.safeParse(
    input ?? getSpaceEmailReminderSettings(db),
  );
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "空间提醒邮件设置无效。",
    };
  }

  try {
    const row = getRandomSpaceExpiryReminderRow(db);
    if (!row) {
      return { ok: false, error: "没有可用于测试发送的空间。" };
    }

    const message = renderSpaceExpiryReminderTemplate(
      {
        subject: parsed.data.templateSubject,
        body: parsed.data.templateBody,
      },
      row,
    );

    await sendEmail({
      smtpUrl: parsed.data.smtpUrl,
      from: parsed.data.smtpFrom,
      to: parsed.data.recipientEmail,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "测试邮件发送失败。",
    };
  }
}

export async function sendChildAccountEmailReminderTest(
  input?: ChildAccountEmailReminderInput,
): Promise<SettingsActionResult> {
  const parsed = childAccountEmailReminderSchema.safeParse(
    input ?? getChildAccountEmailReminderSettings(db),
  );
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "子账号提醒邮件设置无效。",
    };
  }

  try {
    const row = getRandomChildAccountPaymentReminderRow(db);
    if (!row) {
      return { ok: false, error: "没有可用于测试发送的子账号。" };
    }

    const message = renderChildAccountReminderTemplate(
      {
        subject: parsed.data.templateSubject,
        body: parsed.data.templateBody,
      },
      row,
    );

    await sendEmail({
      smtpUrl: parsed.data.smtpUrl,
      from: parsed.data.smtpFrom,
      to: parsed.data.recipientEmail,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "测试邮件发送失败。",
    };
  }
}
