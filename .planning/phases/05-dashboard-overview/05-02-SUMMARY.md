---
phase: 05-dashboard-overview
plan: "02"
subsystem: ui
tags: [dashboard, nextjs, shadcn, radix, css-bars]

requires:
  - phase: 05-dashboard-overview
    provides: 05-01 dashboard aggregate DTO and tests
provides:
  - Dynamic root dashboard page backed by `getDashboardOverview(db)`.
  - Compact metric cards, renewal-risk table, distribution bar lists, and secondary counts.
affects: [dashboard, root-page, spaces]

tech-stack:
  added: []
  patterns:
    - dynamic RSC dashboard page
    - read-only dashboard links to existing detail routes
    - CSS bar-list distributions without chart packages

key-files:
  created:
    - src/components/dashboard/metric-card.tsx
    - src/components/dashboard/expiring-space-table.tsx
    - src/components/dashboard/distribution-list.tsx
  modified:
    - src/app/page.tsx
    - src/db/dashboard.ts

key-decisions:
  - "The root dashboard is `force-dynamic` because it reads the local SQLite database through the production `db` singleton."
  - "The first screen follows the required metric order: renewal risk, frozen USD total, total spaces, total child accounts."
  - "Distribution visuals use fixed-height CSS bars and existing shadcn/Radix primitives; no chart dependency was added."

patterns-established:
  - "Dashboard components are read-only presentational surfaces that consume DTOs instead of importing database tables."
  - "Renewal-risk rows link to existing `/spaces/[id]` detail pages through the space name and tooltip-backed Eye icon."

requirements-completed: [DASH-01, DASH-02, DASH-03, DASH-04]

coverage:
  - id: D1
    description: "The root page renders the approved first-screen metric hierarchy and the renewal-risk table before secondary sections."
    requirement: DASH-01
    verification:
      - kind: other
        ref: "npm run build"
        status: pass
      - kind: other
        ref: "source assertion: page is force-dynamic and calls getDashboardOverview(db)"
        status: pass
    human_judgment: true
    rationale: "First-viewport hierarchy and visual emphasis require browser inspection in Plan 05-03."
  - id: D2
    description: "Frozen USD grand total and subtotals render from the aggregate DTO without live FX recomputation."
    requirement: DASH-02
    verification:
      - kind: unit
        ref: "npm test -- src/db/dashboard.query.test.ts"
        status: pass
      - kind: other
        ref: "npm run build"
        status: pass
    human_judgment: false
  - id: D3
    description: "Country, currency, and payment-channel distributions render as CSS bar lists with reconciliation footer copy."
    requirement: DASH-03
    verification:
      - kind: other
        ref: "source assertion: no chart dependency and DistributionList uses fixed-height bars"
        status: pass
      - kind: other
        ref: "npm run build"
        status: pass
    human_judgment: true
    rationale: "Distribution density and responsive readability require browser inspection in Plan 05-03."
  - id: D4
    description: "Space and child-account count overview renders below the renewal-risk and distribution sections."
    requirement: DASH-04
    verification:
      - kind: other
        ref: "npm run build"
        status: pass
    human_judgment: true
    rationale: "Section ordering and scan quality require visual confirmation."

duration: 7min
completed: 2026-07-01
status: complete
---

# Phase 05 Plan 02: Root Dashboard UI Summary

**Dynamic root dashboard with compact metrics, renewal-risk table, CSS spend distributions, and secondary count overview**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-01T20:51:37+08:00
- **Completed:** 2026-07-01T20:58:29+08:00
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Replaced the `/` placeholder with a dynamic Server Component that reads `getDashboardOverview(db)`.
- Added compact dashboard components for the required top metrics, renewal-risk table, and distribution bar lists.
- Kept the dashboard read-only: links go to existing space detail/list surfaces and no dashboard create/edit/delete controls were added.

## Task Commits

1. **Task 1 and Task 2: Root dashboard metrics, renewal risk, distributions, and counts** - `adc022f` (feat)

**Plan metadata:** pending this summary commit

## Files Created/Modified

- `src/app/page.tsx` - Dynamic root dashboard page with metric hierarchy, empty state, renewal-risk section, distributions, and counts.
- `src/components/dashboard/metric-card.tsx` - Compact metric card component.
- `src/components/dashboard/expiring-space-table.tsx` - Read-only renewal-risk table with `ExpiryBadge` and detail links.
- `src/components/dashboard/distribution-list.tsx` - CSS bar-list card for spend buckets.
- `src/db/dashboard.ts` - Extended risk-row DTO with days-until-expiry and child-account counts for the UI table.

## Decisions Made

- The dashboard page exports `dynamic = "force-dynamic"` to match existing SQLite-backed pages.
- `查看到期空间` is an in-page anchor shown only when renewal risk exists.
- Distribution bars use existing semantic tokens and fixed `h-2` bars rather than any chart package.

## Deviations From Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended dashboard DTO for table columns**
- **Found during:** Task 1 (Build root dashboard metrics and renewal-risk slice)
- **Issue:** Plan 05-02 requires child-account count and days remaining/overdue columns, but Plan 05-01's initial DTO did not expose those fields.
- **Fix:** Added `childAccountCount` and `daysUntilExpiry` to `DashboardExpiringSpaceRow`.
- **Files modified:** `src/db/dashboard.ts`
- **Verification:** `npm test -- src/db/dashboard.query.test.ts`, `npm run build`
- **Committed in:** `adc022f`

---

**Total deviations:** 1 auto-fixed (missing critical)
**Impact on plan:** Required to satisfy the approved expiring-space table contract; no schema or mutation behavior changed.

## Issues Encountered

The first attempt to run the PowerShell source assertions failed because nested command quoting stripped `$page` variables before execution. The checks were rerun with direct PowerShell commands and passed.

## User Setup Required

None - no external service configuration required.

## Verification

- `npm run lint` - pass.
- `npm run build` - pass; `/` is listed as dynamic.
- Source assertion for `force-dynamic`, `getDashboardOverview(db)`, no dashboard mutation wiring, `ExpiryBadge`, and `Eye` link - pass.
- Source/package assertion for no chart package, fixed-height distribution bars, and rendered `DistributionList` - pass.
- `npm test -- src/db/dashboard.query.test.ts` - pass, 4 tests.

## Self-Check: PASSED

- Key files exist on disk.
- The root page uses the required metric order and keeps distributions/counts below the renewal-risk section.
- Package dependencies were not changed.

## Next Phase Readiness

Ready for Plan 05-03 final automated gates and browser visual verification.

---
*Phase: 05-dashboard-overview*
*Completed: 2026-07-01*
