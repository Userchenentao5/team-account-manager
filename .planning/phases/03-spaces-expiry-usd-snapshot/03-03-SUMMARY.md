---
phase: 03-spaces-expiry-usd-snapshot
plan: 03
subsystem: data-access
tags: [zod, drizzle, sqlite, spaces]

requires:
  - phase: 03-spaces-expiry-usd-snapshot
    provides: mother_account table and pure expiry/USD helpers
provides:
  - Space form validation schema and id schema
  - Explicit-db space data helpers for insert, list, detail, and update
  - Currency minor-unit and FX-rate read helpers
  - DB-layer tests for sort/filter, joined detail, 1:1 uniqueness, and cascade
affects: [phase-03-space-actions, phase-03-space-ui, phase-04-cascade-delete]

tech-stack:
  added: []
  patterns: [explicit-db helpers, Drizzle parameterized builders, synchronous transaction]

key-files:
  created:
    - src/lib/validation/space.ts
    - src/db/spaces.ts
    - src/db/currencies.ts
    - src/db/spaces.query.test.ts
  modified:
    - src/db/fxRates.ts

key-decisions:
  - "Space DB helpers take an explicit db argument and do not import the production singleton."
  - "Space + mother account insert uses one synchronous SQLite transaction."

patterns-established:
  - "List filtering composes optional Drizzle conditions through and(...) and sorts by expiryDate ascending."
  - "Detail reads return a joined object containing space, motherAccount, paymentChannel, and currency."

requirements-completed: [SPACE-02, SPACE-03, ACCT-01]

coverage:
  - id: D1
    description: "spaceFormSchema parses the allowed space form fields and strips unknown input through Zod object parsing."
    requirement: SPACE-02
    verification:
      - kind: other
        ref: "npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D2
    description: "Space list defaults to expiry-date ascending and supports country and payment-channel filters."
    requirement: SPACE-02
    verification:
      - kind: unit
        ref: "src/db/spaces.query.test.ts#lists spaces by expiry date ascending and applies country/channel filters"
        status: pass
    human_judgment: false
  - id: D3
    description: "Space detail query returns joined mother account, payment channel, and currency data."
    requirement: SPACE-03
    verification:
      - kind: unit
        ref: "src/db/spaces.query.test.ts#inserts a space and mother account atomically and returns joined detail"
        status: pass
    human_judgment: false
  - id: D4
    description: "Mother account 1:1 uniqueness and cascade behavior are enforced by SQLite."
    requirement: ACCT-01
    verification:
      - kind: unit
        ref: "src/db/spaces.query.test.ts#rejects a second mother account for the same space_id"
        status: pass
      - kind: unit
        ref: "src/db/spaces.query.test.ts#cascades mother account deletion when the owning space is deleted"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-06-28
status: complete
---

# Phase 3 Plan 03: Validation and Data Layer Summary

**Space validation and explicit-DB data helpers with tested sort/filter, detail join, 1:1, and cascade behavior**

## Performance

- **Duration:** 14 min
- **Started:** 2026-06-28T04:12:00Z
- **Completed:** 2026-06-28T04:26:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Added `spaceFormSchema`, `SpaceFormInput`, and `spaceIdSchema`.
- Added `insertSpaceWithMother`, `listSpaces`, `getSpaceDetail`, and `updateSpaceRow`.
- Added `getCurrencyMinorUnit` and `getRate` for the Phase 3 freeze pipeline.
- Proved DB behavior with a harness-backed test covering sort/filter, joined detail, unique mother account rejection, cascade delete, currency exponent, and cached rate reads.

## Task Commits

Each task was executed in the working tree; commits were not created because this Codex run is operating inline rather than as a GSD executor subagent.

1. **Task 1: Space validation schema** - pending commit
2. **Task 2: DB data-access helpers** - pending commit
3. **Task 3: DB-helper test** - pending commit

## Files Created/Modified

- `src/lib/validation/space.ts` - Shared Zod schema and id schema for spaces.
- `src/db/spaces.ts` - Explicit-db space CRUD/read helpers.
- `src/db/currencies.ts` - Currency minor-unit lookup helper.
- `src/db/fxRates.ts` - Adds cached-rate lookup helper.
- `src/db/spaces.query.test.ts` - DB harness tests for SPACE-02, SPACE-03, and ACCT-01.

## Decisions Made

- Used inner joins for `getSpaceDetail` because Phase 3 requires every saved space to have a mother account, payment channel, and currency.
- Kept the data layer action-agnostic; FX refresh and save-time composition remain in Plan 04.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The validation and data helpers are ready for the Server Action freeze pipeline in Plan 04.

---
*Phase: 03-spaces-expiry-usd-snapshot*
*Completed: 2026-06-28*
