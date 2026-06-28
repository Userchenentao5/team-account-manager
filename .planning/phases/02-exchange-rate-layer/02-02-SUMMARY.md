---
phase: 02-exchange-rate-layer
plan: 02
subsystem: fx-service
tags: [fx, frankfurter, anti-corruption, zod, fetch, abortsignal, vitest, tdd, asvs-v5]

# Dependency graph
requires:
  - phase: 02-exchange-rate-layer
    plan: 01
    provides: "fx_rate table + fxRates.ts query module (listRates / getMostRecentFetchedAt / atomic upsertRates), createTestDb harness, CURRENCY_SEED"
provides:
  - "src/lib/validation/fx.ts — frankfurterResponseSchema (ASVS V5 boundary) + FrankfurterResponse type"
  - "src/lib/fx/frankfurter.ts — refreshFromApi / ensureFreshRates / invertToUsd + FxResult type (the single Frankfurter caller)"
  - "FxResult shape { rates, fetchedAt, stale } consumed by Plan 03 Server Action + Rates RSC"
affects: [exchange-rate-layer Plan 03 (refreshRates Server Action + Rates screen), Phase 3 USD conversion (FX-02)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Anti-corruption service: a single module owns the entire external boundary (fetch + Zod validate + invert + atomic upsert); nothing else fetch()es Frankfurter"
    - "Fail-safe FX: on any throw write nothing and fall back to last good cache; stale flag is request-scoped, never a DB column, and decoupled from cache age (D-04 vs D-07)"
    - "Inversion guard: USD→X inverted to X→USD via toPrecision(12) decimal STRING; non-finite/non-positive input throws (no 0/NULL/Infinity poisoning)"

key-files:
  created:
    - src/lib/validation/fx.ts
    - src/lib/fx/frankfurter.ts
    - src/lib/fx/frankfurter.test.ts
  modified: []

key-decisions:
  - "Timeout fixed at 4000ms (D-09 ~3–5s discretion, A3)."
  - "invertToUsd uses (1/usdToX).toPrecision(12) trimmed (A2) — no decimal library added (MVP, value is stringified once at write-time, Phase 3 only multiplies)."
  - "Empty-cache + failed fetch returns stale:false (not true) — there is nothing to be stale; the Rates screen will distinguish this empty state from a non-empty stale fallback (Pitfall 5)."
  - "ensureFreshRates age gate uses plain Date math (Date.now() - 24h) rather than date-fns — single comparison, no extra import needed for MVP."

requirements-completed: [FX-01, FX-03]

coverage:
  - id: FX-01-service
    description: "Valid Frankfurter response → inverted X→USD rows cached (USD='1'), stale:false; inversion precision CNY 6.7982→~0.147098, JPY 161.65→~0.006186"
    requirement: "FX-01"
    verification:
      - kind: unit
        ref: "src/lib/fx/frankfurter.test.ts (success+inversion precision, anti-corruption URL boundary)"
        status: pass
    human_judgment: false
  - id: FX-01-agegate
    description: "ensureFreshRates serves a <1d cache without fetching; empty or >1d cache triggers a refresh (D-07, decoupled from stale flag)"
    requirement: "FX-01"
    verification:
      - kind: unit
        ref: "src/lib/fx/frankfurter.test.ts (fresh-no-fetch, stale-by-age refresh, empty-cache refresh)"
        status: pass
    human_judgment: false
  - id: FX-03-fallback
    description: "Timeout/non-ok/malformed/0/negative → returns last cache + stale:true, DB unchanged (no 0/NULL write); empty cache + failed fetch → rates:[], no crash"
    requirement: "FX-03"
    verification:
      - kind: unit
        ref: "src/lib/fx/frankfurter.test.ts (timeout, non-ok 503, poisoned 0/negative, empty-cache+fail)"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-06-28
status: complete
---

# Phase 2 Plan 02: Frankfurter Anti-Corruption FX Service Summary

**The single module that talks to Frankfurter: time-bounded fetch → Zod-validated → USD→X inverted to X→USD decimal strings → atomic upsert, falling back to the last good cache with a request-scoped stale flag on any failure — satisfying FX-01 and FX-03 at the service layer.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-28T01:07:16Z
- **Tasks:** 2
- **Files modified:** 3 (3 created, 0 modified)

## Accomplishments
- Added `src/lib/validation/fx.ts`: `frankfurterResponseSchema` (Zod) validates the external `{amount, base:"USD", date:YYYY-MM-DD, rates}` shape and rejects 0/negative/NaN/Infinity rates — the ASVS V5 anti-corruption boundary (T-02-01).
- Implemented `src/lib/fx/frankfurter.ts` as the ONLY Frankfurter caller: `refreshFromApi` (manual path), `ensureFreshRates` (age-gated lazy path), and `invertToUsd` (the inversion guard). Fetch is bounded by `AbortSignal.timeout(4000)`; on any failure it writes nothing and serves the last good cache (FX-03).
- Locked the behavior with 10 mock-fetch tests (`frankfurter.test.ts`): success + inversion precision, timeout→cache+stale (DB unchanged), non-ok 503 fallback, poisoned 0/negative→no write, empty-cache+fail→`rates:[]`, and the `ensureFreshRates` fresh/old/empty age-gate branches. Full suite 36/36 green; `tsc --noEmit` clean.

## Task Commits

1. **Task 1: Zod boundary schema + failing service test** — `7340b28` (test — RED)
2. **Task 2: Implement frankfurter.ts anti-corruption service** — `be9045c` (feat — GREEN)

_TDD gates: RED (`7340b28` test, import-fails) → GREEN (`be9045c` feat). No separate refactor commit needed._

## Files Created/Modified
- `src/lib/validation/fx.ts` — `frankfurterResponseSchema` + `FrankfurterResponse`; `positiveRate = z.number().finite().positive()` rejects 0/negative/NaN/Infinity.
- `src/lib/fx/frankfurter.ts` — `refreshFromApi`, `ensureFreshRates`, `invertToUsd`, `FxResult`; the single Frankfurter `fetch()` site with timeout + cache fallback.
- `src/lib/fx/frankfurter.test.ts` — 10 cases via `vi.stubGlobal("fetch", …)` + `vi.mock("@/db")` pointed at the in-memory harness; seeds currencies before any cache write (FK ON).

## Decisions Made
- **Timeout = 4000ms** (A3) — within the D-09 ~3–5s discretion; a hung API degrades to cache+stale rather than blocking the page.
- **`invertToUsd` precision = `toPrecision(12)` trimmed** (A2) — no decimal library added; the value is stringified once at write-time and Phase 3 only multiplies, so float division noise is bounded to 12 sig-figs.
- **Empty-cache + failed fetch → `stale:false`** (Pitfall 5) — an empty cache is not "stale"; the Rates screen (Plan 03) shows a distinct "rates unavailable" empty state, while a non-empty fallback gets the stale banner.
- **Age gate uses plain `Date.now()` math, not date-fns** — a single `<1 day` comparison needs no extra import for MVP; date-fns remains available if Plan 03 needs richer formatting.
- **Stale is decoupled from age** (D-04 vs D-07) — `ensureFreshRates` serves a fresh cache with `stale:false` regardless of age; `stale:true` arises only from a *failed refresh attempt this request*.

## Deviations from Plan

None — plan executed exactly as written. The plan's `<verify>` blocks reference `pnpm test`; per the prior-wave note `pnpm` is unavailable in this environment, so `npx vitest run` was used as the documented `npm` equivalent (no behavioral difference). This is a tooling substitution, not a plan deviation.

## Known Stubs

None. All exported functions are fully wired to the live `fx_rate` cache and the Frankfurter endpoint; no placeholder/mock data paths remain.

## Issues Encountered
- Consistent with Plan 01: `pnpm` is not installed; used `npx vitest run` / `npx tsc --noEmit`. The package scripts still reference `pnpm` — Plan 03 verification should use `npx`/`npm`.

## User Setup Required
None — Frankfurter is keyless and quota-free; no environment configuration needed. Live network egress to `api.frankfurter.dev` is exercised only at runtime (tests mock `fetch`).

## Next Phase Readiness
- Plan 03 can build `src/actions/fx.ts` (`refreshRates` Server Action) on `refreshFromApi`, and the Rates RSC on `ensureFreshRates` — both already return the `FxResult { rates, fetchedAt, stale }` contract.
- The anti-corruption boundary is intact and test-locked: only `frankfurter.ts` references the Frankfurter URL / calls `fetch`. Plan 03 must keep its Server Action/route delegating to this service (never fetch directly).

## Self-Check: PASSED

---
*Phase: 02-exchange-rate-layer*
*Completed: 2026-06-28*
