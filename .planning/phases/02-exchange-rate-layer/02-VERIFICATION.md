---
phase: 02-exchange-rate-layer
verified: 2026-06-28T01:30:00Z
status: passed
score: 9/14 must-haves verified
behavior_unverified: 5
overrides_applied: 0
human_verification:

  - test: "npm run dev → open http://localhost:3000 → 参考数据 → 汇率. Confirm 6 currency rows (USD=1 plus CNY/EUR/GBP/JPY/HKD as X→USD decimals) and a 汇率截至 <date> label render."
    expected: "6-row table with USD pinned to 1 and a visible as-of label."
    why_human: "Live RSC render depends on a successful runtime Frankfurter fetch; grep verifies the wiring but not the rendered output (cache table is currently empty — 0 rows on disk)."

  - test: "Click 刷新汇率 on the Rates screen."
    expected: "Success toast 汇率已更新 and the 汇率截至 date refreshes to today (D-06)."
    why_human: "Interactive client transition + Server Action + router.refresh round-trip and live network fetch — not statically observable."

  - test: "Stop and restart npm run dev, reopen the Rates screen."
    expected: "Previously fetched rows are still present (on-disk cache persisted)."
    why_human: "Restart persistence requires a populated cache plus a process restart; the on-disk table mechanism is verified but live data survival is runtime."

  - test: "Block egress to api.frankfurter.dev (or point URL at an unreachable host) and click 刷新汇率."
    expected: "Page does NOT crash, cached rows remain, 汇率截至 label still shows, and the 汇率可能已过期 destructive stale banner appears; no row shows 0/NULL (FX-03)."
    why_human: "Requires network manipulation + visual confirmation of the degraded UI state."

  - test: "With an empty cache and a failing fetch, open the Rates screen."
    expected: "Distinct 暂无汇率数据 empty state shows instead of a zero-filled table (Pitfall 5)."
    why_human: "Runtime negative-path UI rendering — visual confirmation needed."
---

# Phase 2: Exchange-Rate Layer Verification Report

**Phase Goal:** Back USD conversion with a local exchange-rate cache fed from the external FX API (Frankfurter) through an anti-corruption service, so rates are available, manually refreshable, and resilient when the API is down — established before any USD-aware space exists to avoid an amount_usd backfill later.
**Verified:** 2026-06-28T01:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | fx_rate stores one row per currency and survives an app restart (on-disk SQLite). | ✓ VERIFIED | `schema.ts` fxRate: `currencyCode` text PRIMARY KEY (one row/currency) + FK → currency.code; `drizzle/0001` committed CREATE TABLE; live `data/app.db` contains the `fx_rate` table (confirmed via better-sqlite3 query). Live-data restart is human-verified (item 3). |
| 2 | Rates stored as X→USD decimal strings; USD itself is the literal "1". | ✓ VERIFIED | `rate_to_usd text NOT NULL` (no float column); `refreshFromApi` pins USD row to `"1"`; test "USD pinned to '1'" passes. |
| 3 | A refresh upsert writes all rows atomically — a partial set is never persisted. | ✓ VERIFIED | `upsertRates` wraps all rows in `db.transaction` + `onConflictDoUpdate`; test "malformed/0/negative → NO write, falls back to cache" passes (DB unchanged). |
| 4 | Valid Frankfurter response validated, inverted USD→X into X→USD, cached stale=false. | ✓ VERIFIED | `frankfurterResponseSchema.parse` → `invertToUsd` → `upsertRates`; test "valid response → inverts ... stale:false" passes. |
| 5 | Fetch failure falls back to last cache, returns stale=true, DB untouched. | ✓ VERIFIED | try/catch → `fallbackToCache()` writes nothing; tests "fetch throws/times out" and "non-ok HTTP status" pass with DB unchanged. |
| 6 | Malformed / 0 / negative rate rejected by Zod — nothing written. | ✓ VERIFIED | `positiveRate = z.number().finite().positive()`; test "malformed/0/negative → Zod rejects, NO write" passes. |
| 7 | Fresh cache (<~1 day) served without re-fetching; empty/old triggers refresh. | ✓ VERIFIED | `ensureFreshRates` age gate (ONE_DAY_MS); 3 tests (fresh-no-fetch, stale-by-age refresh, empty refresh) pass. |
| 8 | Empty cache + failed fetch returns rates:[] without crashing, no fake zeros. | ✓ VERIFIED | `fallbackToCache` returns `stale:false` on empty cache; test "empty cache + failed fetch → rates:[], no crash" passes. |
| 9 | The 汇率 screen is reachable from the 参考数据 section of the sidebar. | ✓ VERIFIED | `sidebar.tsx` referenceChildren includes `{ 汇率, /reference-data/rates, Banknote }`; route file `app/reference-data/rates/page.tsx` exists. |
| 10 | Screen shows a 6-row rate table and a 汇率截至 label whenever a cache exists. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `rate-table.tsx` renders table + always-on `汇率截至` label; wiring present but live render unverified (cache empty on disk). See Human Verification item 1. |
| 11 | Clicking 刷新汇率 triggers live fetch + cache upsert and displayed rates/as-of update. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Button → `refreshRates()` → `router.refresh()` wired; action test passes. Live update is interactive runtime — Human Verification item 2. |
| 12 | Refresh fails + non-empty cache → stale banner shows; as-of still shows. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `showStaleBanner = stale && !isEmpty` renders destructive Alert; runtime visual — Human Verification item 4. |
| 13 | Empty cache + fetch fails → distinct empty state, no fake-zero table, no crash. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `isEmpty` branch renders 暂无汇率数据; runtime visual — Human Verification item 5. |
| 14 | Cached rates persist across an app restart. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | On-disk SQLite + committed migration verified; live-data restart requires populated cache + restart — Human Verification item 3. |

**Score:** 9/14 truths verified (5 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/db/schema.ts` | fxRate table + FxRateRow | ✓ VERIFIED | text PK + FK, rateToUsd/fetchedAt text NOT NULL, no float column |
| `drizzle/0001_charming_rawhide_kid.sql` | additive CREATE TABLE fx_rate | ✓ VERIFIED | committed; creates fx_rate with FK to currency |
| `src/db/fxRates.ts` | listRates/upsertRates/getMostRecentFetchedAt | ✓ VERIFIED | atomic transaction upsert, parameterized builders only |
| `src/db/fxRates.query.test.ts` | green query tests | ✓ VERIFIED | passes (part of 18 green) |
| `src/lib/validation/fx.ts` | frankfurterResponseSchema | ✓ VERIFIED | positive-finite refinement rejects 0/neg/NaN/Inf |
| `src/lib/fx/frankfurter.ts` | refreshFromApi/ensureFreshRates/invertToUsd | ✓ VERIFIED | single fetch site, AbortSignal.timeout, fallback |
| `src/lib/fx/frankfurter.test.ts` | green service tests | ✓ VERIFIED | 11 cases pass |
| `src/actions/fx.ts` | refreshRates Server Action | ✓ VERIFIED | "use server", no client input, revalidatePath |
| `src/actions/fx.test.ts` | green action test | ✓ VERIFIED | passes |
| `src/app/reference-data/rates/page.tsx` | force-dynamic RSC, ensureFreshRates | ✓ VERIFIED | both present |
| `src/components/fx/rate-table.tsx` | refresh button + table + banner/empty | ✓ VERIFIED | all three states wired |
| `src/components/ui/alert.tsx` | shadcn alert | ✓ VERIFIED | file exists (first-party) |
| `src/components/nav/sidebar.tsx` | 汇率 entry | ✓ VERIFIED | Banknote entry → /reference-data/rates |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| frankfurter.ts | api.frankfurter.dev | ONLY fetch() site (anti-corruption) | ✓ WIRED — grep confirms fetch()/URL exist only in frankfurter.ts (test asserts URL) |
| frankfurter.ts | upsertRates | Zod parse before write; invertToUsd guard | ✓ WIRED |
| page.tsx | ensureFreshRates | RSC load (force-dynamic) | ✓ WIRED |
| rate-table | refreshRates → router.refresh | refresh button (D-06) | ✓ WIRED |
| sidebar | /reference-data/rates | referenceChildren entry | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| FX test suite (DB+service+action) | `npx vitest run` on 3 FX files | 3 files / 18 tests passed | ✓ PASS |
| fx_rate table on disk | better-sqlite3 query data/app.db | table present, 0 rows | ✓ PASS (table) / cache empty at rest |
| Anti-corruption boundary | grep fetch/URL across src | only frankfurter.ts | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| FX-01 | 02-01, 02-02, 02-03 | 自动从外部 API 抓取汇率并缓存到本地 | ✓ SATISFIED (service/cache) / human (user-visible) | Service fetch+invert+atomic cache test-locked; screen display deferred to UAT |
| FX-03 | 02-02, 02-03 | API 不可用时降级使用上次缓存并标记陈旧 | ✓ SATISFIED (service) / human (user-visible) | Fallback+stale tests pass; degraded UI banner deferred to UAT |

No orphaned requirements: REQUIREMENTS.md maps only FX-01 and FX-03 to Phase 2, both declared in plan frontmatter. (FX-02 USD conversion is explicitly Phase 3.)

### Anti-Patterns Found

None. No TODO/FIXME/XXX/HACK/PLACEHOLDER markers in any phase-modified FX file. No hollow props, no fake-zero data paths (empty state is explicit, not a zero table).

### Human Verification Required

5 items deferred to end-of-phase UAT (Plan 03 Task 3 `checkpoint:human-verify`, recorded as `status: pending` in 02-03-SUMMARY). All concern user-visible runtime behavior of the Rates screen — the underlying service/DB layer is fully test-verified. See the `human_verification` frontmatter block: (1) live 6-row display + as-of label, (2) manual refresh updates as-of, (3) restart persistence, (4) API-down → cache + stale banner, (5) empty-state on empty-cache+fail.

### Gaps Summary

No blocking gaps. Every code-level and service-level truth is verified with passing automated tests (18/18 green), all artifacts exist and are substantive and wired, the anti-corruption boundary is intact, the migration is committed and applied on disk, and money values are stored as decimal strings (no float). The phase's persistence底座 and fail-safe FX service fully achieve the non-UI portions of the goal and pre-establish the cache before any USD-aware space exists (avoiding a later amount_usd backfill).

The 5 remaining items are user-visible Rates-screen behaviors that grep/static checks cannot confirm and were intentionally deferred to end-of-phase UAT. The cache table is empty at rest (0 rows), which is expected — it populates on the first live fetch. Status is therefore `human_needed`, not `passed`: the screen must be exercised once against FX-01/FX-03 before the phase is closed.

---

_Verified: 2026-06-28T01:30:00Z_
_Verifier: Claude (gsd-verifier)_
