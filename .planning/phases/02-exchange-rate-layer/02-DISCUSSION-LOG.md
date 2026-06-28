# Phase 2: Exchange-Rate Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-28
**Phase:** 2-Exchange-Rate Layer
**Areas discussed:** Cache table shape, Staleness rule, Refresh triggers, Fallback chain scope

---

## Cache table shape

| Option | Description | Selected |
|--------|-------------|----------|
| One row per currency | (currency_code, rate_to_usd, fetched_at); refresh upserts all 6 rows; Phase 3 reads one row by code | ✓ |
| Snapshot blob per refresh | One row per refresh with JSON blob of all rates + single fetched_at | |
| Append-only history | Keep every historical fetch; needs "latest" query logic | |

**User's choice:** One row per currency

### Rate direction (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Store X→USD | USD per 1 unit of currency; Phase 3 conversion is a multiply, no division | ✓ |
| Store USD→X (raw) | Frankfurter native base=USD output; Phase 3 must divide | |

**User's choice:** Store X→USD
**Notes:** Service fetches Frankfurter base=USD and inverts to X→USD on write; USD stored as 1.0.

---

## Staleness rule

| Option | Description | Selected |
|--------|-------------|----------|
| Only on fetch failure | Stale flagged only when a refresh attempt fails and last-cached is served | ✓ |
| Age threshold OR failure | Stale when fetched_at older than ~1 day OR a fetch fails | |
| Age >3 days OR failure | Looser threshold tolerating weekends/holidays | |

**User's choice:** Only on fetch failure
**Notes:** "rates as of <date>" label always displays regardless of stale state.

---

## Refresh triggers

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy: refresh if stale-by-age | On view load, refresh if cache empty or older than ~1 day; else serve cache | ✓ |
| Every dashboard load | Refresh on every load regardless of age | |
| Manual only | Only the manual button refreshes | |

**User's choice:** Lazy: refresh if stale-by-age

### Fetch mode (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Blocking with timeout | Server-side refresh during data-load with short timeout; degrades to cache + stale flag | ✓ |
| Background, eventual | Render from cache immediately, refresh in background | |

**User's choice:** Blocking with timeout
**Notes:** Manual "refresh rates" button always available (locked). Lazy trigger fires on the Rates screen this phase (dashboard empty until Phase 5).

---

## Fallback chain scope

| Option | Description | Selected |
|--------|-------------|----------|
| Frankfurter + cache only | Frankfurter primary → last-cached fallback; defer open.er-api.com | ✓ |
| Add open.er-api.com now | Frankfurter → open.er-api.com → last-cached | |

**User's choice:** Frankfurter + cache only

### Where rates are shown (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Reference Data → Rates screen | Rates table, "as of <date>", stale flag, refresh button under Reference Data | ✓ |
| Dashboard status strip | Rates strip on the (empty) dashboard shell | |
| Both | Rates screen + small dashboard indicator | |

**User's choice:** Reference Data → Rates screen

---

## Claude's Discretion

- Exact `fx_rate` column names/types beyond decimal-string rate + `fetched_at`.
- Blocking-refresh timeout value (~3–5s) and fallback behavior.
- Zod schema for the Frankfurter response; FX service file organization.
- Refresh as Server Action vs `/api/fx/refresh` Route Handler vs both.
- Stale-flag UI treatment (badge vs banner) and Rates screen layout.

## Deferred Ideas

- `open.er-api.com` secondary live fallback — later hardening phase.
- Age-based stale flag / staleness threshold — rejected for the flag this phase.
- Rate history / audit trail — rejected for MVP.
- External scheduled refresh job hitting `/api/fx/refresh` — unneeded now.
- Dashboard rates indicator — Phase 5.
