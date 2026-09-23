import {
  deleteChildAccount as deleteChildAccountRow,
  getChildAccount,
  insertChildAccount,
  updateChildAccount as updateChildAccountRow,
  updateMotherSeat as updateMotherSeatRow,
} from "@/db/childAccounts";
import { getSpaceDetail } from "@/db/spaces";
import {
  nextPaymentDueDate,
  renewPaymentDueDate,
  type Period,
} from "@/lib/expiry";
import { freezeUsdSnapshot } from "@/lib/usd-snapshot";
import type { ChildAccountFormInput } from "@/lib/validation/childAccount";
import type { MotherSeatFormInput } from "@/lib/validation/motherAccount";

type Db = Parameters<typeof getChildAccount>[0];

const SELF_USE_RATE_SOURCE = "self-use";

export type ChildAccountMutationContext = {
  db: Db;
  revalidate: (spaceId: number) => void;
};

export type ChildAccountMutationError =
  | { code: "space-not-found" }
  | { code: "child-not-found" }
  | { code: "contact-required" }
  | { code: "invalid-period" }
  | { code: "snapshot"; message: string };

export type ChildAccountMutationResult =
  | { ok: true }
  | { ok: false; error: ChildAccountMutationError };

type ChildAccountMutationFailure = {
  ok: false;
  error: ChildAccountMutationError;
};

type MonthlySnapshot = {
  monthlyRateUsed: string;
  monthlyRateAsOf: string;
  monthlyRateSource: string;
  monthlyAmountUsd: number;
};

function failure(error: ChildAccountMutationError): ChildAccountMutationFailure {
  return { ok: false, error };
}

async function computeMonthlySnapshot(
  context: ChildAccountMutationContext,
  data: Pick<
    ChildAccountFormInput,
    "monthlyAmountMinor" | "monthlyCurrencyCode"
  >,
): Promise<MonthlySnapshot | ChildAccountMutationFailure> {
  const snapshot = await freezeUsdSnapshot(
    context.db,
    {
      amountMinor: data.monthlyAmountMinor,
      currencyCode: data.monthlyCurrencyCode,
    },
    { zeroAmountSource: SELF_USE_RATE_SOURCE },
  );
  if (!snapshot.ok) {
    return failure({ code: "snapshot", message: snapshot.error });
  }

  return {
    monthlyRateUsed: snapshot.rateUsed,
    monthlyRateAsOf: snapshot.rateAsOf,
    monthlyRateSource: snapshot.rateSource,
    monthlyAmountUsd: snapshot.amountUsd,
  };
}

function validateContact(
  contact: string,
  monthlyRateSource: string,
): ChildAccountMutationResult | null {
  if (monthlyRateSource !== SELF_USE_RATE_SOURCE && !contact) {
    return failure({ code: "contact-required" });
  }
  return null;
}

function childBillingPeriod(
  data: Pick<ChildAccountFormInput, "billingPeriodUnit" | "billingPeriodCount">,
): Period {
  return {
    unit: data.billingPeriodUnit,
    count: data.billingPeriodCount,
  };
}

function toChildValues(
  spaceId: number,
  data: ChildAccountFormInput,
  snapshot: MonthlySnapshot,
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
    billingPeriodUnit: data.billingPeriodUnit,
    billingPeriodCount: data.billingPeriodCount,
    nextPaymentDate,
  };
}

function existingBillingPeriod(
  billingPeriodUnit: string,
  billingPeriodCount: number,
): Period | ChildAccountMutationResult {
  if (
    (billingPeriodUnit !== "month" &&
      billingPeriodUnit !== "quarter" &&
      billingPeriodUnit !== "year") ||
    !Number.isInteger(billingPeriodCount) ||
    billingPeriodCount <= 0
  ) {
    return failure({ code: "invalid-period" });
  }

  return {
    unit: billingPeriodUnit,
    count: billingPeriodCount,
  };
}

export async function createChildAccount(
  context: ChildAccountMutationContext,
  spaceId: number,
  data: ChildAccountFormInput,
): Promise<ChildAccountMutationResult> {
  const space = getSpaceDetail(context.db, spaceId);
  if (!space) return failure({ code: "space-not-found" });

  const snapshot = await computeMonthlySnapshot(context, data);
  if ("ok" in snapshot) return snapshot;
  const contactError = validateContact(data.contact, snapshot.monthlyRateSource);
  if (contactError) return contactError;

  insertChildAccount(
    context.db,
    toChildValues(
      spaceId,
      data,
      snapshot,
      nextPaymentDueDate(
        data.monthlyPaymentDay,
        childBillingPeriod(data),
        data.joinedDate,
      ),
    ),
  );
  context.revalidate(spaceId);
  return { ok: true };
}

export async function updateChildAccount(
  context: ChildAccountMutationContext,
  id: number,
  data: ChildAccountFormInput,
): Promise<ChildAccountMutationResult> {
  const existing = getChildAccount(context.db, id);
  if (!existing) return failure({ code: "child-not-found" });

  const shouldRefreeze =
    data.monthlyAmountMinor !== existing.monthlyAmountMinor ||
    data.monthlyCurrencyCode !== existing.monthlyCurrencyCode;
  const nextPaymentDate =
    data.joinedDate !== existing.joinedDate ||
    data.monthlyPaymentDay !== existing.monthlyPaymentDay ||
    data.billingPeriodUnit !== existing.billingPeriodUnit ||
    data.billingPeriodCount !== existing.billingPeriodCount
      ? nextPaymentDueDate(
          data.monthlyPaymentDay,
          childBillingPeriod(data),
          data.joinedDate,
        )
      : existing.nextPaymentDate;

  const snapshot = shouldRefreeze
    ? await computeMonthlySnapshot(context, data)
    : {
        monthlyRateUsed: existing.monthlyRateUsed,
        monthlyRateAsOf: existing.monthlyRateAsOf,
        monthlyRateSource: existing.monthlyRateSource,
        monthlyAmountUsd: existing.monthlyAmountUsd,
      };
  if ("ok" in snapshot) return snapshot;
  const contactError = validateContact(data.contact, snapshot.monthlyRateSource);
  if (contactError) return contactError;

  updateChildAccountRow(
    context.db,
    id,
    toChildValues(existing.spaceId, data, snapshot, nextPaymentDate),
  );
  context.revalidate(existing.spaceId);
  return { ok: true };
}

export function renewChildAccount(
  context: ChildAccountMutationContext,
  id: number,
): ChildAccountMutationResult {
  const existing = getChildAccount(context.db, id);
  if (!existing) return failure({ code: "child-not-found" });

  const period = existingBillingPeriod(
    existing.billingPeriodUnit,
    existing.billingPeriodCount,
  );
  if (!("unit" in period)) return period;

  updateChildAccountRow(context.db, id, {
    nextPaymentDate: renewPaymentDueDate(
      existing.monthlyPaymentDay,
      period,
      existing.nextPaymentDate,
    ),
  });
  context.revalidate(existing.spaceId);
  return { ok: true };
}

export function deleteChildAccount(
  context: ChildAccountMutationContext,
  id: number,
): ChildAccountMutationResult {
  const existing = getChildAccount(context.db, id);
  if (!existing) return failure({ code: "child-not-found" });

  deleteChildAccountRow(context.db, id);
  context.revalidate(existing.spaceId);
  return { ok: true };
}

export function updateMotherSeat(
  context: ChildAccountMutationContext,
  spaceId: number,
  data: MotherSeatFormInput,
): ChildAccountMutationResult {
  const space = getSpaceDetail(context.db, spaceId);
  if (!space) return failure({ code: "space-not-found" });

  updateMotherSeatRow(context.db, spaceId, data);
  context.revalidate(spaceId);
  return { ok: true };
}
