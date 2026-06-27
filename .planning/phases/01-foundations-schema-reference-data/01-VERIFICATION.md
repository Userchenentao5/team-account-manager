---
phase: 01-foundations-schema-reference-data
verified: 2026-06-28T01:00:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification: # No previous VERIFICATION.md — initial verification
---

# Phase 1: Foundations, Schema & Reference Data Verification Report

**Phase Goal:** Stand up the single Next.js + SQLite app with the full data schema locked in — money as integer minor units, FX-snapshot columns (rate_used, rate_as_of, rate_source, amount_usd), structured subscription period ({unit, count}), and FK-based references — and let the user maintain the payment-channel and currency reference data that spaces will later depend on.
**Verified:** 2026-06-28T01:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criteria) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | User can launch the app locally and see a working navigation shell backed by a migrated SQLite database | ✓ VERIFIED | `src/app/layout.tsx` mounts `AppSidebar` inside `SidebarProvider`+`TooltipProvider`; `src/components/nav/sidebar.tsx` renders 仪表盘/空间/参考数据→支付渠道/币种 with `usePathname()` active highlighting; currency RSC reads live SQLite; `data/app.db` exists and migrated; vitest 20/20 green. Visual launch additionally human-approved in Plan 02 Task 3 checkpoint. |
| 2 | User can add, rename, and remove payment channels via stable id-based references; a referenced channel cannot be hard-deleted (soft-deleted/blocked) | ✓ VERIFIED | `src/actions/channels.ts` exports addChannel/renameChannel/archiveChannel/reactivateChannel; `archiveChannel` flips `is_active` only; grep for `db.delete`/`.delete(` across `src/` = 0 matches; tests in `channels.test.ts`/`channels.query.test.ts` prove archive preserves the row + excludes it from active list, reactivate restores, rename keeps surrogate id. Behavior-dependent invariant exercised by passing tests. |
| 3 | User can view the list of supported currencies available for selection | ✓ VERIFIED | `src/app/reference-data/currencies/page.tsx` is an RSC selecting code/name/minor_unit from `currency` via the db singleton; live DB returns 6 rows (CNY,EUR,GBP,HKD,JPY,USD), JPY minor_unit=0. Read-only caption present. |
| 4 | Schema stores money as integer minor units and every space row reserves FX-snapshot + structured-period columns, verified by a passing migration | ✓ VERIFIED | `drizzle/0000_sudden_tony_stark.sql` `CREATE TABLE space` includes amount_minor (integer), period_unit, period_count, rate_used, rate_as_of, rate_source, amount_usd + two FK constraints (payment_channel, currency); `npm run db:migrate` produced `data/app.db`; schema.ts matches. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/db/schema.ts` | currency/payment_channel/space tables + reserved columns | ✓ VERIFIED | All three tables; space has amount_minor, period_unit/count, rate_used/as_of/source, amount_usd; 2 `.references()` FKs |
| `src/db/migrate.ts` | programmatic migrate() runner | ✓ VERIFIED | Opens better-sqlite3, foreign_keys=ON, runs migrate against ./drizzle |
| `src/db/seed.ts` | idempotent 6-currency seed | ✓ VERIFIED | CURRENCY_SEED 6 entries (JPY=0); seedCurrencies uses onConflictDoNothing |
| `src/db/index.ts` | HMR-safe singleton, FK on, Node-only | ✓ VERIFIED | globalThis cache, WAL + foreign_keys=ON, no `runtime='edge'` |
| `src/db/channels.ts` | parameterized channel helpers, no delete | ✓ VERIFIED | list/insert/rename/setActive/findActiveByName; no delete helper |
| `src/actions/channels.ts` | 4 Server Actions, Zod re-parse, revalidatePath | ✓ VERIFIED | All 4 exported, 'use server', safeParse + revalidatePath each |
| `src/lib/money.ts` | exponent-keyed format/parse | ✓ VERIFIED | formatMinor/parseToMinor driven by exponent; JPY (0) path explicit |
| `src/lib/countries.ts` | static COUNTRIES constant | ✓ VERIFIED | 10 ISO-3166 alpha-2 entries incl. US, CN |
| `src/app/reference-data/currencies/page.tsx` | RSC currency list | ✓ VERIFIED | db.select from currency, 3 columns + caption, force-dynamic |
| `src/components/nav/sidebar.tsx` | sidebar nav + active highlight | ✓ VERIFIED | 5 labels/links, usePathname active state |
| `drizzle/0000_*.sql` | committed migration SQL | ✓ VERIFIED | Contains CREATE TABLE for all three tables |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `currencies/page.tsx` | `currency` table | `db.select().from(currency)` | ✓ WIRED |
| `layout.tsx` | `sidebar.tsx` | mounts `<AppSidebar/>` | ✓ WIRED |
| `channels/page.tsx` | `channels.ts`/actions | `listChannels(db, showArchived)`; table invokes actions | ✓ WIRED |
| `channels.ts` actions | `payment_channel` table | parameterized Drizzle mutations + revalidatePath | ✓ WIRED |
| `channel-table.tsx` | actions | imports/calls reactivateChannel/archive/add/rename | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full test suite | `npx vitest run` | 4 files, 20 tests passed | ✓ PASS |
| Currency seed (live DB) | sqlite query | count=6, JPY minor_unit=0, codes CNY,EUR,GBP,HKD,JPY,USD | ✓ PASS |
| No hard-delete path | grep `db.delete`/`.delete(` in src | 0 matches | ✓ PASS |
| Soft-delete invariant | channels.query.test.ts / channels.test.ts | archive preserves row + excludes from active; reactivate restores; rename keeps id | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| REF-01 | 01-03 (also 01-01 schema) | Maintain payment channels; id-based reference; protected delete (soft-delete) | ✓ SATISFIED | Server Actions + soft-delete-only + passing tests; UI screen wired |
| REF-02 | 01-01 (seed), 01-02 (display) | Currency list for space creation | ✓ SATISFIED | 6 seeded currencies + read-only RSC list |

No orphaned requirements: REQUIREMENTS.md maps only REF-01 and REF-02 to Phase 1, both marked Complete.

### Anti-Patterns Found

None. No TBD/FIXME/XXX/PLACEHOLDER/"not yet implemented" markers in modified `src/` files. Placeholder pages (Dashboard/Spaces) are intentional per plan scope (those features land in later phases) and are not stubs of this phase's deliverables.

### Human Verification Required

None outstanding. The two blocking human-verify checkpoints (Plan 02 Task 3 — nav shell + currency list; Plan 03 Task 3 — channel add/rename/archive/reactivate) were both approved during execution per the SUMMARYs, and all underlying behavior is independently confirmed here via code, live DB query, and passing tests.

### Gaps Summary

No gaps. All 4 ROADMAP success criteria are observably achieved in the codebase. The full locked schema is migrated with the reserved FX-snapshot (rate_used/rate_as_of/rate_source/amount_usd) and structured-period (period_unit/period_count) columns plus integer amount_minor on the space table, even though the spaces UI is deferred to Phase 3 — confirmed in both `schema.ts` and the committed migration SQL. The no-hard-delete property for channels is enforced (zero delete calls; soft-delete preserves rows, proven by tests). Both requirement IDs (REF-01, REF-02) are fully accounted for.

---

_Verified: 2026-06-28T01:00:00Z_
_Verifier: Claude (gsd-verifier)_
