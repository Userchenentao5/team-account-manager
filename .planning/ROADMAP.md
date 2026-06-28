# Roadmap: 团队空间管理系统 (team-account-manager)

## Overview

This single-user web app tracks Codex/ChatGPT team-subscription "spaces" and surfaces the Core Value: see at a glance which spaces are expiring and the total spend normalized to USD. The build follows a dependency-driven path that still ships usable slices: first stand up the app, lock the load-bearing money/FX-snapshot/period schema, and let the user maintain the reference data spaces depend on; then bring the exchange-rate cache online so USD conversion is reliable before any money is stored; then deliver full space management (with auto-computed expiry and a frozen USD snapshot) and its mother account; then child-account management and safe cascade deletion; and finally the dashboard that aggregates everything into expiry alerts, total USD spend, distribution, and counts.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundations, Schema & Reference Data** - App scaffold, locked money/FX/period schema, and payment-channel + currency reference data (completed 2026-06-27)
- [x] **Phase 2: Exchange-Rate Layer** - Cached, refreshable, fallback-resilient USD rates from the external FX API (completed 2026-06-28)
- [ ] **Phase 3: Spaces (Expiry + USD Snapshot)** - Full space CRUD with mother account, auto expiry, and frozen USD amount
- [ ] **Phase 4: Child Accounts & Cascade Delete** - Codex/ChatGPT child-account management and safe cascading space deletion
- [ ] **Phase 5: Dashboard & Overview** - Expiry alerts, total USD spend, distribution, and count overviews

## Phase Details

### Phase 1: Foundations, Schema & Reference Data

**Goal**: Stand up the single Next.js + SQLite app with the full data schema locked in — money as integer minor units, FX-snapshot columns (`rate_used`, `rate_as_of`, `rate_source`, `amount_usd`), structured subscription period (`{unit, count}`), and FK-based references — and let the user maintain the payment-channel and currency reference data that spaces will later depend on.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: REF-01, REF-02
**Success Criteria** (what must be TRUE):

  1. User can launch the app locally and see a working navigation shell backed by a migrated SQLite database.
  2. User can add, rename, and remove payment channels via stable id-based references; a channel already referenced by a space cannot be hard-deleted (it is soft-deleted or the deletion is blocked).
  3. User can view the list of supported currencies available for selection when creating spaces.
  4. The schema stores money as integer minor units (currency-aware exponent) and every space row reserves FX-snapshot and structured-period columns, verified by a passing migration.

**Plans**: 3/3 plans complete
**Wave 1**

- [x] 01-01-PLAN.md — Scaffold locked stack + full Drizzle schema + migration & 6-currency seed (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Left-sidebar nav shell + read-only currency list (REF-02 display, Wave 2)
- [x] 01-03-PLAN.md — Payment-channel maintenance: add/rename/soft-delete/reactivate (REF-01, Wave 2)

**UI hint**: yes

### Phase 2: Exchange-Rate Layer

**Goal**: Back USD conversion with a local exchange-rate cache fed from the external FX API (Frankfurter) through an anti-corruption service, so rates are available, manually refreshable, and resilient when the API is down — established before any USD-aware space exists to avoid an `amount_usd` backfill later.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: FX-01, FX-03
**Success Criteria** (what must be TRUE):

  1. The app fetches current rates from the external FX API and caches them locally; cached rates persist across restarts.
  2. User can trigger a manual "refresh rates" action and see the updated "rates as of &lt;date&gt;".
  3. When the FX API is unavailable, the app falls back to the last cached rates and visibly flags the data as stale, never failing the page or writing `0`/`NULL` rates.

**Plans**: 3/3 plans complete

**Wave 1**

- [x] 02-01-PLAN.md — fx_rate cache table + migration + query module (atomic upsert, X→USD decimal strings) (FX-01, Wave 1)

**Wave 2** *(blocked on Wave 1)*

- [x] 02-02-PLAN.md — Frankfurter anti-corruption service: fetch + Zod validate + invert + cache-fallback/stale (FX-01, FX-03, Wave 2)

**Wave 3** *(blocked on Wave 2)*

- [x] 02-03-PLAN.md — refreshRates Server Action + 参考数据 → 汇率 screen (table, as-of label, stale banner, empty state, sidebar entry) (FX-01, FX-03, Wave 3)

**UI hint**: yes

### Phase 3: Spaces (Expiry + USD Snapshot)

**Goal**: Let the user fully manage subscription spaces and each space's single mother account, with the expiry date and frozen USD amount computed and stored on write — using calendar-aware date math and the FX rate snapshot taken at payment time.
**Mode:** mvp
**Depends on**: Phase 1, Phase 2
**Requirements**: SPACE-01, SPACE-02, SPACE-03, SPACE-04, ACCT-01, EXP-01, FX-02
**Success Criteria** (what must be TRUE):

  1. User can create a space with country, payment channel, original amount + currency, opening (payment) date, subscription period, and its one mother account (email/login).
  2. On save, the system auto-computes the expiry date (calendar-aware, correct for month-end and leap years) and freezes the USD amount using the rate at payment time (`rate_used` + `rate_as_of` stored on the space).
  3. User can view a space's detail (mother account, expiry date, original amount, frozen USD amount) and edit its information.
  4. User can view the space list and sort it by expiry time and filter by country / payment channel.

**Plans**: TBD
**UI hint**: yes

### Phase 4: Child Accounts & Cascade Delete

**Goal**: Let the user manage the codex/chatgpt child accounts that hang under each space and safely delete a space, cascading removal of its mother and child accounts in a single transaction.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: ACCT-02, ACCT-03, SPACE-05
**Success Criteria** (what must be TRUE):

  1. User can add child accounts under a space, choosing type (codex / chatgpt) and entering email/login only (no credentials stored).
  2. User can edit and delete individual child accounts.
  3. User can delete a space and its mother account and all child accounts are removed together in one confirmed transaction, leaving no orphaned records.

**Plans**: TBD
**UI hint**: yes

### Phase 5: Dashboard & Overview

**Goal**: Deliver the Core Value at a glance — which spaces are expiring and the total USD spend — plus spend distribution and count overviews, all aggregated over the stored derived fields with no per-row recomputation.
**Mode:** mvp
**Depends on**: Phase 3, Phase 4
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):

  1. User can open the dashboard and immediately see which spaces are expiring soon or already expired, highlighted by tiered status.
  2. User can see total spend converted to USD, with sub-totals that reconcile exactly to the grand total.
  3. User can see spend distribution broken down by country, currency, and payment channel.
  4. User can see count overviews such as number of spaces and number of child accounts.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundations, Schema & Reference Data | 3/3 | Complete    | 2026-06-27 |
| 2. Exchange-Rate Layer | 3/3 | Complete   | 2026-06-28 |
| 3. Spaces (Expiry + USD Snapshot) | 0/TBD | Not started | - |
| 4. Child Accounts & Cascade Delete | 0/TBD | Not started | - |
| 5. Dashboard & Overview | 0/TBD | Not started | - |
