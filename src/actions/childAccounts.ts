"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  deleteChildAccount as deleteChildAccountRow,
  getChildAccount,
  insertChildAccount,
  updateChildAccount as updateChildAccountRow,
  updateMotherSeat as updateMotherSeatRow,
} from "@/db/childAccounts";
import { getCurrencyMinorUnit } from "@/db/currencies";
import { getRate } from "@/db/fxRates";
import { getSpaceDetail } from "@/db/spaces";
import {
  nextMonthlyPaymentDueDate,
  renewMonthlyPaymentDueDate,
} from "@/lib/expiry";
import { ensureFreshRates } from "@/lib/fx/frankfurter";
import { freezeUsdMinor } from "@/lib/money";
import {
  childAccountFormSchema,
  childAccountIdSchema,
  type ChildAccountFormInput,
} from "@/lib/validation/childAccount";
import { motherSeatFormSchema } from "@/lib/validation/motherAccount";
import { spaceIdSchema } from "@/lib/validation/space";

/**
 * ACCT-02/03 — child-account Server Actions.
 *
 * Server Actions are public mutation endpoints, so every ID and form payload is
 * re-parsed here. The parsed schemas whitelist fields and block credential-like
 * mass assignment by construction.
 */

const SPACES_PATH = "/spaces";
const NO_RATE_ERROR =
  "该币种暂无汇率，无法折算 USD。请先到「汇率」页刷新汇率后重试。";
const SELF_USE_RATE_SOURCE = "self-use";

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

function validateContactForStatus(
  contact: string,
  monthlyRateSource: string,
): ChildAccountActionResult {
  if (monthlyRateSource !== SELF_USE_RATE_SOURCE && !contact) {
    return { ok: false, error: "非自用子账号请输入联系方式。" };
  }

  return { ok: true };
}

async function computeMonthlySnapshot(input: {
  monthlyAmountMinor: number;
  monthlyCurrencyCode: string;
}): Promise<
  | {
      ok: true;
      monthlyRateUsed: string;
      monthlyRateAsOf: string;
      monthlyRateSource: string;
      monthlyAmountUsd: number;
    }
  | { ok: false; error: string }
> {
  const srcExp = getCurrencyMinorUnit(db, input.monthlyCurrencyCode);
  if (srcExp === undefined) {
    return { ok: false, error: "请选择有效的币种。" };
  }

  if (input.monthlyAmountMinor === 0) {
    return {
      ok: true,
      monthlyRateUsed: "1",
      monthlyRateAsOf: new Date().toISOString(),
      monthlyRateSource: SELF_USE_RATE_SOURCE,
      monthlyAmountUsd: 0,
    };
  }

  await ensureFreshRates();

  const rate = getRate(db, input.monthlyCurrencyCode);
  if (!rate) {
    return { ok: false, error: NO_RATE_ERROR };
  }

  return {
    ok: true,
    monthlyRateUsed: rate.rateToUsd,
    monthlyRateAsOf: rate.fetchedAt,
    monthlyRateSource: "frankfurter",
    monthlyAmountUsd: freezeUsdMinor(
      input.monthlyAmountMinor,
      srcExp,
      rate.rateToUsd,
    ),
  };
}

function toChildValues(
  spaceId: number,
  data: ChildAccountFormInput,
  snapshot: {
    monthlyRateUsed: string;
    monthlyRateAsOf: string;
    monthlyRateSource: string;
    monthlyAmountUsd: number;
  },
  nextPaymentDate: string | null,
) {
  return {
    spaceId,
    seatType: data.seatType,
    email: data.email,
    contact: data.contact,
    label: data.label,
    joinedDate: data.joinedDate,
    monthlyAmountMinor: data.monthlyAmountMinor,
    monthlyCurrencyCode: data.monthlyCurrencyCode,
    monthlyRateUsed: snapshot.monthlyRateUsed,
    monthlyRateAsOf: snapshot.monthlyRateAsOf,
    monthlyRateSource: snapshot.monthlyRateSource,
    monthlyAmountUsd: snapshot.monthlyAmountUsd,
    monthlyPaymentDay: data.monthlyPaymentDay,
    nextPaymentDate,
  };
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

  const space = getSpaceDetail(db, parsedSpaceId.data.id);
  if (!space) {
    return { ok: false, error: "空间不存在。" };
  }

  const snapshot = await computeMonthlySnapshot(parsed.data);
  if (!snapshot.ok) return snapshot;
  const contactCheck = validateContactForStatus(
    parsed.data.contact,
    snapshot.monthlyRateSource,
  );
  if (!contactCheck.ok) return contactCheck;

  insertChildAccount(
    db,
    toChildValues(
      parsedSpaceId.data.id,
      parsed.data,
      snapshot,
      nextMonthlyPaymentDueDate(
        parsed.data.monthlyPaymentDay,
        parsed.data.joinedDate,
      ),
    ),
  );
  revalidateSpace(parsedSpaceId.data.id);
  return { ok: true };
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

  const existing = getChildAccount(db, parsedId.data.id);
  if (!existing) {
    return { ok: false, error: "子账号不存在。" };
  }

  const data = parsed.data;
  const shouldRefreeze =
    data.monthlyAmountMinor !== existing.monthlyAmountMinor ||
    data.monthlyCurrencyCode !== existing.monthlyCurrencyCode;
  const nextPaymentDate =
    data.joinedDate !== existing.joinedDate ||
    data.monthlyPaymentDay !== existing.monthlyPaymentDay
      ? nextMonthlyPaymentDueDate(data.monthlyPaymentDay, data.joinedDate)
      : existing.nextPaymentDate;

  const snapshot = shouldRefreeze
    ? await computeMonthlySnapshot(data)
    : {
        ok: true as const,
        monthlyRateUsed: existing.monthlyRateUsed,
        monthlyRateAsOf: existing.monthlyRateAsOf,
        monthlyRateSource: existing.monthlyRateSource,
        monthlyAmountUsd: existing.monthlyAmountUsd,
      };
  if (!snapshot.ok) return snapshot;
  const contactCheck = validateContactForStatus(
    data.contact,
    snapshot.monthlyRateSource,
  );
  if (!contactCheck.ok) return contactCheck;

  updateChildAccountRow(
    db,
    parsedId.data.id,
    toChildValues(existing.spaceId, data, snapshot, nextPaymentDate),
  );
  revalidateSpace(existing.spaceId);
  return { ok: true };
}

export async function renewChildAccount(
  id: number,
): Promise<ChildAccountActionResult> {
  const parsedId = childAccountIdSchema.safeParse({ id });
  if (!parsedId.success) {
    return { ok: false, error: "无效的子账号。" };
  }

  const existing = getChildAccount(db, parsedId.data.id);
  if (!existing) {
    return { ok: false, error: "子账号不存在。" };
  }

  updateChildAccountRow(db, parsedId.data.id, {
    nextPaymentDate: renewMonthlyPaymentDueDate(
      existing.monthlyPaymentDay,
      existing.nextPaymentDate,
    ),
  });
  revalidateSpace(existing.spaceId);
  return { ok: true };
}

export async function deleteChildAccount(
  id: number,
): Promise<ChildAccountActionResult> {
  const parsedId = childAccountIdSchema.safeParse({ id });
  if (!parsedId.success) {
    return { ok: false, error: "无效的子账号。" };
  }

  const existing = getChildAccount(db, parsedId.data.id);
  if (!existing) {
    return { ok: false, error: "子账号不存在。" };
  }

  deleteChildAccountRow(db, parsedId.data.id);
  revalidateSpace(existing.spaceId);
  return { ok: true };
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

  const space = getSpaceDetail(db, parsedSpaceId.data.id);
  if (!space) {
    return { ok: false, error: "空间不存在。" };
  }

  updateMotherSeatRow(db, parsedSpaceId.data.id, parsed.data);
  revalidateSpace(parsedSpaceId.data.id);
  return { ok: true };
}
