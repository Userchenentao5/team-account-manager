"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { listChannels } from "@/db/channels";
import { getCurrencyMinorUnit } from "@/db/currencies";
import { getRate } from "@/db/fxRates";
import {
  deleteSpaceCascade,
  getSpaceDetail,
  insertSpaceWithMother,
  updateMotherAccountEmail,
  updateSpaceRow,
} from "@/db/spaces";
import { addPeriod } from "@/lib/expiry";
import { ensureFreshRates } from "@/lib/fx/frankfurter";
import { freezeUsdMinor } from "@/lib/money";
import { spaceFormSchema, spaceIdSchema } from "@/lib/validation/space";

/**
 * SPACE-01 / SPACE-04 — space Server Actions.
 *
 * Security (T-03-INPUT / T-03-MASS / T-03-REFDATA):
 * - Every action re-parses input with Zod server-side because Server Actions
 *   are public endpoints; client validation is only convenience.
 * - Parsed fields are whitelisted, blocking mass-assignment.
 * - Reference data is rechecked server-side; client select options are never
 *   trusted as authority.
 */

const SPACES_PATH = "/spaces";
const NO_RATE_ERROR =
  "该币种暂无汇率,无法折算 USD。请先到「汇率」页刷新汇率后重试。";
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

function validationError(message = "空间信息无效。"): SpaceActionResult {
  return { ok: false, error: message };
}

function validateReferences(
  paymentChannelId: number,
  currencyCode: string,
): SpaceActionResult | null {
  const activeChannel = listChannels(db).some(
    (channel) => channel.id === paymentChannelId,
  );
  if (!activeChannel) {
    return { ok: false, error: "请选择有效的付款渠道。" };
  }

  if (getCurrencyMinorUnit(db, currencyCode) === undefined) {
    return { ok: false, error: "请选择有效的币种。" };
  }

  return null;
}

async function computeSnapshot(input: {
  amountMinor: number;
  currencyCode: string;
}): Promise<
  | {
      ok: true;
      rateUsed: string;
      rateAsOf: string;
      rateSource: "frankfurter";
      amountUsd: number;
    }
  | { ok: false; error: string }
> {
  await ensureFreshRates();

  const rate = getRate(db, input.currencyCode);
  if (!rate) {
    return { ok: false, error: NO_RATE_ERROR };
  }

  const srcExp = getCurrencyMinorUnit(db, input.currencyCode);
  if (srcExp === undefined) {
    return { ok: false, error: "请选择有效的币种。" };
  }

  return {
    ok: true,
    rateUsed: rate.rateToUsd,
    rateAsOf: rate.fetchedAt,
    rateSource: "frankfurter",
    amountUsd: freezeUsdMinor(input.amountMinor, srcExp, rate.rateToUsd),
  };
}

export async function createSpace(
  input: unknown,
): Promise<SpaceActionResult> {
  const parsed = spaceFormSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error.issues[0]?.message);
  }

  const data = parsed.data;
  const referenceError = validateReferences(
    data.paymentChannelId,
    data.currencyCode,
  );
  if (referenceError) return referenceError;

  const snapshot = await computeSnapshot(data);
  if (!snapshot.ok) return snapshot;

  const expiryDate = addPeriod(data.currentPeriodStartDate, {
    unit: data.periodUnit,
    count: data.periodCount,
  });

  insertSpaceWithMother(
    db,
    {
      name: data.name,
      country: data.country,
      paymentChannelId: data.paymentChannelId,
      currencyCode: data.currencyCode,
      amountMinor: data.amountMinor,
      periodUnit: data.periodUnit,
      periodCount: data.periodCount,
      openingDate: data.openingDate,
      currentPeriodStartDate: data.currentPeriodStartDate,
      expiryDate,
      rateUsed: snapshot.rateUsed,
      rateAsOf: snapshot.rateAsOf,
      rateSource: snapshot.rateSource,
      amountUsd: snapshot.amountUsd,
    },
    data.motherEmail,
  );

  revalidateSpace();
  return { ok: true };
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

  const data = parsed.data;
  const existing = getSpaceDetail(db, parsedId.data.id);
  if (!existing) {
    return { ok: false, error: "空间不存在。" };
  }

  const referenceError = validateReferences(
    data.paymentChannelId,
    data.currencyCode,
  );
  if (referenceError) return referenceError;

  const expiryDate = addPeriod(data.currentPeriodStartDate, {
    unit: data.periodUnit,
    count: data.periodCount,
  });
  const shouldRefreeze =
    data.amountMinor !== existing.space.amountMinor ||
    data.currencyCode !== existing.space.currencyCode;

  const snapshot = shouldRefreeze
    ? await computeSnapshot(data)
    : {
        ok: true as const,
        rateUsed: existing.space.rateUsed,
        rateAsOf: existing.space.rateAsOf,
        rateSource: existing.space.rateSource,
        amountUsd: existing.space.amountUsd,
      };
  if (!snapshot.ok) return snapshot;

  updateSpaceRow(db, parsedId.data.id, {
    name: data.name,
    country: data.country,
    paymentChannelId: data.paymentChannelId,
    currencyCode: data.currencyCode,
    amountMinor: data.amountMinor,
    periodUnit: data.periodUnit,
    periodCount: data.periodCount,
    openingDate: data.openingDate,
    currentPeriodStartDate: data.currentPeriodStartDate,
    expiryDate,
    rateUsed: snapshot.rateUsed,
    rateAsOf: snapshot.rateAsOf,
    rateSource: snapshot.rateSource,
    amountUsd: snapshot.amountUsd,
  });
  updateMotherAccountEmail(db, parsedId.data.id, data.motherEmail);

  revalidateSpace(parsedId.data.id);
  return { ok: true };
}

export async function renewSpace(id: number): Promise<SpaceActionResult> {
  const parsedId = spaceIdSchema.safeParse({ id });
  if (!parsedId.success) {
    return { ok: false, error: "无效的空间。" };
  }

  const existing = getSpaceDetail(db, parsedId.data.id);
  if (!existing) {
    return { ok: false, error: "空间不存在。" };
  }

  const periodUnit = existing.space.periodUnit ?? "month";
  const periodCount = existing.space.periodCount ?? 1;
  if (
    periodUnit !== "month" &&
    periodUnit !== "quarter" &&
    periodUnit !== "year"
  ) {
    return { ok: false, error: "空间周期无效。" };
  }

  const currentPeriodStartDate =
    existing.space.expiryDate ??
    existing.space.currentPeriodStartDate ??
    existing.space.openingDate;
  if (!currentPeriodStartDate) {
    return { ok: false, error: "缺少当前周期日期，无法续费。" };
  }

  const snapshot = await computeSnapshot({
    amountMinor: existing.space.amountMinor,
    currencyCode: existing.space.currencyCode,
  });
  if (!snapshot.ok) return snapshot;

  const expiryDate = addPeriod(currentPeriodStartDate, {
    unit: periodUnit,
    count: periodCount,
  });

  updateSpaceRow(db, parsedId.data.id, {
    currentPeriodStartDate,
    expiryDate,
    rateUsed: snapshot.rateUsed,
    rateAsOf: snapshot.rateAsOf,
    rateSource: snapshot.rateSource,
    amountUsd: snapshot.amountUsd,
  });

  revalidateSpace(parsedId.data.id);
  return { ok: true };
}

export async function deleteSpace(
  input: unknown,
): Promise<SpaceActionResult> {
  const parsed = deleteSpaceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "删除确认信息无效。" };
  }

  const result = deleteSpaceCascade(
    db,
    parsed.data.id,
    parsed.data.confirmationName,
  );
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "name_mismatch"
          ? DELETE_MISMATCH_ERROR
          : "空间不存在。",
    };
  }

  revalidateSpace(parsed.data.id);
  return { ok: true };
}
