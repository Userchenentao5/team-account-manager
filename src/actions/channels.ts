"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { channelSchema, channelIdSchema } from "@/lib/validation/channel";
import {
  insertChannel,
  renameChannelRow,
  setChannelActive,
  findActiveByName,
} from "@/db/channels";

/**
 * REF-01 — payment-channel Server Actions (the walking skeleton's real write).
 *
 * Security (T-03-INPUT / T-03-MASS / T-03-SQLI / T-03-DEL):
 * - Every action re-parses its input with Zod server-side — Server Actions are
 *   public endpoints, so client RHF validation is never trusted here.
 * - Only the known `name` / `bankCardLast4` / `id` fields are parsed (no mass-assignment).
 * - All DB access goes through parameterized Drizzle helpers; there is NO
 *   hard-delete path — removal is a uniform soft-delete (D-06).
 */

const CHANNELS_PATH = "/reference-data/channels";

export type ChannelActionResult = { ok: true } | { ok: false; error: string };

export async function addChannel(
  name: string,
  bankCardLast4 = "",
): Promise<ChannelActionResult> {
  const parsed = channelSchema.safeParse({ name, bankCardLast4 });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "请输入渠道名称。" };
  }
  if (findActiveByName(db, parsed.data.name, parsed.data.bankCardLast4)) {
    return { ok: false, error: "已存在相同名称和银行卡尾号的有效渠道。" };
  }
  insertChannel(db, parsed.data.name, parsed.data.bankCardLast4);
  revalidatePath(CHANNELS_PATH);
  return { ok: true };
}

export async function renameChannel(
  id: number,
  name: string,
  bankCardLast4 = "",
): Promise<ChannelActionResult> {
  const parsedId = channelIdSchema.safeParse({ id });
  if (!parsedId.success) {
    return { ok: false, error: "无效的渠道。" };
  }
  const parsedChannel = channelSchema.safeParse({ name, bankCardLast4 });
  if (!parsedChannel.success) {
    return {
      ok: false,
      error:
        parsedChannel.error.issues[0]?.message ?? "请输入渠道名称。",
    };
  }
  const duplicate = findActiveByName(
    db,
    parsedChannel.data.name,
    parsedChannel.data.bankCardLast4,
  );
  if (duplicate && duplicate.id !== parsedId.data.id) {
    return { ok: false, error: "已存在相同名称和银行卡尾号的有效渠道。" };
  }
  renameChannelRow(
    db,
    parsedId.data.id,
    parsedChannel.data.name,
    parsedChannel.data.bankCardLast4,
  );
  revalidatePath(CHANNELS_PATH);
  return { ok: true };
}

export async function archiveChannel(id: number): Promise<ChannelActionResult> {
  const parsedId = channelIdSchema.safeParse({ id });
  if (!parsedId.success) {
    return { ok: false, error: "无效的渠道。" };
  }
  // Soft-delete only (D-06): flip is_active; the row is preserved.
  setChannelActive(db, parsedId.data.id, false);
  revalidatePath(CHANNELS_PATH);
  return { ok: true };
}

export async function reactivateChannel(
  id: number,
): Promise<ChannelActionResult> {
  const parsedId = channelIdSchema.safeParse({ id });
  if (!parsedId.success) {
    return { ok: false, error: "无效的渠道。" };
  }
  setChannelActive(db, parsedId.data.id, true);
  revalidatePath(CHANNELS_PATH);
  return { ok: true };
}
