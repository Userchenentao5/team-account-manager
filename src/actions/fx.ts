"use server";

import { revalidatePath } from "next/cache";
import { refreshFromApi } from "@/lib/fx/frankfurter";

/**
 * FX-01 / FX-03 — the manual "刷新汇率" Server Action.
 *
 * Security (T-02-06 / Pitfall 6): unlike the channel actions, this action takes
 * NO client input — there is nothing from the client to re-parse. The untrusted
 * input is the external Frankfurter response, validated server-side by the Zod
 * boundary INSIDE the frankfurter service (`frankfurterResponseSchema`). This
 * action only triggers the service and revalidates the rates route; it never
 * passes client data to the DB.
 *
 * The service owns fetch + validate + invert + atomic upsert + last-good
 * fallback, so this action never writes 0/NULL and never throws on API failure
 * (it degrades to a stale cache result). better-sqlite3 forces the Node runtime.
 */

const RATES_PATH = "/reference-data/rates";

export type RefreshRatesResult =
  | { ok: true; stale: boolean; fetchedAt: string | null }
  | { ok: false; error: string };

export async function refreshRates(): Promise<RefreshRatesResult> {
  // No client arguments: the trust boundary is the service-side Zod parse.
  const result = await refreshFromApi(); // owns fetch + validate + fallback
  revalidatePath(RATES_PATH);
  return { ok: true, stale: result.stale, fetchedAt: result.fetchedAt };
}
