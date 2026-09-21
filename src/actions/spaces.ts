"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import * as spaceWorkflow from "@/lib/mutations/spaces";
import { spaceFormSchema, spaceIdSchema } from "@/lib/validation/space";

/**
 * SPACE-01 / SPACE-04 — space Server Actions.
 *
 * Security (T-03-INPUT / T-03-MASS / T-03-REFDATA):
 * - Every action re-parses input with Zod server-side because Server Actions
 *   are public endpoints; client validation is only convenience.
 * - Parsed fields are whitelisted, blocking mass-assignment.
 * - The mutation workflow owns reference checks, invariants, persistence, and
 *   cache invalidation behind a stable seam.
 */

const SPACES_PATH = "/spaces";
const DELETE_MISMATCH_ERROR = "空间名称不匹配，未删除。";

const deleteSpaceSchema = z.object({
  id: z.number().int().positive(),
  confirmationName: z.string().min(1),
});

export type SpaceActionResult = { ok: true } | { ok: false; error: string };

function revalidateSpace(id?: number): void {
  revalidatePath(SPACES_PATH);
  if (id) {
    revalidatePath(`${SPACES_PATH}/${id}`);
  }
}

function mutationContext(): spaceWorkflow.SpaceMutationContext {
  return { db, revalidate: revalidateSpace };
}

function toActionResult(
  result: spaceWorkflow.SpaceMutationResult,
): SpaceActionResult {
  if (result.ok) return result;

  switch (result.error.code) {
    case "invalid-payment-channel":
      return { ok: false, error: "请选择有效的付款渠道。" };
    case "space-not-found":
      return { ok: false, error: "空间不存在。" };
    case "invalid-period":
      return { ok: false, error: "空间周期无效。" };
    case "missing-period-date":
      return { ok: false, error: "缺少当前周期日期，无法续费。" };
    case "delete-name-mismatch":
      return { ok: false, error: DELETE_MISMATCH_ERROR };
    case "snapshot":
      return { ok: false, error: result.error.message };
  }
}

function validationError(message = "空间信息无效。"): SpaceActionResult {
  return { ok: false, error: message };
}

export async function createSpace(
  input: unknown,
): Promise<SpaceActionResult> {
  const parsed = spaceFormSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error.issues[0]?.message);
  }

  return toActionResult(
    await spaceWorkflow.createSpace(mutationContext(), parsed.data),
  );
}

export async function updateSpace(
  id: number,
  input: unknown,
): Promise<SpaceActionResult> {
  const parsedId = spaceIdSchema.safeParse({ id });
  if (!parsedId.success) {
    return { ok: false, error: "无效的空间。" };
  }

  const parsed = spaceFormSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error.issues[0]?.message);
  }

  return toActionResult(
    await spaceWorkflow.updateSpace(
      mutationContext(),
      parsedId.data.id,
      parsed.data,
    ),
  );
}

export async function renewSpace(id: number): Promise<SpaceActionResult> {
  const parsedId = spaceIdSchema.safeParse({ id });
  if (!parsedId.success) {
    return { ok: false, error: "无效的空间。" };
  }

  return toActionResult(
    await spaceWorkflow.renewSpace(mutationContext(), parsedId.data.id),
  );
}

export async function deleteSpace(
  input: unknown,
): Promise<SpaceActionResult> {
  const parsed = deleteSpaceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "删除确认信息无效。" };
  }

  return toActionResult(
    spaceWorkflow.deleteSpace(
      mutationContext(),
      parsed.data.id,
      parsed.data.confirmationName,
    ),
  );
}
