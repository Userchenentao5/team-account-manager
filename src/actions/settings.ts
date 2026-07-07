"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { listSpaceExpiryReminderCandidates } from "@/db/spaceReminders";
import {
  getSpaceEmailReminderSettings,
  getStatusThresholds,
  setSpaceEmailReminderSettings,
  setStatusThresholds,
} from "@/db/settings";
import { composeSpaceExpiryReminderEmail } from "@/lib/email/space-expiry-reminder";
import { sendEmail } from "@/lib/email/smtp";
import {
  spaceEmailReminderSchema,
  statusThresholdSchema,
  type SpaceEmailReminderInput,
  type StatusThresholdInput,
} from "@/lib/validation/settings";

export type SettingsActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type SendSpaceExpiryReminderResult =
  | { ok: true; sent: number }
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

export async function sendSpaceExpiryReminderEmails(): Promise<SendSpaceExpiryReminderResult> {
  const emailSettings = getSpaceEmailReminderSettings(db);
  if (!emailSettings.enabled) {
    return { ok: false, error: "请先开启空间邮件提醒。" };
  }
  if (!emailSettings.recipientEmail) {
    return { ok: false, error: "请先配置接收邮箱。" };
  }

  const thresholds = getStatusThresholds(db);
  const candidates = listSpaceExpiryReminderCandidates(
    db,
    thresholds.spaceSoonDays,
  );

  try {
    for (const candidate of candidates) {
      const message = composeSpaceExpiryReminderEmail(candidate);
      await sendEmail({
        to: emailSettings.recipientEmail,
        subject: message.subject,
        text: message.text,
      });
    }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "空间到期提醒邮件发送失败。",
    };
  }

  return { ok: true, sent: candidates.length };
}
