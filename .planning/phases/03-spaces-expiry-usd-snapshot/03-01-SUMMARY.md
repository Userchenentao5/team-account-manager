---
phase: 03-spaces-expiry-usd-snapshot
plan: 01
subsystem: database
tags: [drizzle, sqlite, schema, mother-account]

requires:
  - phase: 01-foundations-schema-reference-data
    provides: locked space schema and migration harness
provides:
  - DB-enforced mother_account table with one row per space
  - Cascade FK from mother_account.space_id to space.id
  - Generated Drizzle migration for downstream test harnesses
affects: [phase-03-spaces, phase-04-child-accounts-cascade-delete]

tech-stack:
  added: []
  patterns: [drizzle sqliteTable, generated migration, DB-enforced one-to-one]

key-files:
  created:
    - drizzle/0002_simple_the_executioner.sql
  modified:
    - src/db/schema.ts
    - drizzle/meta/_journal.json
    - drizzle/meta/0002_snapshot.json

key-decisions:
  - "Mother account is modeled as a separate table with a UNIQUE space_id FK, not as columns on space."
  - "Only email/login is stored for the mother account; no password, secret, or credential column exists."

patterns-established:
  - "Use `.unique()` on FK columns when a 1:1 relationship must be enforced by SQLite."
  - "Generated Drizzle SQL remains the source of truth for the test harness migration path."

requirements-completed: [ACCT-01]

coverage:
  - id: D1
    description: "mother_account table is exported from schema.ts with id, unique space_id FK, and email columns."
    requirement: ACCT-01
    verification:
      - kind: other
        ref: "npx tsc --noEmit"
        status: pass
      - kind: other
        ref: "Select-String schema checks for motherAccount, unique, cascade, and MotherAccountRow"
        status: pass
    human_judgment: false
  - id: D2
    description: "Generated migration creates mother_account with UNIQUE space_id and ON DELETE cascade."
    requirement: ACCT-01
    verification:
      - kind: other
        ref: "npm run db:generate"
        status: pass
      - kind: other
        ref: "npm run db:migrate"
        status: pass
      - kind: other
        ref: "drizzle/0002_simple_the_executioner.sql inspection"
        status: pass
    human_judgment: false
  - id: D3
    description: "Existing test suite passes against the migrated schema."
    requirement: ACCT-01
    verification:
      - kind: unit
        ref: "npm test"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-06-28
status: complete
---

# Phase 3 Plan 01: Mother Account Schema Summary

**DB-enforced mother_account table with unique space ownership and cascade deletion reserved for Phase 4**

## Performance

- **Duration:** 10 min
- **Started:** 2026-06-28T03:50:00Z
- **Completed:** 2026-06-28T04:00:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `motherAccount` and `MotherAccountRow` to `src/db/schema.ts`.
- Generated `drizzle/0002_simple_the_executioner.sql` for the `mother_account` table.
- Applied the migration locally and verified the existing test suite stays green.

## Task Commits

Each task was executed in the working tree; commits were not created because this Codex run is operating inline rather than as a GSD executor subagent.

1. **Task 1: Add the motherAccount 1:1 table to schema.ts** - pending commit
2. **Task 2: Generate + run the mother_account migration** - pending commit

## Files Created/Modified

- `src/db/schema.ts` - Adds the `motherAccount` Drizzle table and `MotherAccountRow` type.
- `drizzle/0002_simple_the_executioner.sql` - Creates `mother_account` with unique `space_id` and cascade FK.
- `drizzle/meta/_journal.json` - Registers migration `0002_simple_the_executioner`.
- `drizzle/meta/0002_snapshot.json` - Captures the updated schema snapshot.

## Decisions Made

- Kept mother account data in a standalone table to preserve the planned 1:1 model and future child-account cascade path.
- Stored only email/login for the mother account; credential storage remains out of scope by design.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used npm scripts because pnpm is unavailable**
- **Found during:** Task 2 (Generate + run the mother_account migration)
- **Issue:** `pnpm` is not installed on PATH in this shell.
- **Fix:** Used equivalent repo scripts via `npm run db:generate`, `npm run db:migrate`, and `npm test`.
- **Files modified:** None beyond planned migration artifacts.
- **Verification:** Migration generation, migration application, and tests all passed.
- **Committed in:** pending commit

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** No behavioral change; the same package scripts ran through npm.

## Issues Encountered

- `pnpm db:generate` could not run because `pnpm` is not available on PATH. Equivalent npm scripts succeeded.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The `mother_account` schema and migration are ready for downstream Phase 3 data-layer and action tests.

---
*Phase: 03-spaces-expiry-usd-snapshot*
*Completed: 2026-06-28*
