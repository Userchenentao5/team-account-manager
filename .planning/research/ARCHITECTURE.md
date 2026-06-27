# Architecture Research

**Domain:** Single-user internal accounting / asset-management web app (CRUD + dashboard + one external API)
**Researched:** 2026-06-27
**Confidence:** HIGH (standard CRUD+dashboard patterns; exchange-rate API options verified against live docs)

## Standard Architecture

This is a classic **single-user monolith**: a layered CRUD app over a relational store, with one
external integration (exchange-rate API) isolated behind a service boundary, plus a read-only
dashboard that aggregates over the same data. No multi-tenancy, no auth/roles, no message queues.
Resist any urge to distribute it.

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (UI)                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐   │
│  │ Space    │  │ Account  │  │ Reference│  │ Dashboard      │   │
│  │ CRUD     │  │ CRUD     │  │ Data CRUD│  │ (read-only agg)│   │
│  │ forms    │  │ (mother/ │  │ (channels│  │ expiry + cost  │   │
│  │          │  │  child)  │  │  /rates) │  │ + distribution │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬────────┘   │
├───────┼─────────────┼─────────────┼────────────────┼────────────┤
│       │             │   API / HANDLER LAYER         │            │
│  ┌────┴─────────────┴─────────────┴────────────────┴────────┐   │
│  │   REST/RPC endpoints — validation, request/response shape │   │
│  └────┬─────────────┬─────────────┬────────────────┬────────┘   │
├───────┼─────────────┼─────────────┼────────────────┼────────────┤
│       │             │   DOMAIN / SERVICE LAYER      │            │
│  ┌────┴─────┐ ┌─────┴─────┐ ┌─────┴──────┐ ┌────────┴────────┐  │
│  │ Space    │ │ Account   │ │ Channel    │ │ Dashboard /     │  │
│  │ Service  │ │ Service   │ │ Service    │ │ AggregationSvc  │  │
│  └────┬─────┘ └─────┬─────┘ └─────┬──────┘ └────────┬────────┘  │
│       │             │             │                 │            │
│  ┌────┴─────────────┴──┐   ┌──────┴───────────┐    │            │
│  │ ExpiryCalculator     │   │ CurrencyConverter │   │            │
│  │ (pure function)      │   │ (pure, reads rate)│   │            │
│  └──────────────────────┘   └──────┬───────────┘   │            │
│                                     │ reads          │            │
│                          ┌──────────┴────────────┐   │            │
│                          │ ExchangeRateService    │  (ACL around │
│                          │ fetch + cache + fallbk │   external)  │
│                          └──────────┬─────────────┘              │
├─────────────────────────────────────┼───────────────────────────┤
│                        DATA STORE (relational)                    │
│  ┌────────┐ ┌──────────────┐ ┌─────────────┐ ┌───────────────┐  │
│  │ spaces │ │ mother_/child│ │ payment_    │ │ currencies /  │  │
│  │        │ │ _accounts    │ │ channels    │ │ exchange_rates│  │
│  └────────┘ └──────────────┘ └─────────────┘ └───────────────┘  │
└─────────────────────────────────────┬───────────────────────────┘
                                       │ (scheduled daily refresh)
                              ┌────────┴─────────┐
                              │ External FX API  │
                              │ (Frankfurter etc)│
                              └──────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Data store | Persist all entities; source of truth (incl. cached FX rates) | SQLite/Postgres + migrations (single file DB is plenty for one user) |
| SpaceService | CRUD for Space; orchestrates expiry + USD computation on write | Service module calling ExpiryCalculator + CurrencyConverter |
| AccountService | CRUD for the 1:1 MotherAccount and the 1:N ChildAccounts | Service module; enforces 1:1 / cascade rules |
| ChannelService | CRUD for the user-maintained payment-channel enum table | Thin service over `payment_channels` |
| ExpiryCalculator | Pure: `opening_time + subscription_period → expiry_date` | Pure function, no I/O (date math) |
| CurrencyConverter | Pure: `(amount, currency, rate) → usd_amount` | Pure function; takes rate as input, does not fetch |
| ExchangeRateService | Anti-corruption layer around the FX API: fetch, cache, fallback | Service + scheduled job; only component that touches the network |
| DashboardService | Read-only aggregation: totals, distributions, expiry buckets | Query/aggregation module over `spaces` |
| API/handler layer | HTTP endpoints, input validation, serialization | REST or RPC routes |
| Frontend | CRUD forms + dashboard views; surfaces staleness/expiry flags | SPA or server-rendered pages |

## Data Model (Entities & Relationships)

```
payment_channels ──┐
                   │ (FK)
currencies ────────┤        ┌──── mother_account (1:1)
        ▲          │        │
        │ (code)   ▼        │
exchange_rates   spaces ────┼──── child_accounts (1:N, type=codex|chatgpt)
 (rate_to_usd)              │
                            └──── (snapshots rate_used at write time)
```

| Entity | Key Fields | Notes |
|--------|-----------|-------|
| **Space** | id, name, country, `payment_channel_id` (FK), `original_amount` (decimal), `original_currency` (FK→currencies.code), `opening_time` (date), `subscription_period` (unit+count, e.g. MONTH×1 / YEAR×1), **`expiry_date`** (derived, stored), **`usd_amount`** (derived, stored), **`rate_used`** (snapshot), `rate_as_of` | Central entity. Derived fields are **computed on write and persisted** (see patterns). |
| **MotherAccount** | id, `space_id` (FK, UNIQUE), email/login | Strict 1:1 with Space. Could be folded into the Space row, but a separate table keeps it explicit and matches the real-world "opener" concept. |
| **ChildAccount** | id, `space_id` (FK), `type` (enum codex/chatgpt), email/login | 1:N under Space. **No credentials/passwords** (explicit out-of-scope). Cascade-delete with Space. |
| **PaymentChannel** | id, name, active/sort_order | User-maintained enum table. Soft-delete or `active` flag so historical Spaces keep their channel reference. |
| **Currency** | code (ISO 4217, e.g. USD/EUR), name, symbol | Reference list; USD is the fixed base. Seed a starter set. |
| **ExchangeRate** | currency_code (FK), `rate_to_usd` (decimal), `fetched_at`, `source` | App's cached copy of FX rates — the app's source of truth, refreshed from the external API. Store latest-per-currency (optionally append history). |

**Decimal, not float, for money and rates** — use a decimal/numeric type to avoid rounding drift in
totals.

## Recommended Project Structure

```
src/
├── db/                 # schema, migrations, seed (currencies, starter channels)
│   ├── schema.*        # table definitions
│   └── migrations/     # versioned DDL
├── domain/             # pure business logic — NO I/O
│   ├── expiry.*        # ExpiryCalculator: opening + period → expiry_date
│   └── currency.*      # CurrencyConverter: (amount, rate) → usd_amount
├── services/           # orchestration + persistence access
│   ├── space.*         # SpaceService (uses domain/ + db/)
│   ├── account.*       # mother/child CRUD
│   ├── channel.*       # payment-channel enum CRUD
│   ├── exchangeRate.*  # ACL around FX API: fetch + cache + fallback
│   └── dashboard.*     # aggregation queries
├── jobs/               # scheduled FX refresh (daily)
├── api/                # routes/handlers + validation
└── web/                # frontend (forms + dashboard)
```

### Structure Rationale

- **`domain/` is pure and I/O-free:** expiry and conversion are deterministic functions. Keeping them
  free of DB/network calls makes them trivially testable and reusable from both write-time computation
  and dashboard recomputation.
- **`services/exchangeRate.*` is the only network-touching module:** every other component reads rates
  from the local store, never the external API directly (anti-corruption boundary).
- **`jobs/` separate from request path:** rate refresh runs on a schedule, decoupled from user requests.

## Architectural Patterns

### Pattern 1: Compute-on-write + denormalize derived fields

**What:** Compute `expiry_date` and `usd_amount` when a Space is created/edited and **store** them on
the row, rather than recomputing on every read.
**When to use:** When derived values feed list views and dashboard filters/aggregations (they do here —
"expiring soon" and "total cost").
**Trade-offs:** (+) Simple, fast, indexable dashboard queries; deterministic snapshots. (−) Must
recompute on edit of inputs. Acceptable: edits are rare, single user.

```
on createSpace(input):
    expiry   = ExpiryCalculator(input.opening_time, input.subscription_period)
    rate     = ExchangeRateService.getRate(input.original_currency)   # from cache
    usd      = CurrencyConverter(input.original_amount, rate)
    persist({ ...input, expiry_date: expiry, usd_amount: usd,
              rate_used: rate, rate_as_of: rate.fetched_at })
```

### Pattern 2: Snapshot the FX rate at payment time (accounting correctness)

**What:** Store `rate_used` and `usd_amount` on the Space at creation. Do **not** silently re-convert
historical spend with today's rate.
**When to use:** Always, for an accounting/asset ledger — "what did this cost in USD" must be stable
and auditable. PROJECT calls amounts "derived"; derive once, then freeze.
**Trade-offs:** (+) Stable, auditable totals; immune to FX swings. (−) If the user wants a live
"current value" view, recompute separately using latest rates — keep it as a distinct, clearly labeled
view, never overwriting the historical figure.

### Pattern 3: Anti-corruption layer for the external API

**What:** `ExchangeRateService` wraps the FX provider, normalizes its response into the internal
`ExchangeRate` shape, persists it, and serves all internal reads from the cache.
**When to use:** Any external dependency, especially one that can be slow/down/rate-limited.
**Trade-offs:** (+) App never blocks on the API; provider can be swapped without touching domain code;
fallback logic lives in one place. (−) One extra layer — negligible cost, large resilience gain.

### Pattern 4: Reference tables over hard-coded enums

**What:** `payment_channels` and `currencies` are DB tables, not code constants.
**When to use:** When the user maintains the list (channels) or it grows over time (currencies). Both
apply here.
**Trade-offs:** (+) User-editable without redeploy; FKs keep Spaces consistent. (−) Need a tiny CRUD
UI — which is a stated requirement anyway. Use `active`/soft-delete so deleting a channel doesn't
orphan historical Spaces.

## Data Flow

### Create / edit a Space

```
[User submits Space form]
    ↓
[API handler] validate → [SpaceService]
    ↓                        ↓ reads cached rate
[ExpiryCalculator]      [ExchangeRateService.getRate(currency)]  ←─ exchange_rates (cache)
    ↓                        ↓
 expiry_date            [CurrencyConverter] → usd_amount, rate_used
    ↓                        ↓
            [persist spaces row with derived fields]
                             ↓
                       [response → UI]
```

### Exchange-rate refresh (scheduled, off the request path)

```
[Daily scheduler] → [ExchangeRateService.refresh()]
    ↓
[Call external FX API (base=USD)]
    ├─ success → upsert exchange_rates (rate_to_usd, fetched_at, source='api')
    └─ failure → keep last-good rows; log; surface staleness in UI
```

### Dashboard aggregation (read-only)

```
[Dashboard view loads]
    ↓
[DashboardService] queries spaces (derived fields already stored)
    ├─ SUM(usd_amount)                         → total spend
    ├─ GROUP BY country / currency / channel   → distribution
    ├─ WHERE expiry_date within N days / past  → expiry buckets (highlight)
    └─ COUNT spaces, COUNT child_accounts      → quantity stats
    ↓
[Response → dashboard widgets]
```

Because derived fields are stored (Pattern 1), the dashboard is plain SQL aggregation — no per-row
conversion or date math at read time.

## Exchange-Rate Integration Boundary

This is the only external dependency and the main resilience concern. PROJECT explicitly requires a
degradation strategy (cache last rate / manual fallback).

**Recommended provider:** **Frankfurter** (`frankfurter.dev`) as primary — free, **no API key**, **no
monthly/daily quota**, daily updates, sourced from central banks (ECB-based), self-hostable. Ideal for
a single-user tool that needs one refresh per day. **exchangerate-api.com** free tier is a viable
alternative but requires an API key and caps at ~1.5k requests/month with once-daily updates.

| Concern | Decision |
|---------|----------|
| **Fetch cadence** | Once per day (FX data updates daily; more is wasteful). A manual "refresh now" button is a nice optional add. |
| **Cache** | `exchange_rates` table is the app's source of truth. All reads hit the cache, never the live API. |
| **Failure handling** | On fetch error, retain last-good rows; never wipe the cache; log the failure. |
| **Fallback chain** | (1) latest cached rate → (2) last-known-good shown with a "stale since `fetched_at`" flag in the UI → (3) manual override entry the user can type if a currency is missing or API is down. |
| **Missing currency** | If a Space uses a currency not in the cache, trigger an on-demand fetch; if that also fails, prompt for manual rate entry. |
| **Provider swap** | Isolated in `ExchangeRateService` — changing provider touches one module. |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 user (this project) | Monolith + single-file DB (SQLite). No caching infra beyond the rate table. Done. |
| Hypothetical multi-user | Add auth + per-user scoping; move to Postgres. Not in scope — do not pre-build. |
| Large data volume | Irrelevant: dozens–hundreds of Spaces. Indexing `expiry_date` is the only optimization worth doing. |

### Scaling Priorities

1. **First (only) bottleneck:** dashboard "expiring soon" query — solved for free by storing + indexing
   `expiry_date`. No further work needed.
2. **Everything else:** data volume is tiny; premature optimization is the real risk here.

## Anti-Patterns

### Anti-Pattern 1: Calling the FX API on every request / page load

**What people do:** Convert currencies live by hitting the external API per render.
**Why it's wrong:** Latency, rate-limit exhaustion, and total breakage when the API is down — directly
violates the required degradation behavior.
**Do this instead:** Refresh on a daily schedule into `exchange_rates`; read only from the cache.

### Anti-Pattern 2: Re-converting historical spend with today's rate

**What people do:** Store only the original amount and multiply by the current rate at read time.
**Why it's wrong:** Historical "cost in USD" drifts with the market — wrong for an accounting ledger.
**Do this instead:** Snapshot `rate_used` + `usd_amount` at payment time (Pattern 2); offer any "live
value" as a separate, clearly-labeled view.

### Anti-Pattern 3: Computing expiry/USD only on read, everywhere

**What people do:** Recompute derived fields in each view and in each aggregation.
**Why it's wrong:** "Expiring soon" and totals become awkward, un-indexable queries; logic duplicated
and easy to diverge.
**Do this instead:** Compute on write, store, index (Pattern 1).

### Anti-Pattern 4: Hard-coding payment channels / currencies in code

**What people do:** Ship channels and currencies as enums/constants.
**Why it's wrong:** The user must maintain channels without a redeploy; FKs can't enforce consistency.
**Do this instead:** Reference tables with a small CRUD UI and soft-delete (Pattern 4).

### Anti-Pattern 5: Over-engineering for one user

**What people do:** Add auth/roles, microservices, queues, Redis, etc.
**Why it's wrong:** All out of scope; pure cost and complexity for a single-user internal tool.
**Do this instead:** One deployable app, one relational DB, a scheduled job. That's the whole system.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Exchange-rate API (Frankfurter primary) | Scheduled pull via ExchangeRateService (ACL), cached in DB | No key, no quota, daily data. Always have a manual-rate fallback. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Services ↔ domain (`expiry`, `currency`) | Direct function calls, rates passed in as args | Domain stays pure/I/O-free for testability |
| SpaceService ↔ ExchangeRateService | Direct read of cached rate at write time | Never reaches the network synchronously |
| DashboardService ↔ DB | Read-only aggregation queries | Relies on stored derived fields |
| Job scheduler ↔ ExchangeRateService | Triggers `refresh()` off the request path | Only place that writes `exchange_rates` from the API |

## Suggested Build Order (dependency-driven)

The data model is the trunk; reference data and the rate layer must precede USD-aware Spaces; the
dashboard aggregates over everything, so it comes last.

1. **Foundations** — project scaffold, DB, migration tooling. *(Nothing works without this.)*
2. **Reference data** — `currencies` (seed) + `payment_channels` CRUD. *(Spaces FK into these.)*
3. **Exchange-rate layer** — `exchange_rates` table + ExchangeRateService (fetch + cache + fallback) +
   daily job. *(USD conversion depends on cached rates.)*
4. **Domain logic** — ExpiryCalculator + CurrencyConverter as pure, tested functions. *(No deps; can be
   built in parallel with steps 2–3.)*
5. **Core entity** — Space CRUD wired to domain + rate layer (compute & store expiry/USD on write).
6. **Accounts** — MotherAccount (1:1) + ChildAccount (1:N) CRUD under a Space.
7. **Dashboard** — aggregations (total USD spend, distributions, expiry highlighting, counts).
8. **Resilience/UX polish** — staleness flags, manual rate override, "refresh now".

**Incremental-value note:** If earlier delivery is desired, steps 5–6 can ship storing only the raw
amount, with USD conversion (step 3 wiring) layered in afterward — Space CRUD does not *hard*-require
the rate layer to exist, only the USD figure does. But building the rate layer first avoids a
backfill/migration of `usd_amount` later, so the order above is preferred.

## Sources

- [Frankfurter API docs](https://frankfurter.dev/docs/) — free, no API key, no quota, daily ECB-based rates (HIGH confidence — verified live)
- [exchangerate-api.com free tier docs](https://www.exchangerate-api.com/docs/free) — alternative; API key, ~1.5k req/month, daily updates (HIGH confidence — verified live)
- Standard layered-monolith / anti-corruption-layer / denormalized-derived-field patterns (HIGH confidence — established architecture practice)

---
*Architecture research for: single-user internal accounting / asset-management web app*
*Researched: 2026-06-27*
