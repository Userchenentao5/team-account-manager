import { db } from "@/db";
import { listRates, upsertRates, getMostRecentFetchedAt } from "@/db/fxRates";
import type { FxRateRow } from "@/db/fxRates";
import { frankfurterResponseSchema } from "@/lib/validation/fx";
import { CURRENCY_SEED } from "@/db/seed";

/**
 * FX-01 / FX-03 — anti-corruption Frankfurter service (T-02-01..03, T-02-09).
 *
 * This is the ONLY module that talks to Frankfurter. Everything else in the app
 * reads the local `fx_rate` cache. The fetch is time-bounded (D-09) and the
 * untrusted response is Zod-validated (ASVS V5) BEFORE being inverted and
 * atomically upserted. On ANY failure (timeout, non-ok, malformed, poisoned
 * rate) the service writes nothing and falls back to the last good cache,
 * flagging it stale only when a non-empty cache exists (D-04 / Pitfalls 1+5).
 *
 * better-sqlite3 is a native module — this module must run on the Node runtime,
 * never Edge.
 */

const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest";
/** The 5 non-USD seeded currencies; USD is the base and is injected as "1" (D-03). */
const SYMBOLS = CURRENCY_SEED.map((c) => c.code).filter((c) => c !== "USD");
const TIMEOUT_MS = 4000; // D-09 blocking budget (~3–5s discretion)
const ONE_DAY_MS = 24 * 60 * 60 * 1000; // D-07 lazy-refresh age gate

export type FxResult = {
  rates: FxRateRow[];
  fetchedAt: string | null;
  stale: boolean;
};

/**
 * 1 USD = `usdToX` units of X → 1 X = (1 / usdToX) USD, as a fixed-precision
 * decimal STRING (never a float column). Rejects non-finite/non-positive input
 * so a 0/negative/Infinity rate can never poison Phase 3 USD math (T-02-03).
 */
export function invertToUsd(usdToX: number): string {
  if (!Number.isFinite(usdToX) || usdToX <= 0) throw new Error("bad rate");
  return (1 / usdToX).toPrecision(12).replace(/\.?0+$/, ""); // 12 sig-figs, trimmed (A2)
}

/** Snapshot the current cache as the stale-fallback result (writes nothing). */
function fallbackToCache(): FxResult {
  const cached = listRates(db);
  return {
    rates: cached,
    fetchedAt: getMostRecentFetchedAt(db),
    stale: cached.length > 0, // empty cache is not "stale" — nothing to be stale (Pitfall 5)
  };
}

/**
 * Always attempt a live fetch (the manual "refresh rates" path, D-06). On
 * success: validate → invert → atomic upsert → return fresh rows with
 * stale:false (a successful fetch is never stale, regardless of age — D-04).
 * On any throw: fall back to cache, write nothing.
 */
export async function refreshFromApi(): Promise<FxResult> {
  try {
    const url = `${FRANKFURTER_URL}?base=USD&symbols=${SYMBOLS.join(",")}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Frankfurter ${res.status}`);

    const data = frankfurterResponseSchema.parse(await res.json()); // throws → caught below

    const fetchedAt = new Date().toISOString();
    const rows = [
      { currencyCode: "USD", rateToUsd: "1", fetchedAt }, // D-03
      ...Object.entries(data.rates).map(([code, usdToX]) => ({
        currencyCode: code,
        rateToUsd: invertToUsd(usdToX), // D-02/D-03
        fetchedAt,
      })),
    ];
    upsertRates(db, rows); // atomic all-or-nothing write (Pitfall 1)

    return { rates: listRates(db), fetchedAt, stale: false };
  } catch {
    // FX-03 / Success Criterion 3: never write 0/NULL; serve last good cache.
    return fallbackToCache();
  }
}

/**
 * Lazy age-gated refresh used by the Rates screen RSC (D-07/D-08): if the cache
 * is younger than ~1 day, serve it as-is (stale:false — age does NOT drive the
 * stale flag, D-04). If the cache is empty or older, attempt a refresh (which
 * may itself fall back to cache on failure).
 */
export async function ensureFreshRates(): Promise<FxResult> {
  const fetchedAt = getMostRecentFetchedAt(db);
  const isFresh =
    fetchedAt != null && new Date(fetchedAt).getTime() > Date.now() - ONE_DAY_MS;

  if (isFresh) {
    return { rates: listRates(db), fetchedAt, stale: false };
  }
  return refreshFromApi();
}
