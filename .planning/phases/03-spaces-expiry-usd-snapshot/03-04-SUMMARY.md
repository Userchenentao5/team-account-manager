---
phase: 03-spaces-expiry-usd-snapshot
plan: 04
subsystem: actions
tags: [server-actions, fx-freeze, zod, drizzle]

requires:
  - phase: 03-spaces-expiry-usd-snapshot
    provides: expiry helpers, USD freeze helper, validation schema, and DB helpers
provides:
  - createSpace Server Action
  - updateSpace Server Action
  - Integration tests for no-rate block, atomic create, reference validation, and conditional re-freeze
affects: [phase-03-space-ui, phase-05-dashboard]

tech-stack:
  added: []
  patterns: [server-side Zod reparse, async-before-sync transaction, conditional frozen snapshot]

key-files:
  created:
    - src/actions/spaces.ts
    - src/actions/spaces.test.ts
  modified:
    - src/db/spaces.ts

key-decisions:
  - "Name-only updates preserve existing FX snapshot fields and do not refresh rates."
  - "Amount or currency changes recompute rate_used, rate_as_of, rate_source, and amount_usd."

patterns-established:
  - "Server Actions compose ensureFreshRates before synchronous DB write helpers."
  - "Reference data is validated server-side against active channels and seeded currencies."

requirements-completed: [SPACE-01, SPACE-04, FX-02, ACCT-01]

coverage:
  - id: D1
    description: "`createSpace` blocks when no cached rate exists and leaves the database unchanged."
    requirement: FX-02
    verification:
      - kind: integration
        ref: "src/actions/spaces.test.ts#blocks create when the currency has no cached rate and writes no space"
        status: pass
    human_judgment: false
  - id: D2
    description: "`createSpace` writes space plus mother account and freezes expiry/USD snapshot fields."
    requirement: SPACE-01
    verification:
      - kind: integration
        ref: "src/actions/spaces.test.ts#creates space and mother account with frozen USD snapshot and computed expiry"
        status: pass
    human_judgment: false
  - id: D3
    description: "`updateSpace` preserves frozen snapshot on name-only edits and re-freezes on amount/currency edits."
    requirement: SPACE-04
    verification:
      - kind: integration
        ref: "src/actions/spaces.test.ts#preserves frozen snapshot on name-only update"
        status: pass
      - kind: integration
        ref: "src/actions/spaces.test.ts#re-freezes snapshot when amount or currency changes"
        status: pass
    human_judgment: false
  - id: D4
    description: "`createSpace` rejects inactive payment channels and unseeded currencies."
    requirement: ACCT-01
    verification:
      - kind: integration
        ref: "src/actions/spaces.test.ts#rejects inactive payment channels and unseeded currencies"
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-06-28
status: complete
---

# Phase 3 Plan 04: Space Server Actions Summary

**Server Actions for space create/update with async FX refresh, frozen USD snapshots, and conditional re-freeze semantics**

## Performance

- **Duration:** 16 min
- **Started:** 2026-06-28T04:26:00Z
- **Completed:** 2026-06-28T04:42:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `createSpace` and `updateSpace` with server-side Zod parsing and reference-data validation.
- Composed `ensureFreshRates`, cached rate lookup, `addPeriod`, `freezeUsdMinor`, and atomic DB helpers into the save pipeline.
- Added integration tests proving no-rate blocking, atomic create with mother account, snapshot preservation, re-freeze behavior, and reference rejection.

## Task Commits

Each task was executed in the working tree; commits were not created because this Codex run is operating inline rather than as a GSD executor subagent.

1. **Task 1: createSpace + updateSpace Server Actions** - pending commit
2. **Task 2: Integration tests for the save pipeline** - pending commit

## Files Created/Modified

- `src/actions/spaces.ts` - Server Actions for create/update.
- `src/actions/spaces.test.ts` - Harness-backed action integration tests.
- `src/db/spaces.ts` - Adds `updateMotherAccountEmail` for edit flow.

## Decisions Made

- Kept all FX refresh work outside transaction helpers; DB helpers remain synchronous.
- Updated mother account email via a small explicit-db helper so action code does not reach into schema tables directly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The create/update action pipeline is ready for the Phase 3 UI list, form, and detail pages.

---
*Phase: 03-spaces-expiry-usd-snapshot*
*Completed: 2026-06-28*
