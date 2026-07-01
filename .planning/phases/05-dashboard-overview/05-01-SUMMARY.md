---
phase: 05-dashboard-overview
plan: "01"
subsystem: database
tags: [dashboard, drizzle, vitest, aggregates, money]

requires:
  - phase: 03-spaces-expiry-usd-snapshot
    provides: frozen space USD payment snapshots and stored expiry dates
  - phase: 04-child-accounts-cascade-delete
    provides: child-account monthly USD snapshots and seat type data
provides:
  - Tested dashboard aggregate facade for renewal risk, USD totals, distributions, and counts.
  - `getDashboardOverview(db, today?)` DTO contract for the root dashboard.
affects: [dashboard, spaces, child-accounts, verification]

tech-stack:
  added: []
  patterns:
    - explicit-db dashboard query facade
    - separate parent-payment and child-monthly cost-class aggregation

key-files:
  created:
    - src/db/dashboard.ts
    - src/db/dashboard.query.test.ts
  modified: []

key-decisions:
  - "Dashboard USD totals use stored integer USD fields only: space.amountUsd plus childAccount.monthlyAmountUsd."
  - "Space payment and child monthly costs are read separately before bucket merging to prevent one-to-many double counting."
  - "The dashboard DTO keeps mutation concerns out of the data contract; it returns read-only totals, buckets, risk rows, and counts."

patterns-established:
  - "Dashboard aggregate facade: one explicit-db function returns all dashboard data required by the root page."
  - "Distribution reconciliation: country, currency, and payment-channel buckets are built from integer USD minor units and checked against the grand total."

requirements-completed: [DASH-01, DASH-02, DASH-03, DASH-04]

coverage:
  - id: D1
    description: "Expired and soon-expiring spaces are returned in risk-first order while normal spaces are excluded."
    requirement: DASH-01
    verification:
      - kind: unit
        ref: "src/db/dashboard.query.test.ts#DASH-01 returns expired and soon spaces first while excluding normal spaces"
        status: pass
    human_judgment: false
  - id: D2
    description: "Total USD spend reconciles from stored space payment and child monthly USD fields without parent-child double counting."
    requirement: DASH-02
    verification:
      - kind: unit
        ref: "src/db/dashboard.query.test.ts#DASH-02 and DASH-03 reconcile stored USD totals without parent-child double counting"
        status: pass
    human_judgment: false
  - id: D3
    description: "Country, currency, and payment-channel distribution buckets each sum exactly to the dashboard grand total."
    requirement: DASH-03
    verification:
      - kind: unit
        ref: "src/db/dashboard.query.test.ts#DASH-02 and DASH-03 reconcile stored USD totals without parent-child double counting"
        status: pass
    human_judgment: false
  - id: D4
    description: "Space, child-account, expiry-status, and child seat-type counts are returned for the dashboard."
    requirement: DASH-04
    verification:
      - kind: unit
        ref: "src/db/dashboard.query.test.ts#DASH-04 returns space, child, expiry status, and seat type counts"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-07-01
status: complete
---

# Phase 05 Plan 01: Dashboard Aggregate Contract Summary

**Stored-field dashboard aggregate facade with Vitest coverage for renewal risk, USD reconciliation, distributions, and counts**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-01T20:49:18+08:00
- **Completed:** 2026-07-01T20:51:37+08:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `src/db/dashboard.query.test.ts` covering DASH-01 through DASH-04 with deterministic fixture data.
- Added `src/db/dashboard.ts` with `getDashboardOverview(db, today?)` and exported dashboard DTO types.
- Preserved accounting semantics by aggregating parent space payments and child monthly costs separately, then merging bucket totals.

## Task Commits

1. **Task 1: Write failing dashboard aggregate tests** - `c03debf` (test)
2. **Task 2: Implement getDashboardOverview with stored-field aggregation** - `722a2bb` (feat)

**Plan metadata:** pending this summary commit

## Files Created/Modified

- `src/db/dashboard.query.test.ts` - Vitest query coverage for renewal-risk ordering, integer USD reconciliation, bucket totals, counts, and empty state.
- `src/db/dashboard.ts` - Explicit-db dashboard aggregate facade and DTO types.

## Decisions Made

- Dashboard totals use stored frozen USD minor-unit fields; no live FX cache, rate, or conversion helper is imported.
- Space payment totals and child monthly totals are accumulated separately so child rows cannot multiply parent space payments.
- The DTO keeps Phase 5 read-only by returning aggregate data only; mutation workflows stay in existing space detail/list surfaces.

## Deviations From Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- `npm test -- src/db/dashboard.query.test.ts` - pass, 4 tests.
- `npx tsc --noEmit` - pass.

## Self-Check: PASSED

- Key files exist on disk.
- Dashboard tests assert the one-to-many double-counting guard.
- Plan requirements `DASH-01`, `DASH-02`, `DASH-03`, and `DASH-04` are represented in structured coverage metadata.

## Next Phase Readiness

Ready for Plan 05-02. The root dashboard can now render a stable `DashboardOverview` DTO without importing database tables into UI components.

---
*Phase: 05-dashboard-overview*
*Completed: 2026-07-01*
