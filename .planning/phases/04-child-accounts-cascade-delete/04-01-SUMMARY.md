---
phase: 04-child-accounts-cascade-delete
plan: 01
subsystem: database
tags: [drizzle, sqlite, child-accounts, cascade-delete]
requires:
  - phase: 03-spaces-expiry-usd-snapshot
    provides: "space and mother_account persistence"
provides:
  - "child_account table with space FK cascade"
  - "mother_account seat metadata defaults"
  - "explicit-db child account helpers"
  - "migration-backed child account query tests"
affects: [phase-04, account-management, cascade-delete]
tech-stack:
  added: []
  patterns:
    - "Explicit-db helpers for child account CRUD"
key-files:
  created:
    - drizzle/0004_brown_madripoor.sql
    - drizzle/meta/0004_snapshot.json
    - src/db/childAccounts.ts
    - src/db/childAccounts.query.test.ts
  modified:
    - src/db/schema.ts
    - drizzle/meta/_journal.json
key-decisions:
  - "Existing mother accounts default to seat_type=codex and can_change_seat_type=true."
patterns-established:
  - "Child accounts cascade from space deletion at the SQLite FK layer."
requirements-completed: [ACCT-02, ACCT-03, SPACE-05]
coverage:
  - id: D1
    description: "Child account and mother seat schema contracts exist with cascade/default migration evidence"
    requirement: ACCT-02
    verification:
      - kind: integration
        ref: "npx vitest run src/db/childAccounts.query.test.ts src/db/spaces.query.test.ts"
        status: pass
      - kind: other
        ref: "npx drizzle-kit generate"
        status: pass
    human_judgment: false
duration: 20min
completed: 2026-06-30
status: complete
---

# Phase 04 Plan 01: Child Account Persistence Summary

**Child account schema, generated migration, explicit DB helpers, and cascade tests**

## Performance

- **Duration:** 20 min
- **Started:** 2026-06-30T14:15:00Z
- **Completed:** 2026-06-30T14:35:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added `mother_account.seat_type` and `mother_account.can_change_seat_type` with non-null defaults.
- Added `child_account` with child seat, identifier, monthly billing, frozen monthly USD snapshot, and `ON DELETE cascade` from `space`.
- Added explicit-db child account helpers and migration-backed tests for insert/list/update/delete, mother seat update, per-space isolation, and no-orphan cascade.

## Task Commits

No task commits were created because the working tree already contained substantial uncommitted Phase 2/3 source and planning artifacts. The implementation was verified in-place.

## Files Created/Modified

- `src/db/schema.ts` - mother seat metadata and `childAccount` table/types.
- `drizzle/0004_brown_madripoor.sql` - Phase 04 schema migration.
- `drizzle/meta/_journal.json` and `drizzle/meta/0004_snapshot.json` - Drizzle migration metadata.
- `src/db/childAccounts.ts` - explicit-db child account CRUD and mother seat update helpers.
- `src/db/childAccounts.query.test.ts` - migration-backed DB behavior tests.

## Decisions Made

- Kept seat type constraints at the validation/action layer, matching the local schema style.
- Kept CNY out of persistence; child monthly USD snapshots use the same frozen USD model as spaces.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Verification

- `npx drizzle-kit generate` passed and produced `drizzle/0004_brown_madripoor.sql`.
- `npx vitest run src/db/childAccounts.query.test.ts src/db/spaces.query.test.ts` passed.
- `npx tsc --noEmit` passed after Wave 1.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Schema, migration, and DB helper contracts are ready for child account Server Actions and UI wiring.

---
*Phase: 04-child-accounts-cascade-delete*
*Completed: 2026-06-30*
