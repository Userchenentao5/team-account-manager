---
phase: 02-exchange-rate-layer
plan: 03
subsystem: fx-ui
tags: [fx, server-action, rsc, shadcn, alert, sidebar, revalidatePath, vitest, force-dynamic]

# Dependency graph
requires:
  - phase: 02-exchange-rate-layer
    plan: 02
    provides: "src/lib/fx/frankfurter.ts (refreshFromApi / ensureFreshRates returning FxResult { rates, fetchedAt, stale })"
  - phase: 02-exchange-rate-layer
    plan: 01
    provides: "fx_rate table + fxRates.ts (listRates) + FxRateRow type"
provides:
  - "src/actions/fx.ts — refreshRates() Server Action (no client input; wraps refreshFromApi + revalidatePath)"
  - "src/app/reference-data/rates/page.tsx — force-dynamic RSC calling ensureFreshRates() on load"
  - "src/components/fx/rate-table.tsx — client refresh button + rate table + stale banner + empty state"
  - "src/components/ui/alert.tsx — first-party shadcn alert (added this phase)"
  - "汇率 sidebar entry under 参考数据 → /reference-data/rates"
affects: [Phase 5 dashboard (USD totals surface), end-of-phase UAT (FX-01 / FX-03 human verification)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Action with NO client input: the trust boundary is the service-side Zod parse, not input re-parsing (Pitfall 6) — unlike channels.ts there is no safeParse of client args"
    - "RSC lazy-refresh handoff: force-dynamic page calls ensureFreshRates() (age-gated) then passes the FxResult to a client table for the interactive refresh button"
    - "Two distinct negative states: destructive stale banner only when (stale && rates non-empty); a separate empty state replaces the table when rates.length===0 — never a fake-zero table (Pitfall 5)"

key-files:
  created:
    - src/actions/fx.ts
    - src/actions/fx.test.ts
    - src/app/reference-data/rates/page.tsx
    - src/components/fx/rate-table.tsx
    - src/components/ui/alert.tsx
  modified:
    - src/components/nav/sidebar.tsx

key-decisions:
  - "refreshRates takes zero parameters (Pitfall 6) — no client data flows to the DB; revalidatePath only after the service write."
  - "As-of label and per-row update time formatted with date-fns format(yyyy-MM-dd HH:mm) in the client component (already a dependency; no new import cost)."
  - "Stale-fallback toast uses the UI-SPEC failure copy (刷新失败,已保留上次缓存的汇率。) rather than a warning variant, matching the copywriting contract."

requirements-completed: [FX-01, FX-03]

coverage:
  - id: FX-01-action
    description: "refreshRates persists the 6 inverted rows via the service and revalidates /reference-data/rates; returns ok:true stale:false on success"
    requirement: "FX-01"
    verification:
      - kind: unit
        ref: "src/actions/fx.test.ts (success persists 6 rows, USD='1', revalidatePath called)"
        status: pass
    human_judgment: false
  - id: FX-03-action-fallback
    description: "Failed fetch with a non-empty cache returns ok:true stale:true and writes nothing (no 0/NULL)"
    requirement: "FX-03"
    verification:
      - kind: unit
        ref: "src/actions/fx.test.ts (stale fallback: DB unchanged, stale:true, fetchedAt preserved)"
        status: pass
    human_judgment: false
  - id: FX-01-FX-03-screen
    description: "汇率 screen reachable from 参考数据; shows 6-row table + 汇率截至 label; manual refresh updates as-of; API-down shows cache + stale banner (no crash, no zeros); cache persists across restart; empty cache shows distinct empty state"
    requirement: "FX-01, FX-03"
    verification:
      - kind: manual
        ref: "Task 3 how-to-verify (5 steps) — deferred to end-of-phase UAT (human_verify_mode: end-of-phase)"
        status: pending
    human_judgment: true

# Metrics
duration: 3min
completed: 2026-06-28
status: complete
---

# Phase 2 Plan 03: Rates Screen + refreshRates Server Action Summary

**The user-visible vertical slice: a `refreshRates` Server Action (no client input — the trust boundary is the service-side Zod parse) plus the 参考数据 → 汇率 screen — a force-dynamic RSC that lazily refreshes on load and hands the FxResult to a client table with an always-on 汇率截至 label, a destructive stale banner, and a distinct empty state — satisfying the user-facing portions of FX-01 and FX-03.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-28T01:14:16Z
- **Tasks:** 2 auto (Task 3 is a human-verify checkpoint deferred to end-of-phase UAT)
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- Added `src/actions/fx.ts`: `refreshRates(): Promise<RefreshRatesResult>` mirroring `channels.ts` structure (`"use server"`, `RATES_PATH` constant, discriminated-union result, `revalidatePath`). It takes NO client arguments — the only untrusted input is the API response, validated inside the service (Pitfall 6 / T-02-06).
- Built the 汇率 screen: `rates/page.tsx` (force-dynamic RSC calling `ensureFreshRates()` on load) → `rate-table.tsx` (`"use client"`: refresh button via `useTransition` → `refreshRates()` → `router.refresh()`, always-on 汇率截至 label, destructive stale banner only when `stale && rates non-empty`, distinct 暂无汇率数据 empty state when `rates.length===0`).
- Added the first-party shadcn `alert` component and a 汇率 sidebar entry under 参考数据 (Banknote icon — Coins is taken by 币种).
- Locked the action with 2 mock tests (success persists 6 rows + revalidates; failed fetch with cache → stale:true, DB unchanged). Full suite 38/38 green; `next build` clean with `/reference-data/rates` correctly dynamic (ƒ).

## Task Commits

1. **Task 1: refreshRates Server Action + test** — `5f9299e` (feat)
2. **Task 2: Rates RSC page + client table + alert component + sidebar entry** — `bb5d0ee` (feat)

## Files Created/Modified
- `src/actions/fx.ts` — `refreshRates` + `RefreshRatesResult` discriminated union; zero parameters; `revalidatePath(RATES_PATH)`.
- `src/actions/fx.test.ts` — 2 cases via `vi.hoisted` db-holder + `vi.mock("next/cache")` + `vi.mock("@/db")` + `vi.stubGlobal("fetch", …)`; seeds currencies before any cache write (FK ON).
- `src/app/reference-data/rates/page.tsx` — `export const dynamic = "force-dynamic"`; awaits `ensureFreshRates()`; renders `<RateTable />`.
- `src/components/fx/rate-table.tsx` — refresh button (RefreshCw, spins while pending), 汇率截至 label, destructive Alert stale banner, empty state, font-mono table with the USD-direction caption.
- `src/components/ui/alert.tsx` — first-party shadcn alert (Alert/AlertTitle/AlertDescription/AlertAction).
- `src/components/nav/sidebar.tsx` — added `{ label: "汇率", href: "/reference-data/rates", icon: Banknote }` + `Banknote` import.

## Decisions Made
- **`refreshRates` takes zero parameters (Pitfall 6 / T-02-06)** — no client data reaches the DB; the action only triggers the service and revalidates. Unlike `channels.ts` there is no `safeParse` of client args; the Zod boundary lives in the service.
- **Date formatting via `date-fns format(yyyy-MM-dd HH:mm)`** in the client component — date-fns is already a dependency; no new import cost. Applied to both the 汇率截至 label and per-row update time.
- **Stale-fallback toast uses the UI-SPEC failure copy** (`刷新失败,已保留上次缓存的汇率。`) rather than a warning variant, matching the copywriting contract exactly.

## Deviations from Plan

None — plan executed exactly as written. Tooling substitution only: the plan's `<verify>` blocks reference `pnpm`, which is unavailable in this environment (per prior-wave note); used `npx vitest run` / `npm run build` / `npx shadcn@latest add alert` as the documented npm equivalents. No behavioral difference.

## Human Verification (deferred to end-of-phase UAT)

`human_verify_mode: end-of-phase` — Task 3 (`checkpoint:human-verify`, gate=blocking) was NOT halted mid-flight; its steps are recorded here for the end-of-phase UAT batch. Verify against FX-01 / FX-03 Success Criteria:
1. `npm run dev`, open http://localhost:3000, 参考数据 → 汇率 — expect 6 currencies (USD=1 + CNY/EUR/GBP/JPY/HKD as X→USD decimals) and a 汇率截至 <date> label. (FX-01)
2. Click 刷新汇率 — expect success toast 汇率已更新 and the as-of date refreshing to today. (D-06)
3. Restart `npm run dev`, reopen the screen — rows must persist (on-disk cache). (Success Criterion 1)
4. Block egress to api.frankfurter.dev (or point at an unreachable host) and click 刷新汇率 — page must NOT crash, cached rows remain, 汇率截至 still shows, and the 汇率可能已过期 stale banner appears; no row shows 0/NULL. (FX-03)
5. (Optional) Empty cache + failing fetch → 暂无汇率数据 empty state instead of a zero-filled table.

## Known Stubs

None. The Server Action and screen are fully wired to the live `fx_rate` cache via the Frankfurter anti-corruption service; no placeholder/mock data paths remain in shipped code (mock fetch exists only in tests).

## Issues Encountered
- Consistent with Plans 01/02: `pnpm` is not installed; used `npm` / `npx`. The package scripts still reference `pnpm` in the plan text but the repo uses npm (`package-lock.json`).

## Next Phase Readiness
- The only Phase 2 acceptance-ready screen is live and reachable; the anti-corruption boundary remains intact (only `frankfurter.ts` fetches Frankfurter; the action and RSC delegate to it).
- Phase 5 dashboard can read the same `fx_rate` cache via `listRates` / `ensureFreshRates` for USD totals (FX-02 conversion arrives in Phase 3).

## Self-Check: PASSED

All 6 files exist on disk; both task commits (`5f9299e`, `bb5d0ee`) present in git history.

---
*Phase: 02-exchange-rate-layer*
*Completed: 2026-06-28*
