# Project Research Summary

**Project:** 团队空间管理系统 (team-account-manager)
**Domain:** Single-user internal accounting / asset-management web app (multi-currency CRUD + dashboard + one external FX API)
**Researched:** 2026-06-27
**Confidence:** HIGH (stack/architecture/pitfalls verified against live docs; features anchored to PROJECT.md)

## Executive Summary

This is a **single-user internal record-keeping tool** for tracking Codex/ChatGPT team-subscription "spaces" — each space has one mother account, many child accounts, a country, a payment channel, an original amount in some currency, an opening date, and a subscription period. The Core Value is narrow and must hold above all else: **see at a glance which spaces are expiring (need renewal), and the total spend normalized to USD.** Experts build this as a classic **layered monolith** over a single relational store, with the one external dependency (an exchange-rate API) isolated behind an anti-corruption service. There is no auth, no multi-tenancy, no queues, no microservices — resisting that complexity is itself a design requirement.

The recommended approach is a **single Next.js 16 full-stack app** (App Router + React 19 + TypeScript), persisting to **SQLite via Drizzle ORM + better-sqlite3**, styled with **Tailwind v4 + shadcn/ui**, charts via **Recharts 3**, validation with **Zod 4 + React Hook Form**, date math with **date-fns 4**. The exchange-rate provider is **Frankfurter** (frankfurter.dev) — free, no API key, no quotas, daily ECB-based rates, USD base — accessed lazily on dashboard load plus a manual "refresh rates" button, with no cron infrastructure. The whole system deploys as one `next start` process with the `.db` file on a persistent disk (backup = copy the file).

The dominant risks are **money/FX correctness**, not scale. Four load-bearing decisions must be enforced project-wide from day one because they are expensive to retrofit: (1) store money as **integer minor units** (currency-aware exponent — JPY 0dp, BHD 3dp), never floats; (2) **snapshot the FX rate at payment time** (store `rate_used` + `rate_as_of` + `amount_usd`) and never recompute historical spend with today's rate; (3) model payment channels as **id-referenced rows with soft-delete + FK**, never name strings; (4) use **calendar-aware date math** for expiry (month-end/leap-day clamping), never `n*30` days or millisecond arithmetic. The FX API must be treated as fallible from the first conversion: cache last-good rates, allow manual override, surface staleness, and never write `0`/`NULL` USD on failure.

## Key Findings

### Recommended Stack

A single deployable Next.js app handles UI, CRUD (Server Actions), and the FX refresh endpoint (Route Handler); React Server Components query SQLite directly server-side for read-heavy dashboard views, removing the need for a client data-fetching layer. SQLite is ideal for one user/one machine — synchronous, ACID, file-based backup. See `STACK.md` for verified versions.

**Core technologies:**
- **Next.js 16 (App Router) + React 19 + TypeScript** — one codebase/one deploy; Server Actions remove hand-written REST for CRUD.
- **SQLite (better-sqlite3 12.x) + Drizzle ORM 0.45.x + drizzle-kit** — type-safe SQL, clean aggregation API for dashboard group-bys; backup is a file copy. (Note: better-sqlite3 is a native module → DB code must run on Node runtime, not Edge.)
- **Tailwind v4 + shadcn/ui + Recharts 3 + lucide-react** — owned component code, themed charts for spend distribution.
- **Zod 4 + React Hook Form + date-fns 4** — shared form/API validation; calendar-aware expiry math.
- **Frankfurter (frankfurter.dev)** — the one external dependency: free, no key, no quota, USD base, daily updates.

**Exchange-rate API choice:** **Frankfurter** as primary (no key/quota fits a daily single-user tool); `open.er-api.com` or openexchangerates (USD-locked free tier, which fits since base is fixed USD) as viable backups. Store rates in an `exchange_rates` table; refresh lazily on load + manual button. No scheduler needed.

### Expected Features

The feature set maps almost 1:1 to PROJECT.md Active requirements. Research flags two implicit prerequisites worth adding to scope (space list sort/filter; rate caching/fallback as first-class, not polish). See `FEATURES.md`.

**Must have (table stakes):**
- Space CRUD + core fields (country, channel, amount+currency, opening time, period)
- Mother account (1:1) + child account CRUD (codex/chatgpt type + email/login only, no credentials)
- Payment-channel enum maintenance (reference data CRUD)
- Auto expiry calculation (opening + period → expiry)
- Multi-currency capture + USD conversion with caching + manual fallback
- Dashboard: expiry reminders, total USD spend, distribution (country/currency/channel), counts
- Space list with sort-by-expiry + basic filter (implicit prerequisite — recommend adding)

**Should have (competitive, v1.x):**
- Rate snapshot at payment time — near-table-stakes for accounting accuracy (strongly recommended early)
- Tiered expiry status (expired / ≤7d / ≤30d / OK)
- Monthly-equivalent cost; CSV export; renew action + renewal history; cost-per-seat

**Defer (v2+):**
- Spend trend over time (needs accumulated renewal history); bulk operations; notes/tags
- Anti-features to never add: multi-user/auth, email/IM push, credential storage, online payment, bank/email auto-detection, real-time FX streaming

### Architecture Approach

A layered monolith: pure I/O-free `domain/` (ExpiryCalculator, CurrencyConverter), a `services/` orchestration layer (Space/Account/Channel/Dashboard + the FX anti-corruption layer), an API/handler layer, and a relational store. Derived fields (`expiry_date`, `usd_amount`, `rate_used`) are **computed on write and persisted**, so the dashboard is plain indexed SQL aggregation — no per-row conversion or date math at read time. The FX service is the only network-touching module; everything else reads rates from the local cache. See `ARCHITECTURE.md`.

**Major components:**
1. **Data store (SQLite)** — spaces, mother/child accounts, payment_channels, currencies, exchange_rates; source of truth incl. cached rates.
2. **Domain (pure functions)** — ExpiryCalculator (`opening + period → expiry`), CurrencyConverter (`amount, rate → usd`); deterministic, no I/O, trivially testable.
3. **ExchangeRateService (ACL)** — fetch + cache + fallback around Frankfurter; the only place that writes rates from the API.
4. **Services + DashboardService** — Space/Account/Channel CRUD orchestration; read-only aggregation over stored derived fields.

### Critical Pitfalls

1. **Float money math** — store integer minor units with **currency-aware exponent** (JPY 0dp, BHD/KWD 3dp); never `parseFloat` or hard-code `× 100`. (Schema phase — unrecoverable if retrofitted.)
2. **Recomputing history with live rate** — *the key decision*: snapshot `rate_used` + `rate_as_of` + `amount_usd` at payment time; dashboard sums stored `amount_usd`. Live rates only for clearly-labeled "current estimate" views. (Schema + payment flow.)
3. **FX API as hard dependency** — cache last-good rates, decouple fetch from render, always provide manual override, surface "rates as of <date>", never write `0`/`NULL` on failure. (FX phase.)
4. **Naive date math** — calendar-aware add with documented month-end/leap clamping; store period as structured `{unit, count}`; compare calendar dates (not timestamps) in the user's local zone to avoid off-by-one/DST. (Expiry phase.)
5. **Editable channel enum breaking integrity** — reference channels by **stable surrogate id** + **FK**; **soft-delete** (or block) in-use channels so rename/delete never orphans history or empties the by-channel chart. (Reference-data phase.)

Plus: cascade delete (space → mother + children) in one transaction with confirmation; aggregation rounding reconciliation (solved by the integer-USD snapshot).

## Implications for Roadmap

The data model is the trunk; reference data and the FX rate layer must precede USD-aware Spaces; the dashboard aggregates over everything, so it comes last. This dependency chain is **reference data → space + account CRUD → FX rate layer → expiry calc → dashboard**, consistent across ARCHITECTURE.md and PITFALLS.md.

### Phase 1: Foundations + Schema
**Rationale:** Nothing works without scaffold + DB + migrations, and the money/snapshot/date schema decisions are foundational and unrecoverable if deferred.
**Delivers:** Next.js app scaffold, Drizzle + SQLite + migration tooling, full schema with integer-minor-unit money, FX snapshot columns (`rate_used`, `rate_as_of`, `rate_source`, `amount_usd`), structured period (`{unit, count}`), FKs.
**Uses:** Next.js 16, Drizzle ORM, better-sqlite3.
**Avoids:** Pitfall 1 (float money), Pitfall 2 (snapshot columns must exist before any money is stored).

### Phase 2: Reference Data (currencies + payment channels)
**Rationale:** Spaces FK into these; they must exist (seeded or CRUD) before spaces can be created cleanly.
**Delivers:** `currencies` seed + payment-channel CRUD with id-based references and soft-delete/active flag.
**Implements:** ChannelService, reference-tables-over-enums pattern.
**Avoids:** Pitfall 8 (channel enum referential integrity — decide soft-delete vs block up front).

### Phase 3: FX Rate Layer
**Rationale:** USD conversion depends on cached rates; building this before USD-aware Spaces avoids an `amount_usd` backfill/migration later.
**Delivers:** `exchange_rates` table + ExchangeRateService (ACL: fetch Frankfurter + cache + fallback + manual override) + lazy-refresh-on-load + manual "refresh now" button.
**Uses:** Frankfurter API, Zod (validate API response).
**Avoids:** Pitfall 3 (API as hard dependency), Pitfall 4 (free-tier base/limit — USD base fits; conversion-direction unit test).

### Phase 4: Domain Logic (expiry + conversion)
**Rationale:** Pure functions with no deps; can be built in parallel with phases 2–3.
**Delivers:** ExpiryCalculator (calendar-aware add) + CurrencyConverter (pure, rate passed in), both unit-tested.
**Avoids:** Pitfall 5 (naive date math), Pitfall 6 (timezone off-by-one), Pitfall 7 (rounding — round once at conversion boundary).

### Phase 5: Space + Account CRUD
**Rationale:** Core entity wired to domain + rate layer; computes & stores `expiry_date`/`usd_amount`/`rate_used` on write.
**Delivers:** Space CRUD + core fields; mother account (1:1) + child account (1:N) CRUD with cascade delete in one transaction; space list with sort-by-expiry + filter.
**Implements:** SpaceService, AccountService, compute-on-write denormalization (Pattern 1), snapshot-at-payment-time (Pattern 2).
**Avoids:** Pitfall 9 (cascade orphans), and re-snapshot-on-edit behavior.

### Phase 6: Dashboard
**Rationale:** All four widgets are derived views aggregating over stored fields — must come after data + derived fields land.
**Delivers:** Expiry reminders (highlight + tiered status), total USD spend, distribution by country/currency/channel, counts.
**Uses:** Recharts (via shadcn chart), Drizzle aggregation.
**Avoids:** Pitfall 7 (sub-totals reconcile to grand total via integer-USD sums).

### Phase 7: Resilience / UX Polish
**Rationale:** Hardens the FX/UX edges once the core works.
**Delivers:** Staleness flags ("rates as of <date>"), manual rate override surfaced, missing-currency on-demand fetch, "looks done but isn't" checklist verification.

### Phase Ordering Rationale
- **Dependency-driven:** reference data and FX cache are FK/data prerequisites for USD-aware Spaces; dashboard is purely derived and must be last.
- **Schema-first for correctness:** money representation and FX snapshot are unrecoverable retrofits, so they anchor Phase 1.
- **Pure domain logic parallelizable:** Phase 4 has no I/O deps and can overlap Phases 2–3.
- **Incremental-value option:** Spaces could ship storing raw amount first with USD layered in later, but building the FX layer first (Phase 3) avoids an `amount_usd` backfill — preferred.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (FX layer):** confirm Frankfurter response shape, conversion direction (USD-based table → `usd = foreign / rate`), and exact fallback/staleness UX; verify provider still key/quota-free at build time.
- **Phase 4 (date math):** lock the clamping policy and timezone-of-"today" decisions with explicit boundary tests (Jan 31 +1mo, Feb 29 +1yr, midnight/DST).

Phases with standard patterns (skip research-phase):
- **Phase 1, 2, 5, 6:** well-documented Next.js + Drizzle CRUD/aggregation patterns; shadcn components owned in-repo.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against npm registry on 2026-06-27; Frankfurter verified against official docs. |
| Features | MEDIUM | Categorization anchored to PROJECT.md (HIGH); competitor specifics recalled, not freshly fetched (MEDIUM). |
| Architecture | HIGH | Standard layered-monolith / ACL / denormalized-derived-field patterns; FX options verified live. |
| Pitfalls | HIGH | Money/date/enum pitfalls are established engineering knowledge; FX free-tier limits verified against provider docs. |

**Overall confidence:** HIGH

### Gaps to Address
- **FX provider final selection at build time:** Frankfurter recommended, but verify it remains key/quota-free; openexchangerates (USD-locked) is the documented fallback. Handle during Phase 3 planning.
- **Competitor feature specifics (MEDIUM):** treat differentiator prioritization as guidance, not gospel; validate against real usage after v1.
- **Scope additions to confirm with user:** space list sort/filter and rate caching/fallback are recommended as first-class scope, not yet explicit in PROJECT.md Active requirements — flag during roadmap/requirements.
- **Deploy target:** local-file SQLite assumes an always-on box. If serverless/edge is ever chosen, swap better-sqlite3 → libSQL/Turso (Drizzle-compatible). Confirm hosting before Phase 1.

## Sources

### Primary (HIGH confidence)
- npm registry (`/latest`) — verified current versions 2026-06-27 (next 16.2.9, react 19.2.7, drizzle-orm 0.45.2, better-sqlite3 12.11.1, tailwindcss 4.3.1, recharts 3.9.0, zod 4.4.3, date-fns 4.4.0, etc.).
- frankfurter.dev (official) — free, no key, no quota, 201 currencies, USD base, daily ECB-based.
- openexchangerates.org FAQ — free plan locks base to USD (fits this project). exchangerate-api.com free docs — once/day, ~1,500 req/month, key required.
- Next.js / Drizzle / shadcn/ui official docs — Server Actions, RSC, SQLite driver, Tailwind v4.
- Established engineering knowledge — Martin Fowler "Money" pattern, ISO 4217 minor-unit exponents, calendar end-of-month clamping, soft-delete vs FK integrity.

### Secondary (MEDIUM confidence)
- Domain conventions from consumer subscription trackers (Subby, Bobby, TrackMySubs, Subscripto) and IT asset/license managers (Snipe-IT, AssetTiger) — recalled, not freshly fetched this session.

### Tertiary (LOW confidence)
- None.

---
*Research completed: 2026-06-27*
*Ready for roadmap: yes*
