# Phase 2: Exchange-Rate Layer - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Back USD conversion with a local exchange-rate cache fed from Frankfurter through an anti-corruption service, so rates are available, manually refreshable, and resilient when the API is down — established **before** any USD-aware space exists so Phase 3 never needs an `amount_usd` backfill.

**In scope:**
- New `fx_rate` cache table (Drizzle schema + migration), persisted in SQLite so cached rates survive restarts.
- Anti-corruption FX service: fetch from Frankfurter (`base=USD`), validate the response with Zod, normalize into the cache shape, handle API-down by serving last-cached rates.
- Manual "refresh rates" action (Server Action and/or Route Handler) + a lazy auto-refresh trigger.
- A **Rates screen under Reference Data** showing the 6 cached rates, "rates as of `<date>`", a stale flag, and the manual refresh button.

**Out of scope (later phases):** `amount_usd` computation/freezing on spaces (Phase 3, FX-02), the dashboard itself (Phase 5), the `open.er-api.com` secondary live fallback (deferred), rate history/auditing, currency-list editing UI.
</domain>

<decisions>
## Implementation Decisions

### Cache table shape
- **D-01:** Store **one row per currency** in `fx_rate` (e.g. `currency_code`, `rate_to_usd`, `fetched_at`). A refresh **upserts** all rows. Phase 3 reads a single row by currency code — no JSON parsing, no "latest" query logic. Append-only history and snapshot-blob models were rejected as heavier than MVP needs.
- **D-02:** Each row stores **X→USD** (units of USD per 1 unit of the currency) as a **decimal string** (never float — locked project decision). Phase 3 conversion is then a plain multiply: `amount_usd = amount × rate_to_usd`, no division at the use-site.
- **D-03:** Frankfurter returns `base=USD` → USD→X rates. The anti-corruption service **inverts** each to X→USD on write. **USD itself is stored as `1.0`.** Only the 6 seeded, Frankfurter-convertible currencies (USD, CNY, EUR, GBP, JPY, HKD) are cached.

### Staleness rule
- **D-04:** Rates are flagged **stale only when a refresh attempt fails** and the app falls back to last-cached rates. A fresh cache from a successful fetch is **never** flagged stale, regardless of age. This matches Success Criterion 3 literally and keeps the rule simple.
- **D-05:** The **"rates as of `<date>`"** label (sourced from `fetched_at`) **always displays**, stale or not — satisfies Success Criterion 2 independently of the stale flag.

### Refresh triggers
- **D-06:** Manual **"refresh rates" button is always available** (locked by CLAUDE.md). It triggers a live fetch + cache upsert and surfaces the new "as of" date (or the stale flag on failure).
- **D-07:** **Lazy auto-refresh by cache age:** when a rates-consuming view loads, if the cache is **empty or older than ~1 day** (Frankfurter publishes ~once per working day), fire a refresh; otherwise serve cache as-is. Refresh-on-every-load and manual-only were both rejected. NOTE: cache **age** governs *whether to refresh* (D-07); it does **not** drive the *stale flag* (D-04) — these are deliberately decoupled.
- **D-08:** This phase the lazy trigger fires on the **Rates screen** load (the dashboard is empty until Phase 5); it extends naturally to the dashboard later.
- **D-09:** The lazy refresh is **blocking with a short timeout** (~3–5s, Claude's discretion): it runs server-side during the view's data-load, but a hung/slow API must **degrade to cache + stale flag** rather than block the page. Never writes `0`/`NULL` rates on failure.

### Fallback chain scope (MVP)
- **D-10:** Fallback chain is **Frankfurter primary → last-cached rates** only. If Frankfurter is down and a cache exists, serve the cache and set the stale flag. The `open.er-api.com` secondary **live** source is **deferred** to a later phase to keep this MVP lean (one response shape to validate).

### Where rates are shown this phase
- **D-11:** Rates live on a new **Reference Data → Rates screen** (alongside channels + currencies in the existing left-sidebar shell): the 6-row rate table, "rates as of `<date>`", the stale flag/banner, and the manual refresh button. Self-contained and testable now, without depending on Phase 5's dashboard.

### Claude's Discretion
- Exact `fx_rate` column names/types beyond the locked decimal-string rate and `fetched_at` semantics.
- The blocking-refresh timeout value (~3–5s) and how the timeout falls back to cache.
- Zod schema shape for validating the Frankfurter response; service file organization (mirror the existing `src/db/*.ts` + Server Action patterns from Phase 1).
- Whether refresh is a Server Action, a Route Handler (`/api/fx/refresh`), or both — pick per stack guidance; the CLAUDE.md scheduling note allows a future external job to hit a Route Handler.
- Stale-flag UI treatment (badge vs banner) and the Rates screen's exact layout, reusing shadcn/ui table patterns established in Phase 1.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements & goal
- `.planning/ROADMAP.md` §"Phase 2: Exchange-Rate Layer" — Goal + three Success Criteria (fetch+cache persists across restarts; manual refresh shows updated "rates as of <date>"; API-down falls back to last-cached, flags stale, never fails the page or writes 0/NULL).
- `.planning/REQUIREMENTS.md` §汇率 (FX) — **FX-01** (auto-fetch + local cache) and **FX-03** (API-down → last cached + stale flag) are this phase's requirements. FX-02 (per-space USD snapshot) is Phase 3.

### Stack & FX dependency
- `.claude/CLAUDE.md` §"Exchange-Rate Strategy" — Frankfurter (frankfurter.dev): free, no API key, no quotas, ~daily ECB-style rates, `base`/`from`/`to` params (pull relative to USD). `open.er-api.com` documented backup (deferred this phase). "Avoid keyed/paid tiers."
- `.claude/CLAUDE.md` §"Scheduling Note" + §TL;DR — "refresh lazily on dashboard load + a manual refresh button. No cron infra needed." Store rates in a table. Node runtime required for better-sqlite3 (no `runtime = 'edge'` on DB-touching handlers).
- `.claude/CLAUDE.md` §"What NOT to Use" — no floating-point money math (integer minor units / decimal strings); no paid FX APIs; no Redis/caching layer (SQLite is the cache).

### Schema & money model (Phase 1 foundations)
- `D:\projects\team-account-manager\src\db\schema.ts` — existing Drizzle schema: `currency` (code PK, `minorUnit` exponent authority, `isActive`), `paymentChannel`, and `space` with reserved nullable FX-snapshot columns (`rateUsed`, `rateAsOf`, `rateSource`, `amountUsd`). The new `fx_rate` table is added here; its rows feed Phase 3's population of those space columns.
- `src/db/seed.ts` — `CURRENCY_SEED` (USD, CNY, EUR, GBP, JPY, HKD) — the exact set of currencies the FX layer must cache; all Frankfurter-convertible.
- `src/db/index.ts`, `src/db/migrate.ts`, `drizzle.config.ts` — DB wiring + migration flow (`generate` + programmatic `migrate()`, committed `drizzle/*.sql` per Phase 1 decision).
- `src/db/channels.ts` + `src/db/channels.query.test.ts` — reference pattern for query module + Server Actions + tests to mirror for the FX service.
- `.planning/phases/01-foundations-schema-reference-data/01-CONTEXT.md` — Phase 1 decisions (D-01..D-12): currency table, soft-delete channels, left-sidebar shell with a Reference Data section (where the Rates screen lives).
- `.planning/STATE.md` §Accumulated Context — locked Phase 2 decision: "FX rate cache with last-good fallback + staleness flag must precede USD-aware spaces."

No separate ADR files exist — decisions live in the planning docs above and this CONTEXT.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/db/channels.ts` + `*.query.test.ts`**: the established pattern for a query module (Drizzle reads/writes) paired with tests — mirror it for `fx_rate` reads and the refresh write path.
- **`src/db/seed.ts` `CURRENCY_SEED`**: the authoritative list of currencies to cache (6 majors); reuse it to drive which Frankfurter symbols to fetch and to validate completeness.
- **Drizzle migration flow** (`drizzle.config.ts`, `src/db/migrate.ts`): adding the `fx_rate` table follows the same `generate` → commit `drizzle/*.sql` → `migrate()` path already proven in Phase 1.
- **Left-sidebar shell + Reference Data section** (Phase 1, D-12): the Rates screen slots into the existing Reference Data area next to channels + currencies — reuse the shadcn/ui table/page patterns established there.

### Established Patterns
- Server Components for reads, Server Actions for writes (CLAUDE.md). Reads of cached rates → RSC; manual refresh → Server Action and/or `/api/fx/refresh` Route Handler.
- Zod validation shared client/server (CLAUDE.md) — apply to the Frankfurter response (anti-corruption boundary), not just forms.
- Money/rates as integer minor units / decimal strings — never floats.

### Integration Points
- New `fx_rate` table joins the existing schema; its X→USD rows are the **input** to Phase 3's `amount_usd` freeze (FX-02). Getting the rate direction (D-02) and "as of" semantics right here is what lets Phase 3 snapshot cleanly.
- The anti-corruption service is the single integration surface to Frankfurter — all of the app talks to rates through the cache, never the API directly.

</code_context>

<specifics>
## Specific Ideas

- Store rates as **X→USD** specifically so the Phase 3 conversion is a multiply, not a divide — chosen to reduce use-site error in money math.
- Stale flag is deliberately **failure-only**, not age-based, even though refresh triggering *is* age-based (~1 day) — the two are decoupled on purpose so "fresh fetch today" never shows a misleading stale badge.
- MVP fallback is intentionally just **Frankfurter + cache**; the documented `open.er-api.com` secondary is acknowledged but deferred to avoid validating a second API shape this phase.
- Rates surface on a **Reference Data → Rates screen** this phase precisely because the dashboard doesn't exist until Phase 5 — keeps Phase 2 independently shippable and verifiable.

</specifics>

<deferred>
## Deferred Ideas

- **`open.er-api.com` secondary live fallback** — considered, deferred. Add a second live source (Frankfurter → open.er-api.com → cache) in a later hardening phase if Frankfurter reliability proves insufficient.
- **Age-based stale flag / staleness threshold** — explicitly rejected for the *flag* this phase (failure-only). Revisit if "app left unopened for days shows confidently-fresh old rates" becomes a real problem.
- **Rate history / audit trail** — append-only history model rejected for MVP; revisit only if rate-change history is ever a requirement.
- **External scheduled refresh job** hitting `/api/fx/refresh` — CLAUDE.md notes this is possible but unneeded now; lazy + manual is the chosen path.
- **Dashboard rates indicator** (Phase 5) — the lazy trigger and "as of" indicator extend to the dashboard then; not built this phase.

None of these are scope creep into Phase 2 — discussion stayed within the FX-cache boundary.

</deferred>

---

*Phase: 2-Exchange-Rate Layer*
*Context gathered: 2026-06-28*
