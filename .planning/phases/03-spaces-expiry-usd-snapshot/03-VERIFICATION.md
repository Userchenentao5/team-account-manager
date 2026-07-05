---
phase: 03-spaces-expiry-usd-snapshot
verified: 2026-06-28T10:06:46Z
status: passed
score: 15/15 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps: []
---

# Phase 3: Spaces (Expiry + USD Snapshot) Verification Report

**Phase Goal:** As a team subscription manager, I want to fully manage subscription spaces and each space's mother account with expiry dates and frozen USD cost snapshots computed at payment time, so that I can see which spaces need renewal and understand their normalized USD cost without recomputing historical rates.
**Verified:** 2026-06-28T10:06:46Z
**Status:** passed
**Re-verification:** Yes - rerun after MVP user-story metadata fix

## MVP User Story Guard

| Check | Expected | Evidence | Status |
| --- | --- | --- | --- |
| MVP goal format | `As a ..., I want ..., so that ... .` | `node C:/Users/30952/.codex/gsd-core/bin/gsd-tools.cjs query user-story.validate --story "As a team subscription manager, I want to fully manage subscription spaces and each space's mother account with expiry dates and frozen USD cost snapshots computed at payment time, so that I can see which spaces need renewal and understand their normalized USD cost without recomputing historical rates." --pick valid` returned `true`; ROADMAP Phase 03 is `Mode: mvp`. | PASS |

The canonical MVP process guard now passes. The implementation and UAT evidence below already supported the technical phase goal; this rerun updates the canonical status to `passed`.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Phase 03 MVP goal is strict user-story format. | VERIFIED | `user-story.validate --pick valid` returned `true` for the Phase 03 goal. |
| 2 | User can create a space with country, payment channel, original amount + currency, opening date, subscription period, and one mother account. | VERIFIED | `spaceFormSchema` validates all fields; `SpaceForm` collects them; `createSpace` writes `space` plus `mother_account`; `src/actions/spaces.test.ts` create test passes. |
| 3 | On save, expiry is auto-computed and USD amount is frozen using rate at payment time. | VERIFIED | `createSpace` calls `addPeriod`, `getRate`, and `freezeUsdMinor`, then stores `expiryDate`, `rateUsed`, `rateAsOf`, `rateSource`, and `amountUsd`; integration test asserts stored values. |
| 4 | User can view a space detail page and edit its information. | VERIFIED | `/spaces/[id]` calls `getSpaceDetail`, renders mother account, expiry, original amount, frozen USD, and includes `SpaceDetailActions` edit dialog. |
| 5 | User can view the space list sorted by expiry and filter by country/payment channel. | VERIFIED | `listSpaceDetails` orders by `asc(space.expiryDate)` and filters via Drizzle conditions; `SpaceTable` drives `router.push('/spaces?...')`; DB test asserts sort/filter. |
| 6 | `mother_account` exists in the live schema, 1:1 with `space`, enforced by DB. | VERIFIED | `src/db/schema.ts` exports `motherAccount`; `spaceId` is `notNull().unique().references(... onDelete: 'cascade')`; migration creates table and unique index. |
| 7 | A second `mother_account` row for the same `space_id` is rejected by SQLite. | VERIFIED | `src/db/spaces.query.test.ts` inserts a duplicate `motherAccount` and expects SQLite to throw. |
| 8 | Deleting a space cascades to its mother account row. | VERIFIED | Migration uses `ON DELETE cascade`; DB test deletes `space` and verifies zero matching mother rows. |
| 9 | Expiry date math is calendar-aware for month-end and leap-year cases. | VERIFIED | `addPeriod` uses date-fns `addMonths`/`addQuarters`/`addYears` from local date parts; `src/lib/expiry.test.ts` covers all 9 specified cases. |
| 10 | Expiry status resolves to expired / soon / normal by the 7-day threshold. | VERIFIED | `expiryStatus` uses `differenceInCalendarDays`; tests cover -1, 0, 7, and 8 days. |
| 11 | USD freeze uses exact BigInt math, currency exponent, and round-half-up. | VERIFIED | `freezeUsdMinor` parses decimal-string rates into BigInt scaling; tests cover USD self-rate, JPY exponent 0, rounding, and negative values. |
| 12 | Space plus mother account insert is all-or-nothing in one transaction. | VERIFIED | `insertSpaceWithMother` wraps both inserts in `db.transaction`; joined detail test confirms both rows. |
| 13 | No cached FX rate blocks save without writing `0` or `NULL` USD data. | VERIFIED | `computeSnapshot` returns the no-rate error when `getRate` is absent; integration test asserts `createSpace` returns false and `space` table remains empty. |
| 14 | Edit preserves frozen snapshot for name-only changes and re-freezes when amount/currency changes. | VERIFIED | `updateSpace` computes `shouldRefreeze`; integration tests assert no `ensureFreshRates` call for name-only edit and new JPY snapshot on currency/amount edit. |
| 15 | Human UI walkthrough for create/list/filter/detail/edit passed. | VERIFIED | `03-UAT.md` records 6/6 tests passed, including no-rate block and freeze semantics. |

**Score:** 15/15 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/db/schema.ts` | `motherAccount` table and `MotherAccountRow`; FX/period columns on `space` | VERIFIED | Substantive schema; unique/cascade FK present. |
| `drizzle/0002_simple_the_executioner.sql` | Migration creates `mother_account` with unique `space_id` and cascade FK | VERIFIED | SQL creates table, FK, and `mother_account_space_id_unique`. |
| `src/lib/expiry.ts` | `addPeriod`, `expiryStatus`, `PeriodUnit` | VERIFIED | Uses local date parts and date-fns format; covered by focused tests. |
| `src/lib/money.ts` | `freezeUsdMinor` with existing money helpers | VERIFIED | BigInt scaling; no floating money multiply in freeze path. |
| `src/lib/validation/space.ts` | `spaceFormSchema`, `SpaceFormInput`, `spaceIdSchema` | VERIFIED | Shared client/action schema with whitelisted fields. |
| `src/db/spaces.ts` | Insert/list/detail/update helpers | VERIFIED | Explicit-db helpers, transaction insert, joined reads, filter/sort. |
| `src/db/currencies.ts`, `src/db/fxRates.ts` | Currency exponent and cached-rate reads | VERIFIED | `getCurrencyMinorUnit` and `getRate` used by action pipeline. |
| `src/actions/spaces.ts` | `createSpace`, `updateSpace`, `SpaceActionResult` | VERIFIED | Server-side parse, reference validation, FX snapshot, revalidation. |
| `src/components/spaces/expiry-badge.tsx` | Tri-state badge | VERIFIED | Computes `expiryStatus` at render; labels `已过期`, `即将到期`, `正常`. |
| `src/components/spaces/space-form.tsx` | RHF/Zod create/edit form | VERIFIED | Converts major amount via `parseToMinor`; server errors go to root + toast. |
| `src/components/spaces/space-table.tsx` | List table and URL filters | VERIFIED | Joined rows, detail/edit actions, empty states, numeric money columns. |
| `src/app/spaces/page.tsx` | Force-dynamic list RSC | VERIFIED | Reads `searchParams`, calls `listSpaceDetails`, passes DB-backed channels/currencies. |
| `src/app/spaces/[id]/page.tsx` | Force-dynamic detail RSC | VERIFIED | Uses `getSpaceDetail`; renders mother, expiry, original/frozen amounts, frozen label, edit. |
| `src/**/*spaces*.test.ts`, `expiry.test.ts`, `money.test.ts`, `seed.test.ts` | Behavior coverage | VERIFIED | Focused phase tests passed; full `npm test` passed 11 files / 70 tests. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `mother_account.space_id` | `space.id` | DB FK, `UNIQUE`, `ON DELETE cascade` | WIRED | Schema and migration match; tests prove unique rejection and cascade. |
| Test harness | `drizzle/` migrations | `createTestDb()` migration path | WIRED | DB/action tests run against migrated schema and pass. |
| `createSpace` | FX cache and helpers | `ensureFreshRates` -> `getRate` -> `getCurrencyMinorUnit` -> `freezeUsdMinor` | WIRED | No-rate and create snapshot tests pass. |
| `createSpace` | DB writes | `insertSpaceWithMother` transaction | WIRED | Integration test reads joined detail with mother account and snapshot fields. |
| `updateSpace` | Snapshot semantics | `shouldRefreeze` gate | WIRED | Tests prove preserve vs re-freeze behavior. |
| `/spaces` | Data layer | `listSpaceDetails(db, { country, channelId })` | WIRED | Force-dynamic RSC passes URL filters to DB query. |
| `SpaceTable` filters | `/spaces` RSC | `router.push(buildHref(...))` | WIRED | URL is source of filter state; UAT says filters passed. |
| `/spaces/[id]` | Detail data | `getSpaceDetail(db, id)` | WIRED | Force-dynamic RSC renders joined detail and edit action. |
| `SpaceForm` | Server Actions | `createSpace(values)` / `updateSpace(id, values)` | WIRED | RHF submit converts amount and surfaces action failures inline/toast. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `src/app/spaces/page.tsx` | `spaces` | `listSpaceDetails(db, filters)` joins `space`, `mother_account`, `payment_channel`, `currency` | Yes - DB query, no static data | FLOWING |
| `src/components/spaces/space-table.tsx` | `spaces`, `channels`, `currencies` props | Server RSC passes DB rows from `listSpaceDetails`, `listChannels`, `listCurrencies` | Yes - rendered rows and form options come from DB | FLOWING |
| `src/app/spaces/[id]/page.tsx` | `detail` | `getSpaceDetail(db, numericId)` | Yes - DB join by id, not hardcoded | FLOWING |
| `src/components/spaces/space-form.tsx` | submitted `values` | User input plus DB-backed channel/currency props | Yes - calls Server Actions with converted minor-unit amount | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Expiry and money helper behavior | `npx vitest run src/lib/expiry.test.ts src/lib/money.test.ts src/db/spaces.query.test.ts src/actions/spaces.test.ts src/db/seed.test.ts src/actions/currencies.test.ts` | 6 test files, 41 tests passed | PASS |
| Full workspace tests | `npm test` | 11 test files, 70 tests passed | PASS |
| TypeScript | `npx tsc --noEmit` | Exit 0 | PASS |
| Production build | `npm run build` | Next build succeeded; `/spaces` and `/spaces/[id]` listed as dynamic routes | PASS |
| Lint | `npm run lint` | Exit 0 | PASS |

### Probe Execution

| Probe | Command | Result | Status |
| --- | --- | --- | --- |
| Conventional probes | `Get-ChildItem scripts -Recurse -Filter 'probe-*.sh'` | No `scripts/` probes found | SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| SPACE-01 | 03-04, 03-05 | Create space with country, payment channel, original amount/currency, opening date, period | SATISFIED | `SpaceForm`, `spaceFormSchema`, `createSpace`; integration and UAT create tests pass. |
| SPACE-02 | 03-03, 03-05 | List sorted by expiry, filter by country/payment channel | SATISFIED | `listSpaceDetails`/`listSpaces` order by expiry and filter; URL filters; DB test and UAT pass. |
| SPACE-03 | 03-03, 03-05 | Detail shows mother account, child placeholder, expiry, USD amount | SATISFIED | `/spaces/[id]` renders mother, expiry badge, original/frozen amounts, child-account placeholder; UAT pass. |
| SPACE-04 | 03-04, 03-05 | Edit space information | SATISFIED | `updateSpace` and edit dialogs; integration tests for snapshot semantics; UAT edit pass. |
| ACCT-01 | 03-01, 03-03, 03-04 | One mother account per space | SATISFIED | DB unique FK, transaction insert, duplicate rejection test, joined detail. |
| EXP-01 | 03-02, 03-04 | Auto-compute calendar-aware expiry | SATISFIED | `addPeriod` tests for month-end/leap cases; `createSpace` stores computed `expiryDate`. |
| FX-02 | 03-02, 03-04 | Freeze USD amount with rate snapshot on payment record | SATISFIED | `freezeUsdMinor`; `createSpace`/`updateSpace` store `rateUsed`, `rateAsOf`, `rateSource`, `amountUsd`; tests pass. |

No additional Phase 03 requirements in `.planning/REQUIREMENTS.md` were orphaned. `SPACE-05`, `ACCT-02`, and `ACCT-03` are explicitly Phase 4, and dashboard requirements are Phase 5.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `src/actions/spaces.ts` | 55 | `return null` | INFO | Intentional sentinel from `validateReferences`; not an empty implementation. |
| `src/db/seed.ts` | 24 | `console.log("seeded currencies")` | INFO | Direct CLI output only, guarded by direct-invocation check. |
| `src/components/spaces/space-form.tsx`, `space-table.tsx` | various | `placeholder=` UI attributes | INFO | Normal input/select placeholders, not implementation placeholders. |

No blocker debt markers (`TBD`, `FIXME`, `XXX`) were found in Phase 03 code paths.

### Human Verification Required

None. `03-UAT.md` records all six human UI checks as passed: list, create, no-rate block, filters, detail page, and edit freeze semantics.

### Gaps Summary

None. The implementation satisfies the Phase 03 technical success criteria and the listed requirements with passing tests, build, lint, completed UAT, and a valid MVP user-story goal.

---

_Verified: 2026-06-28T10:06:46Z_
_Verifier: the agent (gsd-verifier)_
