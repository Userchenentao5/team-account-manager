import { listChannels } from "@/db/channels";
import {
  deleteSpaceCascade,
  getSpaceDetail,
  insertSpaceWithMother,
  updateMotherAccountEmail,
  updateSpaceRow,
} from "@/db/spaces";
import { addPeriod, type Period } from "@/lib/expiry";
import { freezeUsdSnapshot } from "@/lib/usd-snapshot";
import type { SpaceFormInput } from "@/lib/validation/space";

type Db = Parameters<typeof getSpaceDetail>[0];

export type SpaceMutationContext = {
  db: Db;
  revalidate: (spaceId?: number) => void;
};

export type SpaceMutationError =
  | { code: "invalid-payment-channel" }
  | { code: "space-not-found" }
  | { code: "invalid-period" }
  | { code: "missing-period-date" }
  | { code: "delete-name-mismatch" }
  | { code: "snapshot"; message: string };

export type SpaceMutationResult =
  | { ok: true }
  | { ok: false; error: SpaceMutationError };

function failure(error: SpaceMutationError): SpaceMutationResult {
  return { ok: false, error };
}

function validatePaymentChannel(
  db: Db,
  paymentChannelId: number,
): SpaceMutationResult | null {
  const activeChannel = listChannels(db).some(
    (channel) => channel.id === paymentChannelId,
  );
  return activeChannel ? null : failure({ code: "invalid-payment-channel" });
}

type SpaceSnapshot = {
  rateUsed: string | null;
  rateAsOf: string | null;
  rateSource: string | null;
  amountUsd: number | null;
};

function toSpaceValues(
  data: SpaceFormInput,
  snapshot: SpaceSnapshot,
  expiryDate: string,
) {
  return {
    name: data.name,
    country: data.country,
    paymentChannelId: data.paymentChannelId,
    currencyCode: data.currencyCode,
    amountMinor: data.amountMinor,
    seatCapacity: data.seatCapacity,
    periodUnit: data.periodUnit,
    periodCount: data.periodCount,
    openingDate: data.openingDate,
    currentPeriodStartDate: data.currentPeriodStartDate,
    expiryDate,
    rateUsed: snapshot.rateUsed,
    rateAsOf: snapshot.rateAsOf,
    rateSource: snapshot.rateSource,
    amountUsd: snapshot.amountUsd,
  };
}

function spacePeriod(existing: NonNullable<ReturnType<typeof getSpaceDetail>>):
  | Period
  | SpaceMutationResult {
  const unit = existing.space.periodUnit ?? "month";
  const count = existing.space.periodCount ?? 1;
  if (
    (unit !== "month" && unit !== "quarter" && unit !== "year") ||
    !Number.isInteger(count) ||
    count <= 0
  ) {
    return failure({ code: "invalid-period" });
  }

  return { unit, count };
}

export async function createSpace(
  context: SpaceMutationContext,
  data: SpaceFormInput,
): Promise<SpaceMutationResult> {
  const referenceError = validatePaymentChannel(
    context.db,
    data.paymentChannelId,
  );
  if (referenceError) return referenceError;

  const snapshot = await freezeUsdSnapshot(context.db, data);
  if (!snapshot.ok) {
    return failure({ code: "snapshot", message: snapshot.error });
  }

  const expiryDate = addPeriod(data.currentPeriodStartDate, {
    unit: data.periodUnit,
    count: data.periodCount,
  });

  insertSpaceWithMother(
    context.db,
    toSpaceValues(data, snapshot, expiryDate),
    data.motherEmail,
  );
  context.revalidate();
  return { ok: true };
}

export async function updateSpace(
  context: SpaceMutationContext,
  id: number,
  data: SpaceFormInput,
): Promise<SpaceMutationResult> {
  const existing = getSpaceDetail(context.db, id);
  if (!existing) return failure({ code: "space-not-found" });

  const referenceError = validatePaymentChannel(
    context.db,
    data.paymentChannelId,
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
    ? await freezeUsdSnapshot(context.db, data)
    : {
        ok: true as const,
        rateUsed: existing.space.rateUsed,
        rateAsOf: existing.space.rateAsOf,
        rateSource: existing.space.rateSource,
        amountUsd: existing.space.amountUsd,
      };
  if (!snapshot.ok) {
    return failure({ code: "snapshot", message: snapshot.error });
  }

  updateSpaceRow(context.db, id, toSpaceValues(data, snapshot, expiryDate));
  updateMotherAccountEmail(context.db, id, data.motherEmail);
  context.revalidate(id);
  return { ok: true };
}

export async function renewSpace(
  context: SpaceMutationContext,
  id: number,
): Promise<SpaceMutationResult> {
  const existing = getSpaceDetail(context.db, id);
  if (!existing) return failure({ code: "space-not-found" });

  const period = spacePeriod(existing);
  if (!("unit" in period)) return period;

  const currentPeriodStartDate =
    existing.space.expiryDate ??
    existing.space.currentPeriodStartDate ??
    existing.space.openingDate;
  if (!currentPeriodStartDate) {
    return failure({ code: "missing-period-date" });
  }

  const snapshot = await freezeUsdSnapshot(context.db, {
    amountMinor: existing.space.amountMinor,
    currencyCode: existing.space.currencyCode,
  });
  if (!snapshot.ok) {
    return failure({ code: "snapshot", message: snapshot.error });
  }

  updateSpaceRow(context.db, id, {
    currentPeriodStartDate,
    expiryDate: addPeriod(currentPeriodStartDate, period),
    rateUsed: snapshot.rateUsed,
    rateAsOf: snapshot.rateAsOf,
    rateSource: snapshot.rateSource,
    amountUsd: snapshot.amountUsd,
  });
  context.revalidate(id);
  return { ok: true };
}

export function deleteSpace(
  context: SpaceMutationContext,
  id: number,
  confirmationName: string,
): SpaceMutationResult {
  const result = deleteSpaceCascade(context.db, id, confirmationName);
  if (!result.ok) {
    return failure({
      code:
        result.reason === "name_mismatch"
          ? "delete-name-mismatch"
          : "space-not-found",
    });
  }

  context.revalidate(id);
  return { ok: true };
}
