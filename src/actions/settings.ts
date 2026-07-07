"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  setSpaceEmailReminderSettings,
  setStatusThresholds,
} from "@/db/settings";
import {
  spaceEmailReminderSchema,
  statusThresholdSchema,
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
