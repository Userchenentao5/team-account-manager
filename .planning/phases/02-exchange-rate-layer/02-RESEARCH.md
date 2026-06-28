# Phase 2: Exchange-Rate Layer - Research

**Researched:** 2026-06-28
**Domain:** External FX API integration + local cache (anti-corruption layer) in Next.js 16 + Drizzle + SQLite
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Store **one row per currency** in `fx_rate` (`currency_code`, `rate_to_usd`, `fetched_at`). A refresh **upserts** all rows. Phase 3 reads a single row by currency code — no JSON parsing, no "latest" query logic. (History/snapshot-blob models rejected.)
- **D-02:** Each row stores **X→USD** (units of USD per 1 unit of the currency) as a **decimal string** (never float — locked project decision). Phase 3 conversion is a plain multiply: `amount_usd = amount × rate_to_usd`, no division at the use-site.
- **D-03:** Frankfurter returns `base=USD` → USD→X rates. The anti-corruption service **inverts** each to X→USD on write. **USD itself is stored as `1.0`.** Only the 6 seeded currencies (USD, CNY, EUR, GBP, JPY, HKD) are cached.
- **D-04:** Rates are flagged **stale only when a refresh attempt fails** and the app falls back to last-cached rates. A fresh cache from a successful fetch is **never** flagged stale, regardless of age.
- **D-05:** The **"rates as of `<date>`"** label (sourced from `fetched_at`) **always displays**, stale or not.
- **D-06:** Manual **"refresh rates" button is always available** (locked by CLAUDE.md). Triggers a live fetch + cache upsert and surfaces the new "as of" date (or the stale flag on failure).
- **D-07:** **Lazy auto-refresh by cache age:** when a rates-consuming view loads, if the cache is **empty or older than ~1 day**, fire a refresh; otherwise serve cache as-is. (Refresh-on-every-load and manual-only rejected.) Cache **age** governs *whether to refresh* (D-07); it does **not** drive the *stale flag* (D-04) — deliberately decoupled.
- **D-08:** This phase the lazy trigger fires on the **Rates screen** load (dashboard empty until Phase 5).
- **D-09:** The lazy refresh is **blocking with a short timeout** (~3–5s, Claude's discretion): runs server-side during the view's data-load, but a hung/slow API must **degrade to cache + stale flag** rather than block the page. Never writes `0`/`NULL` rates on failure.
- **D-10:** Fallback chain is **Frankfurter primary → last-cached rates** only. `open.er-api.com` secondary live source is **deferred**.
- **D-11:** Rates live on a new **Reference Data → Rates screen**: 6-row rate table, "rates as of `<date>`", stale flag/banner, manual refresh button.

### Claude's Discretion
- Exact `fx_rate` column names/types beyond the locked decimal-string rate and `fetched_at` semantics.
- The blocking-refresh timeout value (~3–5s) and how it falls back to cache.
- Zod schema shape for validating the Frankfurter response; service file organization (mirror existing `src/db/*.ts` + Server Action patterns).
- Whether refresh is a Server Action, a Route Handler (`/api/fx/refresh`), or both.
- Stale-flag UI treatment (badge vs banner) and the Rates screen's exact layout, reusing shadcn/ui table patterns.

### Deferred Ideas (OUT OF SCOPE)
- `open.er-api.com` secondary live fallback.
- Age-based stale flag / staleness threshold (flag is failure-only this phase).
- Rate history / audit trail.
- External scheduled refresh job hitting `/api/fx/refresh`.
- Dashboard rates indicator (Phase 5).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FX-01 | 系统自动从外部汇率 API 抓取汇率并缓存到本地 (auto-fetch from external FX API + cache locally) | Frankfurter `/v1/latest?base=USD&symbols=...` verified live (Standard Stack + Code Examples); `fx_rate` Drizzle table + upsert query module mirrors `src/db/channels.ts`; lazy + manual refresh triggers (Architecture Patterns). |
| FX-03 | 汇率 API 不可用时降级使用上次缓存汇率,并标记数据陈旧 (API-down → fall back to last cached + flag stale) | `AbortSignal.timeout` + try/catch fallback returning `{ rates, fetchedAt, stale: true }` from cache; never write 0/NULL (Pitfalls 1, 3, 5). |
</phase_requirements>

## Summary

This phase builds a thin vertical slice: a **Rates screen** (Reference Data) whose RSC reads 6 cached rates from a new `fx_rate` SQLite table, with a manual refresh button (Server Action) and a server-side lazy refresh on load. Behind both triggers sits a single **anti-corruption FX service** that is the *only* code path that talks to Frankfurter: it fetches `GET https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY,EUR,GBP,JPY,HKD`, validates the response with Zod, **inverts** each USD→X rate to X→USD (storing USD itself as `1.0`), and upserts all rows. Everything the rest of the app ever sees is the cache.

The phase needs **zero new dependencies** — `zod`, `drizzle-orm`, `better-sqlite3`, `date-fns`, `lucide-react`, and `shadcn/ui` are all already installed and pinned (verified in `package.json`). `fetch` and `AbortSignal.timeout` are built into the Node runtime. The work is: one schema addition + migration, one query module (+ tests), one validated service (+ tests), one Server Action (+ tests), and one RSC page with a small client refresh component — each mirroring an existing Phase 1 file almost 1:1.

The three load-bearing correctness concerns are: (1) **rate inversion** — Frankfurter gives X-per-USD, the cache stores USD-per-X as a decimal string, which is a division producing non-terminating decimals (precision matters); (2) **staleness is a request-scoped computed flag, NOT a DB column** — it is true only when *this request* attempted a refresh, that attempt failed, and we served old cache (D-04); and (3) **never writing 0/NULL/partial rates** on any failure (Success Criterion 3) — validate-then-upsert atomically, and on any error keep the existing cache untouched.

**Primary recommendation:** Add `fx_rate` to `schema.ts`; build `src/db/fxRates.ts` (query module), `src/lib/validation/fx.ts` (Zod), `src/lib/fx/frankfurter.ts` (fetch+validate+invert service that returns `{ rates, fetchedAt, stale }`), `src/actions/fx.ts` (`refreshRates` Server Action), and `src/app/reference-data/rates/page.tsx` (RSC) + `rate-table.tsx` (client refresh button). Use `AbortSignal.timeout(4000)` and wrap all network/validation in try/catch that falls back to cache and sets `stale: true`. Add `参考数据 → 汇率` to `src/components/nav/sidebar.tsx`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch rates from Frankfurter | API / Backend (Node) | — | better-sqlite3 forces Node runtime; outbound HTTP must not be on Edge. The service is the single integration surface. |
| Validate external response (Zod anti-corruption) | API / Backend | — | Untrusted external input must be validated server-side before it touches the cache (ASVS V5). |
| Invert USD→X to X→USD, store `1.0` for USD | API / Backend | — | Direction normalization (D-02/D-03) belongs at the write boundary so the rest of the app reads a uniform shape. |
| Persist / upsert cached rates | Database / Storage (SQLite) | — | SQLite *is* the cache (CLAUDE.md: no Redis). Persistence across restarts = Success Criterion 1. |
| Decide whether to lazy-refresh (cache age) | API / Backend | Frontend Server (RSC triggers it) | Age check + conditional fetch runs during the RSC data load (D-07/D-09). |
| Read cached rates for display | Frontend Server (RSC) | Database | RSC queries SQLite directly server-side (CLAUDE.md read pattern). |
| Manual "refresh" trigger | Client (button) | API / Backend (Server Action) | Mirrors channel write pattern: client `useTransition` → Server Action → revalidate. |
| Render rates table + "as of" + stale flag | Frontend Server (RSC) | Client (interactive button only) | Read-heavy view is server-rendered; only the button needs `"use client"`. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Frankfurter API | v1 (`api.frankfurter.dev`) | External daily FX rates, `base=USD` | `[VERIFIED: api.frankfurter.dev/v1/latest live response]` Free, no API key, no quotas, ECB-style ~daily. Project-locked in CLAUDE.md. |
| drizzle-orm | 0.45.2 (installed) | `fx_rate` schema + upsert/select | `[VERIFIED: package.json]` Same ORM Phase 1 uses; `onConflictDoUpdate` provides upsert. |
| better-sqlite3 | 12.11.1 (installed) | Synchronous embedded DB = the cache | `[VERIFIED: package.json]` Persists across restarts (WAL file on disk). Node runtime only. |
| zod | 4.4.3 (installed) | Validate Frankfurter response (anti-corruption) | `[VERIFIED: package.json]` CLAUDE.md mandates Zod at API boundaries, not just forms. |
| Node global `fetch` + `AbortSignal.timeout` | Node 25.5.0 runtime | HTTP call with timeout | `[VERIFIED: Node 18+ built-in]` No HTTP client dependency needed. `AbortSignal.timeout(ms)` gives the D-09 blocking-with-timeout behavior. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.4.0 (installed) | Cache-age comparison for lazy refresh (D-07) | `differenceInHours` / `isBefore(subHours(new Date(), 24))` against `fetched_at`. |
| lucide-react | 1.21.0 (installed) | Icons: `RefreshCw` (button), `TriangleAlert` (stale banner), `Coins` (nav) | UI affordances. |
| shadcn/ui Table / Badge / Button | installed (`src/components/ui/*`) | Rates table, stale badge/banner, refresh button | Reuse exact components from the channels/currencies screens. |
| sonner (toast) | 2.0.7 (installed) | Refresh success/failure feedback | Mirror `channel-table.tsx` toast usage. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Frankfurter `/v1/latest` | Frankfurter `/v2/rates?quotes=...` | v2 is the newer surface advertised on the docs homepage, but the **v1 response shape `{amount,base,date,rates}` was verified live** and is what the Zod schema is built against. Keep v1 for a single confirmed contract. `[VERIFIED: both hosts resolve on api.frankfurter.dev]` |
| Server Action for refresh | Route Handler `/api/fx/refresh` | A Route Handler is needed *only* for the deferred external scheduler. MVP uses a Server Action (matches the channel write pattern exactly). Optionally add a thin Route Handler that calls the same service — but it is not required this phase. |
| Native `fetch` | `axios` / `ky` | Unnecessary dependency; native fetch + `AbortSignal.timeout` covers everything. Do not add. |

**Installation:**
```bash
# No new packages. All dependencies already installed and pinned in package.json.
# After adding the fx_rate table to schema.ts:
pnpm db:generate    # drizzle-kit generate → emits drizzle/0001_*.sql (commit it)
pnpm db:migrate     # tsx src/db/migrate.ts → applies to ./data/app.db
```

**Version verification:** All packages confirmed present in `D:\projects\team-account-manager\package.json` `[VERIFIED: package.json]`: drizzle-orm ^0.45.2, better-sqlite3 ^12.11.1, zod ^4.4.3, date-fns ^4.4.0, lucide-react ^1.21.0, next 16.2.9, react 19.2.4. No registry lookup needed — nothing new is being installed.

## Package Legitimacy Audit

**No external packages are installed this phase.** Every library used (drizzle-orm, better-sqlite3, zod, date-fns, lucide-react, shadcn/ui components, sonner) was vetted and installed in Phase 1 and is already pinned in `package.json`. `fetch`/`AbortSignal` are Node built-ins. The only external *runtime* dependency is the Frankfurter HTTP API, which is project-locked in CLAUDE.md and verified live (no key, no quota).

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
  User clicks "刷新汇率" ──▶│  rate-table.tsx  ("use client")             │
                          │  useTransition → calls Server Action         │
                          └───────────────┬─────────────────────────────┘
                                          │ refreshRates()
                                          ▼
  Rates screen load ──────▶┌──────────────────────────────────────────────┐
  (RSC, force-dynamic)     │  src/actions/fx.ts  ("use server")            │
        │                  │  + RSC calls ensureFreshRates() on load       │
        │                  └───────────────┬──────────────────────────────┘
        │                                  │ both routes funnel here
        │                                  ▼
        │            ┌───────────────────────────────────────────────────────┐
        │            │  src/lib/fx/frankfurter.ts  — ANTI-CORRUPTION SERVICE   │
        │            │  (the ONLY code that talks to Frankfurter)              │
        │            │                                                         │
        │            │  1. cache age check (date-fns) ─ fresh? ──┐ serve cache │
        │            │  2. fetch(timeout 4s) ──────┐             │             │
        │            │  3. Zod validate response   │  on error ──┼──▶ FALLBACK │
        │            │  4. invert USD→X to X→USD    │             │   cache +   │
        │            │  5. upsert all 6 rows        │             │   stale:true│
        │            └──────────┬──────────────────┘             │             │
        │                       │ success                        │             │
        │                       ▼                                ▼             │
        │            ┌──────────────────────┐         ┌──────────────────────┐│
        │            │ external: Frankfurter │         │  (no network)        ││
        │            │ /v1/latest?base=USD   │         └──────────────────────┘│
        │            └──────────────────────┘                                  │
        │                       │                                              │
        │                       ▼ upsert / read                               │
        │            ┌───────────────────────────────────────────────────────┘
        │            │  src/db/fxRates.ts  (Drizzle query module)
        │            │  upsertRates() · listRates() · getMostRecentFetchedAt()
        │            └───────────────┬───────────────────────────────────────
        │                            ▼
        │            ┌──────────────────────────────────────┐
        │            │  SQLite  fx_rate table (the cache)     │
        │            │  persists across restarts (WAL on disk)│
        └───────────▶└──────────────────────────────────────┘
                                     │ select 6 rows + fetched_at
                                     ▼
                     RSC renders table + "rates as of <date>" + stale banner
```

The service returns `{ rates: FxRateRow[], fetchedAt: string | null, stale: boolean }`. `stale` is computed per request (see Pattern 3), never stored.

### Recommended Project Structure
```
src/
├── db/
│   ├── schema.ts          # ADD fx_rate table here
│   └── fxRates.ts         # NEW: upsertRates / listRates / getMostRecentFetchedAt (mirror channels.ts)
├── lib/
│   ├── validation/
│   │   └── fx.ts          # NEW: Zod schema for Frankfurter response (mirror validation/channel.ts)
│   └── fx/
│       └── frankfurter.ts # NEW: anti-corruption service (fetch+validate+invert+fallback)
├── actions/
│   └── fx.ts              # NEW: refreshRates Server Action (mirror actions/channels.ts)
├── app/reference-data/rates/
│   └── page.tsx           # NEW: RSC — ensureFreshRates() then render (mirror currencies/page.tsx)
└── components/
    ├── fx/
    │   └── rate-table.tsx # NEW: "use client" — refresh button + table (mirror channel-table.tsx)
    └── nav/
        └── sidebar.tsx    # EDIT: add 汇率 child under 参考数据
drizzle/
└── 0001_*.sql             # NEW generated migration (commit it — Phase 1 decision)
```

### Pattern 1: Anti-corruption fetch → validate → invert → upsert
**What:** One service owns the entire Frankfurter boundary. Nothing else imports `fetch` or knows the external shape.
**When to use:** Both the Server Action and the RSC lazy-refresh call this single function.
```typescript
// Source: pattern derived from CLAUDE.md "anti-corruption service" + verified Frankfurter response
// src/lib/fx/frankfurter.ts
import { db } from "@/db";
import { listRates, upsertRates, getMostRecentFetchedAt } from "@/db/fxRates";
import { frankfurterResponseSchema } from "@/lib/validation/fx";
import { CURRENCY_SEED } from "@/db/seed";

const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest";
const SYMBOLS = CURRENCY_SEED.map((c) => c.code).filter((c) => c !== "USD"); // 5 non-USD symbols
const TIMEOUT_MS = 4000; // D-09 discretion (~3-5s)

export type FxResult = {
  rates: { currencyCode: string; rateToUsd: string; fetchedAt: string }[];
  fetchedAt: string | null;
  stale: boolean;
};

// Always attempts a refresh; used by the manual button.
export async function refreshFromApi(): Promise<FxResult> {
  try {
    const url = `${FRANKFURTER_URL}?base=USD&symbols=${SYMBOLS.join(",")}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) throw new Error(`Frankfurter ${res.status}`);
    const json = await res.json();
    const data = frankfurterResponseSchema.parse(json); // throws on malformed → caught below

    const fetchedAt = new Date().toISOString();
    const rows = [
      { currencyCode: "USD", rateToUsd: "1", fetchedAt },           // D-03: USD stored as 1.0
      ...Object.entries(data.rates).map(([code, usdToX]) => ({
        currencyCode: code,
        rateToUsd: invertToUsd(usdToX), // D-02/D-03: X→USD decimal string
        fetchedAt,
      })),
    ];
    upsertRates(db, rows); // atomic upsert of all rows (Pattern 2)
    return { rates: listRates(db), fetchedAt, stale: false }; // D-04: fresh fetch never stale
  } catch {
    // FX-03 / Success Criterion 3: fall back to cache, flag stale, NEVER write 0/NULL.
    const cached = listRates(db);
    return { rates: cached, fetchedAt: getMostRecentFetchedAt(db), stale: cached.length > 0 };
  }
}

// Lazy refresh used by the RSC: only fetch if cache empty or older than ~1 day (D-07).
export async function ensureFreshRates(): Promise<FxResult> {
  const fetchedAt = getMostRecentFetchedAt(db);
  const isFresh =
    fetchedAt != null &&
    new Date(fetchedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000; // ~1 day
  if (isFresh) {
    return { rates: listRates(db), fetchedAt, stale: false }; // D-04 + D-07 decoupled: fresh, no refresh
  }
  return refreshFromApi(); // empty or stale-by-age → attempt refresh (may itself fall back)
}
```

### Pattern 2: Inversion + atomic upsert (decimal-string money math)
**What:** Convert X-per-USD to USD-per-X at a fixed precision and upsert all 6 rows in one transaction so the cache is never partially written.
```typescript
// Source: D-02/D-03 + better-sqlite3 synchronous transaction
import Decimal from "...";   // OPTIONAL — see Pitfall 2; or use Number with toPrecision
import { fxRate } from "@/db/schema";

// 1 USD = `usdToX` units of X  →  1 X = (1 / usdToX) USD. Fixed significant digits.
function invertToUsd(usdToX: number): string {
  if (!Number.isFinite(usdToX) || usdToX <= 0) throw new Error("bad rate"); // never 0/NULL
  return (1 / usdToX).toPrecision(12).replace(/\.?0+$/, ""); // decimal string, trimmed
}

export function upsertRates(db: Db, rows: FxRateInsert[]): void {
  db.transaction(() => {                       // all-or-nothing (better-sqlite3 sync tx)
    for (const r of rows) {
      db.insert(fxRate).values(r)
        .onConflictDoUpdate({ target: fxRate.currencyCode, set: { rateToUsd: r.rateToUsd, fetchedAt: r.fetchedAt } })
        .run();
    }
  })();
}
```

### Pattern 3: Staleness is a per-request computed flag, NOT a column
**What:** `stale` is true only when *this request* tried to refresh, failed, and served old cache (D-04). A fresh cache served without a refresh attempt is `stale: false` regardless of age.
**When to use:** Returned by the service; the RSC/banner reads it. Do **not** add an `is_stale` column to `fx_rate`.
```typescript
// In the page (RSC):
const { rates, fetchedAt, stale } = await ensureFreshRates();
// stale === true  → render the warning banner; "rates as of <fetchedAt>" still shows (D-05)
// stale === false → no banner, even if fetchedAt is days old (D-04/D-07 decoupled)
```

### Pattern 4: RSC + client refresh button (mirror channels)
**What:** Server Component reads & renders; a small `"use client"` component holds the refresh button using `useTransition` + Server Action + `router.refresh()` (exactly like `channel-table.tsx`).
```typescript
// src/app/reference-data/rates/page.tsx  (RSC)
export const dynamic = "force-dynamic"; // native module → Node runtime, no static caching
export default async function RatesPage() {
  const { rates, fetchedAt, stale } = await ensureFreshRates();
  return <RateTable rates={rates} fetchedAt={fetchedAt} stale={stale} />;
}
// src/components/fx/rate-table.tsx  ("use client")
// button onClick → startTransition(async () => { const r = await refreshRates(); ... toast }); router.refresh()
```

### Anti-Patterns to Avoid
- **`is_stale` column in `fx_rate`:** Staleness is request-scoped (D-04). A column would drift and contradict "fresh cache never stale."
- **Calling Frankfurter from more than one place:** Breaks the anti-corruption boundary. Only `frankfurter.ts` may `fetch`.
- **`runtime = "edge"` on the page/action/route:** better-sqlite3 is a native module — Edge will crash. Keep everything Node (RSC uses `force-dynamic`; see `src/db/index.ts` comment).
- **Floating-point storage of rates:** Locked-out by CLAUDE.md. Rates are decimal strings; inversion result is stringified at fixed precision.
- **Partial / 0 / NULL writes on failure:** Validate the *whole* response, then upsert all rows in one transaction; on any throw, leave the cache untouched.
- **Storing rates as USD→X (Frankfurter's native direction):** Forces a divide at every Phase 3 use-site. Invert once on write (D-02).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP timeout / cancellation | Manual `setTimeout` + flag races | `fetch(url, { signal: AbortSignal.timeout(4000) })` | Built-in, race-free, throws `TimeoutError` caught by the same try/catch. |
| External-response trust | Hand-checking `typeof json.rates.CNY === "number"` | Zod schema in `lib/validation/fx.ts` | One declarative schema validates shape + positivity; consistent with channel validation pattern. |
| Upsert "insert or update" | `SELECT` then branch to insert/update | Drizzle `.onConflictDoUpdate({ target: fxRate.currencyCode })` | Atomic, fewer round-trips, no race. |
| Date/age math | Manual ms arithmetic everywhere | `date-fns` (already installed) for the age comparison | Calendar-correct, readable; project already standardized on it. |
| Test DB | Bespoke mocks | `createTestDb()` in `src/test/db-harness.ts` | In-memory SQLite + auto-applied migrations already proven in Phase 1. |

**Key insight:** This phase is almost entirely *composition of existing, installed primitives*. The only genuinely new logic is rate inversion and the stale-vs-fresh decision tree — both small, both heavily test-worthy.

## Common Pitfalls

### Pitfall 1: Writing 0/NULL/partial rates on a failed or malformed fetch
**What goes wrong:** A timeout, 5xx, or malformed JSON leads to `rateToUsd` being `0`, `NaN`, `"undefined"`, or only some of the 6 rows updated — silently poisoning Phase 3's USD math.
**Why it happens:** Upserting inside the per-currency loop *before* validating the whole response; or treating a network error as "empty rates."
**How to avoid:** Validate the entire response with Zod first; build all rows; upsert in one `db.transaction`. On any throw, fall through to the cache-fallback branch and write nothing. Reject non-positive/non-finite rates in the Zod schema and in `invertToUsd`.
**Warning signs:** A test that mocks a 500 still mutates the DB; a row with `rate_to_usd = "0"` or `"NaN"`.

### Pitfall 2: Inversion precision loss
**What goes wrong:** `1 / 161.65` for JPY is non-terminating; naive `String(1/x)` yields full float noise (`"0.006186205382616..."`) or, worse, rounding that compounds in Phase 3 totals.
**Why it happens:** Division always risks irrational/long decimals; floats can't represent them exactly.
**How to avoid:** Fix the stored precision deliberately — e.g. `(1/usdToX).toPrecision(12)` then trim trailing zeros, stored as a string. 12 significant figures is ample for 6-currency USD sums. (A decimal library is optional; `toPrecision` on the single division at write-time is acceptable since the value is then a string and Phase 3 multiplies, not divides.) Decide and document the precision in the plan.
**Warning signs:** Differing USD totals across runs; rates with 15+ digits; a JPY rate stored as `"0"`.

### Pitfall 3: Edge runtime crash from better-sqlite3
**What goes wrong:** Page/action/route fails at runtime with a native-module load error.
**Why it happens:** Marking a DB-touching module `runtime = "edge"`, or Next statically optimizing the RSC.
**How to avoid:** Keep `export const dynamic = "force-dynamic"` on the Rates page (matches `currencies/page.tsx`); never set Edge on `actions/fx.ts` or any `/api/fx/*` route. The `src/db/index.ts` header already documents this.
**Warning signs:** "Module did not self-register" / native binding errors in the route.

### Pitfall 4: `fetched_at` semantics confusing the "as of" label vs the refresh-age decision
**What goes wrong:** Using the Frankfurter publication `date` for the refresh-age check makes the app re-fetch on every load over a weekend (publication date is "yesterday" but you just fetched); or using wall-clock fetch time for the "as of" label slightly misrepresents which day the rates are from.
**Why it happens:** Two distinct timestamps — *when we fetched* (wall clock, drives D-07 age) vs *what day the rates are for* (Frankfurter `date`, the true "as of").
**How to avoid:** Store `fetched_at` = wall-clock ISO of the successful fetch (drives both D-07 age and the D-05 label, per the locked decision). **Optionally** also store the Frankfurter publication `date` in a `rate_date` column and prefer it for the displayed "rates as of" label — cleaner UX, still satisfies D-05. Flag this choice in the plan (see Assumptions A1).
**Warning signs:** Re-fetching on every page load; "as of" showing a future-looking timestamp.

### Pitfall 5: First-run empty cache + API down
**What goes wrong:** No cache exists yet and the very first fetch fails → page must not crash and must not show a fake "0" table.
**Why it happens:** Fallback code assumes a cache row always exists.
**How to avoid:** `refreshFromApi` returns `{ rates: [], fetchedAt: null, stale: false }` (or `stale:true` with an explicit empty-state message) when the cache is empty and the fetch failed. The RSC renders an empty state + error banner, never throws (Success Criterion 3: "never failing the page"). Decide whether empty+failed shows the stale banner or a distinct "couldn't load rates yet" message.
**Warning signs:** Unhandled rejection rendering the page; a table of 6 rows all showing 0.

### Pitfall 6: Server Action input/trust
**What goes wrong:** `refreshRates` is a public endpoint; though it takes no user input, the *response from Frankfurter* is the untrusted input.
**Why it happens:** Treating an outbound API as trusted.
**How to avoid:** The Zod validation IS the trust boundary here (ASVS V5). No client-supplied data flows into the DB; the only external data is the API body, which is validated. Mirror the "re-parse server-side" discipline from `actions/channels.ts`.

## Code Examples

### Frankfurter response (verified live)
```jsonc
// Source: GET https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY,EUR,GBP,JPY,HKD  [VERIFIED 2026-06-28]
{
  "amount": 1.0,
  "base": "USD",
  "date": "2026-06-26",                 // YYYY-MM-DD, ECB last-working-day publication
  "rates": { "CNY": 6.7982, "EUR": 0.87712, "GBP": 0.75654, "HKD": 7.8421, "JPY": 161.65 }
}
// USD is the base and is NOT echoed inside `rates` — the service injects USD = "1" itself (D-03).
```

### Zod schema for the response (anti-corruption boundary)
```typescript
// Source: pattern from src/lib/validation/channel.ts + verified response shape
// src/lib/validation/fx.ts
import { z } from "zod";

const positiveRate = z.number().finite().positive(); // rejects 0, negative, NaN, Infinity

export const frankfurterResponseSchema = z.object({
  amount: z.literal(1).or(z.number().positive()),
  base: z.literal("USD"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rates: z.record(z.string().length(3), positiveRate), // {CNY:..,EUR:..,...}
});
export type FrankfurterResponse = z.infer<typeof frankfurterResponseSchema>;
```

### `fx_rate` schema addition
```typescript
// Source: mirror of currency/paymentChannel in src/db/schema.ts
// add to src/db/schema.ts
export const fxRate = sqliteTable("fx_rate", {
  currencyCode: text("currency_code")
    .primaryKey()
    .references(() => currency.code),   // one row per currency (D-01), FK to seeded list
  rateToUsd: text("rate_to_usd").notNull(),   // X→USD decimal STRING, never float (D-02)
  fetchedAt: text("fetched_at").notNull(),    // ISO wall-clock of successful fetch (D-05/D-07)
  // OPTIONAL (Pitfall 4 / A1): rateDate: text("rate_date"),  // Frankfurter publication date
});
export type FxRateRow = typeof fxRate.$inferSelect;
```

### Query module (mirror of channels.ts)
```typescript
// src/db/fxRates.ts
import { desc } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { fxRate } from "./schema";
type Db = BetterSQLite3Database<Record<string, unknown>>;

export function listRates(db: Db) {
  return db.select().from(fxRate).orderBy(fxRate.currencyCode).all();
}
export function getMostRecentFetchedAt(db: Db): string | null {
  const row = db.select({ fetchedAt: fxRate.fetchedAt }).from(fxRate)
    .orderBy(desc(fxRate.fetchedAt)).limit(1).get();
  return row?.fetchedAt ?? null;
}
// upsertRates: see Pattern 2 (transaction + onConflictDoUpdate)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `api.frankfurter.app` host | `api.frankfurter.dev` host | Frankfurter v2 era | Use `api.frankfurter.dev`. `[VERIFIED: docs homepage + live v1 call resolve on .dev]` |
| Manual `AbortController` + `setTimeout` | `AbortSignal.timeout(ms)` | Node 18+ | One-liner timeout; throws `TimeoutError`. |
| Client-side data fetching (`useEffect`) | RSC reads SQLite directly server-side | Next App Router | No client fetch layer for the read path (CLAUDE.md). |

**Deprecated/outdated:**
- `api.frankfurter.app` references in older tutorials — prefer `.dev`.
- Hardcoded `×100` money math — JPY (minorUnit 0) would break; use `formatMinor`/exponent (Phase 1's `src/lib/money.ts`). Not directly needed this phase (rates are strings) but relevant when Phase 3 consumes the cache.

## Runtime State Inventory

This is a greenfield additive phase (new table + new files), not a rename/refactor — no existing stored data, service config, OS registration, secrets, or build artifacts reference anything being renamed. The one stateful concern is **the new SQLite WAL/db file persisting across restarts** (Success Criterion 1), which is inherent to better-sqlite3 on disk and already wired in `src/db/index.ts`. **No migration of existing data is required** (the `fx_rate` table is brand new; `space` FX-snapshot columns stay untouched until Phase 3).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Storing wall-clock `fetched_at` (not Frankfurter publication `date`) for the "rates as of" label honors D-05; an optional `rate_date` column is the better UX | Pitfall 4 / schema | LOW — label shows fetch time vs publication day; cosmetic. Plan should pick one explicitly. `[ASSUMED]` |
| A2 | 12 significant figures (`toPrecision(12)`) is sufficient precision for the inverted X→USD rate | Pitfall 2 / Pattern 2 | LOW–MED — too few digits could cause cent-level rounding in large Phase 3 USD sums; 12 sig-figs is generous for these currencies. `[ASSUMED]` |
| A3 | A 4s timeout (within the D-09 ~3–5s range) is the right blocking budget for the lazy refresh | User Constraints D-09 | LOW — explicitly Claude's discretion; tune if Frankfurter is slow. `[ASSUMED]` |
| A4 | The v1 `/v1/latest` endpoint (verified) remains stable; v2 `/v2/rates` is not required this phase | Standard Stack | LOW — v1 verified live today; if v1 is ever retired, swap the URL + Zod schema (`quotes` param, possibly different shape). `[ASSUMED]` (v2 shape not verified) |
| A5 | Manual refresh is a Server Action only (no Route Handler) for MVP | Architecture / D | LOW — deferred external scheduler would later need a thin Route Handler calling the same service. `[ASSUMED]` |

**If empty:** Not empty — five low-risk assumptions, all within explicitly-granted discretion areas. Confirm A1 and A2 during planning/discussion as they touch displayed data and money precision.

## Open Questions (RESOLVED)

*All three resolved during plan-phase and encoded in PLAN 02-02 / 02-03 (2026-06-28).*

1. **"Rates as of" = fetch time or publication date?** (A1)
   - What we know: D-05 locks the label to `fetched_at`. Frankfurter also returns a publication `date`.
   - What's unclear: whether to surface the truer publication date.
   - Recommendation: store `fetched_at` (wall clock) per D-05; optionally add `rate_date` and display it. Pick in planning.
   - **RESOLVED:** display `fetched_at` per D-05; `rate_date` left optional under explicitly-granted Claude's Discretion (not required this phase).

2. **Inverted-rate precision.** (A2)
   - What we know: rate is a decimal string; Phase 3 multiplies by it.
   - What's unclear: exact significant-figure count.
   - Recommendation: `toPrecision(12)`, trimmed; document in PLAN.
   - **RESOLVED:** `toPrecision(12)`, trimmed — locked in PLAN 02-02 (`invertToUsd`).

3. **Empty-cache + first-fetch-fails UX.** (Pitfall 5)
   - What we know: page must not crash, must not show fake zeros.
   - What's unclear: stale banner vs a distinct "rates unavailable" empty state.
   - Recommendation: distinct empty-state message when `rates.length === 0`; stale banner only when falling back to a *non-empty* cache.
   - **RESOLVED:** distinct empty-state message when `rates.length === 0`; stale banner only when falling back to a non-empty cache — locked in PLAN 02-02 / 02-03.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Frankfurter API (`api.frankfurter.dev`) | FX-01 fetch | ✓ | v1 | Last-cached rates + stale flag (D-10) — the whole point of the phase |
| Node runtime fetch + AbortSignal | FX service | ✓ | Node 25.5.0 | — (built-in) |
| better-sqlite3 native binding | cache persistence | ✓ | 12.11.1 | — (proven in Phase 1) |
| zod / drizzle-orm / date-fns / shadcn | validation, ORM, dates, UI | ✓ | installed | — |
| Internet egress to api.frankfurter.dev | live refresh | ✓ (verified reachable today) | — | Cache fallback by design |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Frankfurter availability at runtime is *expected to be intermittent* — the cache + stale flag is the designed fallback (FX-03), not an error condition.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.9 `[VERIFIED: package.json]` |
| Config file | none explicit (vitest defaults; `@/` alias resolves — see existing tests) |
| Quick run command | `pnpm test` (vitest run) |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FX-01 | upsert writes all 6 rows; re-run upserts (no dup); USD stored as "1" | unit | `pnpm test src/db/fxRates.query.test.ts` | ❌ Wave 0 |
| FX-01 | service: valid response → inverted X→USD rows cached, `stale:false` | unit | `pnpm test src/lib/fx/frankfurter.test.ts` | ❌ Wave 0 |
| FX-01 | `ensureFreshRates`: fresh cache (<1d) does NOT fetch; empty/old DOES | unit | `pnpm test src/lib/fx/frankfurter.test.ts` | ❌ Wave 0 |
| FX-01 | inversion correctness + precision (CNY 6.7982 → ~0.14709) | unit | `pnpm test src/lib/fx/frankfurter.test.ts` | ❌ Wave 0 |
| FX-03 | fetch throws/timeout → returns cached rates + `stale:true`, DB unchanged | unit | `pnpm test src/lib/fx/frankfurter.test.ts` | ❌ Wave 0 |
| FX-03 | malformed/0/negative rate response → Zod rejects, NO write (no 0/NULL) | unit | `pnpm test src/lib/fx/frankfurter.test.ts` | ❌ Wave 0 |
| FX-03 | empty cache + failed fetch → no crash, `rates:[]`, no fake zeros | unit | `pnpm test src/lib/fx/frankfurter.test.ts` | ❌ Wave 0 |
| FX-01 | `refreshRates` Server Action persists rows (mirror channels.test.ts) | unit | `pnpm test src/actions/fx.test.ts` | ❌ Wave 0 |
| FX-01/03 | persistence across restarts; manual refresh shows updated "as of" | manual | open Rates screen, click 刷新汇率, restart app, verify rows persist | manual-only |

`fetch` is mocked in service tests via `vi.stubGlobal("fetch", vi.fn())` (or `vi.spyOn(globalThis,"fetch")`). DB tests use `createTestDb()`; Server Action tests use the `vi.mock("@/db")` + `vi.mock("next/cache")` pattern from `src/actions/channels.test.ts`.

### Sampling Rate
- **Per task commit:** `pnpm test <the touched test file>`
- **Per wave merge:** `pnpm test` (full suite)
- **Phase gate:** full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/db/fxRates.query.test.ts` — covers FX-01 (upsert/list/recent)
- [ ] `src/lib/fx/frankfurter.test.ts` — covers FX-01 + FX-03 (mock fetch: success / timeout / malformed / empty-cache)
- [ ] `src/actions/fx.test.ts` — covers FX-01 Server Action (mirror channels.test.ts mocks)
- [ ] No framework install needed — vitest already configured and green in Phase 1.

## Security Domain

`security_enforcement: true`, ASVS level 1. This phase has no auth, no user-supplied input, and no secrets (Frankfurter needs no key). The security surface is **the external API response as untrusted input** and **outbound HTTP**.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Single-user app, no auth (CLAUDE.md). |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No multi-user/roles. |
| V5 Input Validation | **yes** | **Zod** validates the Frankfurter response shape AND value sanity (positive finite rates) before it touches the DB. This is the anti-corruption boundary. |
| V6 Cryptography | no | No secrets/PII; HTTPS provides transport security. Never hand-roll crypto. |
| V9 Communications | yes (light) | Fixed HTTPS URL to `api.frankfurter.dev`; `AbortSignal.timeout` bounds the request. No user-controlled URL (no SSRF surface). |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/poisoned external response writes bad rates | Tampering | Zod validate-then-upsert atomically; reject 0/negative/NaN; one transaction. |
| API downtime cascades to a broken page | Denial of Service | Timeout + cache fallback + stale flag (FX-03); never throw to the page. |
| Division-by-zero / Infinity from a `0` rate corrupting Phase 3 | Tampering | `positive()` Zod refinement + guard in `invertToUsd`. |
| SQL injection via rate data | Tampering | Drizzle parameterized builders only (no string SQL) — same discipline as `channels.ts`. |

## Sources

### Primary (HIGH confidence)
- `GET https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY,EUR,GBP,JPY,HKD` — live response verified 2026-06-28: `{amount,base,date,rates}`, USD→X direction, `date` = YYYY-MM-DD. `[VERIFIED]`
- `https://frankfurter.dev/` — host (`api.frankfurter.dev`), no API key, no quotas, v2 surface (`/v2/rates?quotes=`) documented. `[CITED]`
- Project codebase `[VERIFIED]`: `src/db/schema.ts`, `src/db/channels.ts`, `src/db/channels.query.test.ts`, `src/actions/channels.ts`, `src/actions/channels.test.ts`, `src/lib/validation/channel.ts`, `src/test/db-harness.ts`, `src/db/index.ts`, `src/db/migrate.ts`, `src/db/seed.ts`, `src/lib/money.ts`, `src/components/nav/sidebar.tsx`, `src/app/reference-data/currencies/page.tsx`, `src/components/channels/channel-table.tsx`, `package.json`, `drizzle.config.ts`, `.planning/config.json`.
- `.claude/CLAUDE.md` — locked stack, FX strategy, "What NOT to Use", anti-corruption + Node-runtime guidance. `[CITED]`
- `.planning/phases/02-exchange-rate-layer/02-CONTEXT.md` — D-01..D-11. `[CITED]`

### Secondary (MEDIUM confidence)
- Node `AbortSignal.timeout` / global `fetch` (Node 18+) — `[ASSUMED]` from training, consistent with Node 25.5.0 in use.

### Tertiary (LOW confidence)
- Frankfurter v2 `/v2/rates` response shape — not verified live (v1 used instead). `[ASSUMED]`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps already installed/pinned; Frankfurter verified live.
- Architecture: HIGH — every file mirrors a verified Phase 1 counterpart.
- Pitfalls: HIGH — derived from locked decisions + verified API behavior + the money-math constraint.

**Research date:** 2026-06-28
**Valid until:** ~2026-07-28 (stable stack; re-verify Frankfurter host/endpoint if the call starts failing).
