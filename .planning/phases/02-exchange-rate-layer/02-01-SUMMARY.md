---
phase: 02-exchange-rate-layer
plan: 01
subsystem: database
tags: [drizzle, better-sqlite3, sqlite, fx, exchange-rate, migration, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: currency table + seed, payment_channel/space schema, createTestDb harness, programmatic migrate() flow, channels query-module pattern
provides:
  - fx_rate table (one row per currency, FK -> currency.code) migrated on disk and in the test harness
  - FxRateRow / FxRateInsert types
  - fxRates.ts query module (listRates / getMostRecentFetchedAt / atomic upsertRates)
  - committed drizzle/0001 migration
affects: [exchange-rate-layer Plan 02 (frankfurter service + Server Action + rates page), Phase 3 USD conversion (FX-02)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic multi-row upsert via drizzle db.transaction(tx => ...) + onConflictDoUpdate (all-or-nothing cache write)"
    - "Rate values stored as X->USD decimal STRINGS, never float columns (D-02); USD pinned to literal '1' (D-03)"
    - "Explicit-db query module (mirrors channels.ts) so helpers run against both prod singleton and createTestDb"

key-files:
  created:
    - src/db/fxRates.ts
    - src/db/fxRates.query.test.ts
    - drizzle/0001_charming_rawhide_kid.sql
  modified:
    - src/db/schema.ts

key-decisions:
  - "Omitted the optional rateDate column (A1) — MVP: upsertRates and all five behaviors only need rateToUsd + fetchedAt; Frankfurter publication date can be added additively in Plan 02 if needed."
  - "upsertRates uses drizzle's db.transaction(tx => ...) (immediate execution + tx handle), NOT better-sqlite3's curried db.transaction(fn)() — the pattern guidance's trailing () was incorrect for a drizzle instance."

patterns-established:
  - "Atomic FX cache write: wrap every row in one db.transaction + onConflictDoUpdate keyed on currencyCode PK — never a partial/0/NULL row set (Pitfall 1)."
  - "FK-seeded query tests: seedCurrencies(ctx.db) in beforeEach before any fx_rate insert, since createTestDb enforces foreign_keys=ON."

requirements-completed: [FX-01]

coverage:
  - id: D1
    description: "fx_rate table persists one row per currency (text PK, FK -> currency.code) on-disk SQLite, migrated via committed drizzle/0001"
    requirement: "FX-01"
    verification:
      - kind: integration
        ref: "drizzle/0001_charming_rawhide_kid.sql (CREATE TABLE fx_rate) + npm run db:migrate clean"
        status: pass
      - kind: unit
        ref: "src/db/fxRates.query.test.ts#inserting an fx_rate row for a non-seeded currency code fails the FK constraint"
        status: pass
    human_judgment: false
  - id: D2
    description: "Rates stored as X->USD decimal strings with USD pinned to '1'; atomic upsert never persists a partial set; listRates ordered; getMostRecentFetchedAt returns latest or null"
    requirement: "FX-01"
    verification:
      - kind: unit
        ref: "src/db/fxRates.query.test.ts (6 cases: USD='1', PK-conflict update, ordering, latest fetched_at, null on empty, FK reject)"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-06-28
status: complete
---

# Phase 2 Plan 01: FX Cache Persistence Foundation Summary

**fx_rate cache table (one row per currency, FK to seeded currencies) with an atomic decimal-string upsert query module, migrated on disk and locked by green Wave 0 tests.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-28T00:59:14Z
- **Completed:** 2026-06-28T01:02:02Z
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- Added the `fx_rate` table to `schema.ts`: `currencyCode` text PK + FK -> `currency.code` (D-01), `rateToUsd` text decimal string (D-02), `fetchedAt` text ISO wall-clock (D-05/D-07); exported `FxRateRow`.
- Generated and applied the additive `drizzle/0001_charming_rawhide_kid.sql` migration (non-interactive) creating `fx_rate`, with updated `drizzle/meta`; the on-disk `./data/app.db` and the test harness now provision the table.
- Implemented `src/db/fxRates.ts` with `listRates`, `getMostRecentFetchedAt`, and an atomic `upsertRates` (transaction + `onConflictDoUpdate`); 6/6 query tests green, full suite 26/26 green (no regression).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add fx_rate table + failing query test** - `48f1321` (test — RED)
2. **Task 2: [BLOCKING] Generate + apply the fx_rate migration** - `434711c` (feat)
3. **Task 3: Implement fxRates.ts query module** - `b6bdfe9` (feat — GREEN)

_TDD gates: RED (`48f1321` test) → GREEN (`b6bdfe9` feat). No separate refactor commit needed._

## Files Created/Modified
- `src/db/schema.ts` - Added `fxRate` table + `FxRateRow` type.
- `src/db/fxRates.query.test.ts` - 6 behaviors: USD='1', PK-conflict update, ordering, latest fetched_at, null-on-empty, FK rejection.
- `src/db/fxRates.ts` - `listRates` / `getMostRecentFetchedAt` / atomic `upsertRates`; exports `FxRateInsert`, re-exports `FxRateRow`.
- `drizzle/0001_charming_rawhide_kid.sql` (+ `drizzle/meta/0001_snapshot.json`, `_journal.json`) - Additive CREATE TABLE fx_rate.

## Decisions Made
- **Omitted the optional `rateDate` column (A1):** MVP scope — the upsert set and all five required behaviors only need `rateToUsd` + `fetchedAt`. Frankfurter's publication date can be added additively in Plan 02 without a backfill, so it is not pre-declared here.
- **Transaction API:** used drizzle's `db.transaction(tx => ...)` (runs immediately, queries via the `tx` handle) rather than the curried `db.transaction(fn)()` better-sqlite3 form shown in the pattern guidance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the upsert transaction call to drizzle's API**
- **Found during:** Task 3 (Implement fxRates.ts — GREEN)
- **Issue:** The PATTERNS/RESEARCH snippet used `db.transaction(() => {...})()` with a trailing call and the outer `db` inside the body. On a drizzle better-sqlite3 instance `db.transaction(cb)` executes the callback immediately and is not curried, so the trailing `()` threw `db.transaction(...) is not a function`, failing 4 tests.
- **Fix:** Changed to `db.transaction((tx) => { ... tx.insert(...) ... })` — no trailing call, queries run on the `tx` handle so they are genuinely inside the transaction.
- **Files modified:** src/db/fxRates.ts
- **Verification:** `npm test src/db/fxRates.query.test.ts` 6/6 green; full suite 26/26 green.
- **Committed in:** `b6bdfe9` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix was required for the atomic-upsert contract to work at all. No scope creep; the all-or-nothing guarantee (Pitfall 1) is preserved.

## Issues Encountered
- `pnpm` is not installed in this environment despite the package.json scripts referencing it; the project actually has a `package-lock.json`. Used `npm` (`npm run db:generate`, `npm run db:migrate`, `npm test`) throughout. Worth noting for Plan 02 verification.

## User Setup Required
None - no external service configuration required for this plan (Frankfurter integration arrives in Plan 02).

## Next Phase Readiness
- The FX cache storage底座 is ready: `fxRate` table + atomic read/write contract is locked for Plan 02's `frankfurter.ts` service (fetch → validate → invert → `upsertRates`) and for Phase 3 USD conversion (FX-02).
- `stale` is intentionally NOT a column — it is computed per-request in Plan 02 (Pattern 3), as planned.

## Self-Check: PASSED

---
*Phase: 02-exchange-rate-layer*
*Completed: 2026-06-28*
