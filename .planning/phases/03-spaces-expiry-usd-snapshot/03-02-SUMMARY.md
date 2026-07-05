---
phase: 03-spaces-expiry-usd-snapshot
plan: 02
subsystem: utilities
tags: [date-fns, bigint, money, expiry]

requires:
  - phase: 01-foundations-schema-reference-data
    provides: integer minor-unit money helpers and currency exponents
  - phase: 02-exchange-rate-layer
    provides: X-to-USD decimal-string rate cache
provides:
  - Calendar-aware `addPeriod` helper
  - Display-only `expiryStatus` helper
  - BigInt-only `freezeUsdMinor` helper
affects: [phase-03-space-actions, phase-03-space-ui, phase-05-dashboard]

tech-stack:
  added: []
  patterns: [date-fns local-date construction, BigInt decimal-string scaling, round-half-up]

key-files:
  created:
    - src/lib/expiry.ts
    - src/lib/expiry.test.ts
  modified:
    - src/lib/money.ts
    - src/lib/money.test.ts

key-decisions:
  - "Date-only strings are split into local Date parts before date-fns math to avoid UTC drift."
  - "USD freeze uses runtime BigInt without BigInt literal syntax so the existing ES2017 TypeScript target still compiles."

patterns-established:
  - "Pure date helpers return YYYY-MM-DD via date-fns format, never toISOString slicing."
  - "FX money conversion scales decimal-string rates with BigInt and round-half-up."

requirements-completed: [EXP-01, FX-02]

coverage:
  - id: D1
    description: "`addPeriod` handles nine month-end, leap-year, quarter, and year-crossing cases."
    requirement: EXP-01
    verification:
      - kind: unit
        ref: "src/lib/expiry.test.ts#adds clamping cases"
        status: pass
      - kind: other
        ref: "npx vitest run src/lib/expiry.test.ts src/lib/money.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "`expiryStatus` classifies expired, soon, and normal using the 7-day threshold."
    requirement: EXP-01
    verification:
      - kind: unit
        ref: "src/lib/expiry.test.ts#classifies expiry status boundaries"
        status: pass
    human_judgment: false
  - id: D3
    description: "`freezeUsdMinor` freezes USD minor amounts exactly for USD, 2-decimal currencies, JPY, rounding, and negative amounts."
    requirement: FX-02
    verification:
      - kind: unit
        ref: "src/lib/money.test.ts#freezeUsdMinor cases"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit"
        status: pass
      - kind: other
        ref: "npm test"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-06-28
status: complete
---

# Phase 3 Plan 02: Expiry and USD Freeze Helpers Summary

**Calendar-aware expiry helpers and BigInt USD freezing for save-time space snapshots**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-28T04:00:00Z
- **Completed:** 2026-06-28T04:12:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `addPeriod` and `expiryStatus` with date-fns month-end/leap clamping and local date construction.
- Extended money helpers with `freezeUsdMinor`, using BigInt and round-half-up without float money math.
- Added tests for all specified expiry edge cases and USD-freeze cases; full suite passes.

## Task Commits

Each task was executed in the working tree; commits were not created because this Codex run is operating inline rather than as a GSD executor subagent.

1. **Task 1: RED->GREEN addPeriod + expiryStatus** - pending commit
2. **Task 2: RED->GREEN freezeUsdMinor** - pending commit

## Files Created/Modified

- `src/lib/expiry.ts` - Adds `PeriodUnit`, `addPeriod`, and `expiryStatus`.
- `src/lib/expiry.test.ts` - Covers the nine specified date clamping cases and status boundaries.
- `src/lib/money.ts` - Adds BigInt-based `freezeUsdMinor`.
- `src/lib/money.test.ts` - Covers USD self-rate, 2-decimal rounding, JPY exponent 0, and negative conversion.

## Decisions Made

- Kept the existing `tsconfig.json` target unchanged and avoided BigInt literal syntax (`10n`) so TypeScript compiles under the repo's current ES2017 target.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced BigInt literal syntax for ES2017 target compatibility**
- **Found during:** Task 2 (`npx tsc --noEmit`)
- **Issue:** TypeScript rejected `10n`, `2n`, and other BigInt literals because the repo targets ES2017.
- **Fix:** Used `BigInt(10)`, `BigInt(2)`, and related constants while preserving BigInt arithmetic.
- **Files modified:** `src/lib/money.ts`
- **Verification:** `npx tsc --noEmit` and focused tests passed.
- **Committed in:** pending commit

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Exact BigInt arithmetic is preserved; no broader compiler target change was needed.

## Issues Encountered

- BigInt literal syntax was incompatible with the current TypeScript target; fixed without changing project configuration.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The pure expiry and USD-freeze helpers are ready for the Phase 3 validation, data-layer, and Server Action plans.

---
*Phase: 03-spaces-expiry-usd-snapshot*
*Completed: 2026-06-28*
