---
phase: 02-exchange-rate-layer
reviewed: 2026-06-28T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/actions/fx.test.ts
  - src/actions/fx.ts
  - src/app/reference-data/rates/page.tsx
  - src/components/fx/rate-table.tsx
  - src/components/nav/sidebar.tsx
  - src/components/ui/alert.tsx
  - src/db/fxRates.query.test.ts
  - src/db/fxRates.ts
  - src/db/schema.ts
  - src/lib/fx/frankfurter.test.ts
  - src/lib/fx/frankfurter.ts
  - src/lib/validation/fx.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-06-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the FX/exchange-rate layer: the Frankfurter anti-corruption service,
Zod boundary, atomic upsert, stale/empty-cache fallback, the Server Action, the
Rates RSC + client table, schema, and tests.

The core money-safety properties hold and are well-tested: the Zod boundary
rejects 0/negative/NaN/Infinity, `invertToUsd` throws on non-finite/non-positive
input, USD is pinned to the string `"1"`, rates are stored as decimal strings
(never float columns), the upsert is wrapped in a single transaction
(all-or-nothing at the DB level), and the empty-vs-stale cache distinction is
handled. No injection surface exists (the fetch URL is built only from constant
seed data, no client input reaches the DB). **No BLOCKERs.**

However, three correctness/robustness gaps remain. The most important is that the
Zod schema validates the *shape* of `rates` but not its *completeness* — a
partial Frankfurter response is accepted and produces a partial cache write that
is then presented to the user as fully fresh. There is also a dead `{ok:false}`
result contract on the action, and an exponential-notation edge case in
`invertToUsd` that violates its own trimmed-decimal contract.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Partial Frankfurter response passes validation → silent partial refresh shown as "fresh"

**File:** `src/lib/validation/fx.ts:20` and `src/lib/fx/frankfurter.ts:71-81`
**Issue:** `frankfurterResponseSchema.rates` is `z.record(z.string().length(3), positiveRate)`.
A `z.record` accepts *any* set of keys, including a subset of the requested
symbols. If Frankfurter returns a partial response (e.g. it temporarily drops
`JPY`), the schema passes, and `refreshFromApi` builds rows only for the
currencies present plus USD. `upsertRates` then writes those rows with a fresh
`fetchedAt`, leaving the missing currency at its old rate/old `fetchedAt`.
`getMostRecentFetchedAt` returns the new timestamp and the service returns
`stale: false`, so the Rates screen renders "汇率截至 \<now\>" with no stale
banner — while one currency silently retains a stale rate. For an app whose core
value is an accurate USD total, presenting a partially-refreshed cache as fully
fresh is a real correctness risk. The "atomic all-or-nothing" guarantee in the
comments only covers the DB transaction, not "all 6 currencies refreshed
together."
**Fix:** Validate completeness against the expected symbol set before upserting,
e.g.:
```ts
// in validation/fx.ts — assert exactly the expected non-USD currencies are present
const EXPECTED = ["CNY", "EUR", "GBP", "HKD", "JPY"] as const;
export const frankfurterResponseSchema = z.object({
  amount: z.number().positive(),
  base: z.literal("USD"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rates: z.record(z.string().length(3), positiveRate),
}).refine(
  (r) => EXPECTED.every((c) => r.rates[c] !== undefined),
  { message: "Frankfurter response missing one or more expected currencies" },
);
```
A missing currency then throws → the service falls back to the last good cache
intact, instead of half-updating it.

### WR-02: `RefreshRatesResult.{ ok: false }` is unreachable — misleading contract + dead UI branch

**File:** `src/actions/fx.ts:23-32`, `src/components/fx/rate-table.tsx:47-50`
**Issue:** `refreshRates` always returns `{ ok: true, ... }` because `refreshFromApi`
never throws (it catches everything and degrades to cache). The
`{ ok: false; error: string }` arm of `RefreshRatesResult` can therefore never be
produced. In `rate-table.tsx`, the `else { toast.error("刷新失败,请重试。") }`
branch (lines 48-50, reached only when `res.ok === false`) is dead code. The type
advertises a failure mode the function cannot return, which will mislead future
callers into writing handling that never runs.
**Fix:** Either make the action actually report hard failures (wrap the body in
try/catch and return `{ ok: false, error }` on an unexpected throw such as
`revalidatePath` failing), or drop the `{ ok: false }` variant and simplify the
client handler to the two real states (`stale` false/true). Pick one so the type
matches reality.

### WR-03: `invertToUsd` emits exponential-notation strings for extreme rates, violating its trimmed-decimal contract

**File:** `src/lib/fx/frankfurter.ts:38-41`
**Issue:** The function documents a "12 sig-figs, trimmed" decimal string, but
`Number.prototype.toPrecision` switches to exponential notation for very small
or very large magnitudes. For example `invertToUsd(1e8)` returns
`"1.00000000000e-8"`: the trailing-zero trim `replace(/\.?0+$/, "")` does nothing
(the string ends in `"e-8"`, not a zero run), so the result is both
exponential *and* un-trimmed. Any downstream decimal-string parser that expects
plain `[0-9.]` (rather than `Number()`) would mishandle this. The 6 currently
seeded currencies cannot trigger it (their inverted rates land in ~0.006–1.3),
so this is latent, but `invertToUsd` is an exported, generic helper and the
currency set is explicitly expected to grow.
**Fix:** Normalize to a plain fixed-point string and trim, e.g.:
```ts
export function invertToUsd(usdToX: number): string {
  if (!Number.isFinite(usdToX) || usdToX <= 0) throw new Error("bad rate");
  const inv = 1 / usdToX;
  // toFixed avoids exponential; choose enough fractional digits for small rates
  return inv.toPrecision(12).includes("e")
    ? inv.toFixed(12).replace(/\.?0+$/, "")
    : inv.toPrecision(12).replace(/\.?0+$/, "");
}
```
or assert `!result.includes("e")` and throw, so an unexpected magnitude fails
closed into the cache fallback rather than persisting a malformed string.

## Info

### IN-01: Redundant `amount` union in the Zod schema

**File:** `src/lib/validation/fx.ts:17`
**Issue:** `amount: z.literal(1).or(z.number().positive())` — `z.number().positive()`
already accepts `1`, so the `z.literal(1)` branch is redundant and adds no
constraint. Frankfurter always returns `amount: 1` for a base request.
**Fix:** Use `amount: z.literal(1)` if you want to assert it, or
`z.number().positive()` if you want to be lenient — not both.

### IN-02: Time-dependent test relies on the real wall clock

**File:** `src/lib/fx/frankfurter.test.ts:161-175`
**Issue:** The "stale-by-age cache (>~1 day) triggers a refresh" test seeds a
hardcoded `2026-06-20` `fetchedAt` and depends on `Date.now()` being more than
one day later. It passes today and going forward, but it couples test outcome to
the system clock instead of controlling time. If the suite is ever run with a
faked/frozen clock or in a reproducibility context, the age gate could flip.
**Fix:** Freeze time with `vi.useFakeTimers()` / `vi.setSystemTime(...)` so the
1-day boundary is deterministic and independent of when the suite runs.

### IN-03: "汇率截至" label renders UTC timestamps in browser-local time without a timezone hint

**File:** `src/components/fx/rate-table.tsx:29-34, 76-78`
**Issue:** `fetchedAt` is stored as UTC (`new Date().toISOString()`); `formatAsOf`
uses date-fns `format`, which renders in the *browser's* local timezone with no
timezone label. For a single-user app this is acceptable, but the "as of" time
shown can differ from what the user expects if they reason about it as UTC.
**Fix:** Either append a timezone indicator, or document that the label is local
time. Low priority for single-user scope.

---

_Reviewed: 2026-06-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
