"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { differenceInCalendarDays } from "date-fns";
import { db } from "@/db";
import {
  getSpaceEmailReminderSettings,
  setChildAccountEmailReminderSettings,
  setSpaceEmailReminderSettings,
  setStatusThresholds,
} from "@/db/settings";
import { getChildAccount } from "@/db/childAccounts";
import {
  deleteChildAccountReminderSubscription,
  upsertChildAccountReminderSubscription,
} from "@/db/childAccountReminders";
import { paymentChannel, space } from "@/db/schema";
import type { SpaceExpiryReminderRow } from "@/db/spaceReminders";
import { renderSpaceExpiryReminderTemplate } from "@/lib/email/space-expiry-reminder";
import { sendEmail } from "@/lib/email/smtp";
import {
  childAccountEmailReminderSchema,
  childAccountReminderSubscriptionSchema,
  spaceEmailReminderSchema,
  statusThresholdSchema,
  type ChildAccountEmailReminderInput,
  type ChildAccountReminderSubscriptionInput,
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

export async function saveChildAccountReminderSubscription(
  input: ChildAccountReminderSubscriptionInput,
): Promise<SettingsActionResult> {
  const parsed = childAccountReminderSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "订阅提醒邮箱无效。",
    };
  }

  const child = getChildAccount(db, parsed.data.childAccountId);
  if (!child) {
    return { ok: false, error: "子账号不存在。" };
  }

  upsertChildAccountReminderSubscription(db, parsed.data);
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeChildAccountReminderSubscription(
  childAccountId: number,
): Promise<SettingsActionResult> {
  if (!Number.isInteger(childAccountId) || childAccountId <= 0) {
    return { ok: false, error: "请选择子账号。" };
  }

  deleteChildAccountReminderSubscription(db, childAccountId);
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
    const row = randomSpaceReminderRow();
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

function randomSpaceReminderRow(): SpaceExpiryReminderRow | null {
  const rows = db
    .select({
      id: space.id,
      name: space.name,
      paymentChannelName: paymentChannel.name,
      expiryDate: space.expiryDate,
      amountUsd: space.amountUsd,
    })
    .from(space)
    .innerJoin(paymentChannel, eq(paymentChannel.id, space.paymentChannelId))
    .all()
    .filter((row) => row.expiryDate);

  const row = rows[Math.floor(Math.random() * rows.length)];
  if (!row?.expiryDate) return null;

  return {
    id: row.id,
    name: row.name,
    paymentChannelName: row.paymentChannelName,
    expiryDate: row.expiryDate,
    daysUntilExpiry: differenceInCalendarDays(
      localDateFromIsoDate(row.expiryDate),
      new Date(),
    ),
    amountUsdMinor: row.amountUsd ?? 0,
  };
}

function localDateFromIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
