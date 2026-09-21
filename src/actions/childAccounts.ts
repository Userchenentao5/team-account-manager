"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import * as childAccountWorkflow from "@/lib/mutations/child-accounts";
import {
  childAccountFormSchema,
  childAccountIdSchema,
} from "@/lib/validation/childAccount";
import { motherSeatFormSchema } from "@/lib/validation/motherAccount";
import { spaceIdSchema } from "@/lib/validation/space";

/**
 * ACCT-02/03 — child-account Server Actions.
 *
 * Server Actions are public mutation endpoints, so every ID and form payload
 * is re-parsed here. The parsed schemas whitelist fields and block
 * credential-like mass assignment by construction. Workflow order,
 * persistence, and cache invalidation live in the mutation module.
 */

const SPACES_PATH = "/spaces";

export type ChildAccountActionResult =
  | { ok: true }
  | { ok: false; error: string };

function validationError(message = "子账号信息无效。"): ChildAccountActionResult {
  return { ok: false, error: message };
}

function revalidateSpace(spaceId: number): void {
  revalidatePath(SPACES_PATH);
  revalidatePath(`${SPACES_PATH}/${spaceId}`);
}

function mutationContext(): childAccountWorkflow.ChildAccountMutationContext {
  return { db, revalidate: revalidateSpace };
}

function toActionResult(
  result: childAccountWorkflow.ChildAccountMutationResult,
): ChildAccountActionResult {
  if (result.ok) return result;

  switch (result.error.code) {
    case "space-not-found":
      return { ok: false, error: "空间不存在。" };
    case "child-not-found":
      return { ok: false, error: "子账号不存在。" };
    case "contact-required":
      return { ok: false, error: "非自用子账号请输入联系方式。" };
    case "invalid-period":
      return { ok: false, error: "订阅周期无效。" };
    case "snapshot":
      return { ok: false, error: result.error.message };
  }
}

export async function createChildAccount(
  spaceId: number,
  input: unknown,
): Promise<ChildAccountActionResult> {
  const parsedSpaceId = spaceIdSchema.safeParse({ id: spaceId });
  if (!parsedSpaceId.success) {
    return { ok: false, error: "无效的空间。" };
  }

  const parsed = childAccountFormSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error.issues[0]?.message);
  }

  return toActionResult(
    await childAccountWorkflow.createChildAccount(
      mutationContext(),
      parsedSpaceId.data.id,
      parsed.data,
    ),
  );
}

export async function updateChildAccount(
  id: number,
  input: unknown,
): Promise<ChildAccountActionResult> {
  const parsedId = childAccountIdSchema.safeParse({ id });
  if (!parsedId.success) {
    return { ok: false, error: "无效的子账号。" };
  }

  const parsed = childAccountFormSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error.issues[0]?.message);
  }

  return toActionResult(
    await childAccountWorkflow.updateChildAccount(
      mutationContext(),
      parsedId.data.id,
      parsed.data,
    ),
  );
}

export async function renewChildAccount(
  id: number,
): Promise<ChildAccountActionResult> {
  const parsedId = childAccountIdSchema.safeParse({ id });
  if (!parsedId.success) {
    return { ok: false, error: "无效的子账号。" };
  }

  return toActionResult(
    childAccountWorkflow.renewChildAccount(
      mutationContext(),
      parsedId.data.id,
    ),
  );
}

export async function deleteChildAccount(
  id: number,
): Promise<ChildAccountActionResult> {
  const parsedId = childAccountIdSchema.safeParse({ id });
  if (!parsedId.success) {
    return { ok: false, error: "无效的子账号。" };
  }

  return toActionResult(
    childAccountWorkflow.deleteChildAccount(
      mutationContext(),
      parsedId.data.id,
    ),
  );
}

export async function updateMotherSeat(
  spaceId: number,
  input: unknown,
): Promise<ChildAccountActionResult> {
  const parsedSpaceId = spaceIdSchema.safeParse({ id: spaceId });
  if (!parsedSpaceId.success) {
    return { ok: false, error: "无效的空间。" };
  }

  const parsed = motherSeatFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "母账号席位信息无效。" };
  }

  return toActionResult(
    childAccountWorkflow.updateMotherSeat(
      mutationContext(),
      parsedSpaceId.data.id,
      parsed.data,
    ),
  );
}
