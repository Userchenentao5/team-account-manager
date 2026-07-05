"use server";

import { revalidatePath } from "next/cache";
import { refreshFromApi } from "@/lib/fx/frankfurter";
import { DEFAULT_RATE_BASE, isRateBase, type RateBase } from "@/lib/fx/base";

/**
 * FX-01 / FX-03 — the manual "刷新汇率" Server Action.
 *
 * Security (T-02-06 / Pitfall 6): the only client input is the requested display
 * base, constrained to the local USD/CNY allow-list before any fetch happens.
 * The untrusted input is still the external Frankfurter response, validated
 * server-side by the Zod boundary INSIDE the frankfurter service
 * (`frankfurterResponseSchema`). This action only triggers the service and
 * revalidates the rates route; it never passes arbitrary client data to the DB.
 *
 * The service owns fetch + validate + invert + atomic upsert + last-good
 * fallback, so this action never writes 0/NULL and never throws on API failure
 * (it degrades to a stale cache result). better-sqlite3 forces the Node runtime.
 */

const RATES_PATH = "/reference-data/rates";

export type RefreshRatesResult =
  | { ok: true; stale: boolean; fetchedAt: string | null; base: RateBase }
  | { ok: false; error: string };

export async function refreshRates(
  baseInput: unknown = DEFAULT_RATE_BASE,
): Promise<RefreshRatesResult> {
  if (!isRateBase(baseInput)) {
    return { ok: false, error: "无效的汇率基准。" };
  }

  const result = await refreshFromApi(baseInput); // owns fetch + validate + fallback
  revalidatePath(RATES_PATH);
  return {
    ok: true,
    stale: result.stale,
    fetchedAt: result.fetchedAt,
    base: baseInput,
  };
}
