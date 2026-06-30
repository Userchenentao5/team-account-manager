# Phase 5: Dashboard & Overview - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 delivers the dashboard that makes the project core value visible at a glance: renewal risk and normalized USD spend. The dashboard aggregates already-stored derived fields rather than recomputing per-row history. It should show expiring/expired spaces, total USD spend, spend distribution by country/currency/payment channel, and count overviews for spaces and child accounts.

In scope:
- Replace the current dashboard placeholder at `/` with the real overview.
- Surface expired and soon-to-expire spaces as the most actionable section.
- Show total frozen USD spend and distribution summaries from existing stored values.
- Show count overviews such as total spaces and child accounts.
- Reuse the existing compact shadcn/Radix operational UI style.

Out of scope:
- Email, IM, browser, or external renewal notifications.
- Multi-user permissions or dashboards by operator.
- Online payment, automated renewal, or payment collection.
- Recomputing historical USD values from live FX rates.
- New global child-account management beyond dashboard aggregates.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Priority and First Screen
- **D-01:** Use a core-value-first dashboard. The first screen must make renewal risk and total USD spend visible together, not bury either behind secondary analysis.
- **D-02:** Use a compact operations-dashboard layout rather than a spacious marketing-style overview. This is a repeated-use internal tool, so the page should optimize for scanning.
- **D-03:** The top area should present four key metrics in this order: expired/soon-to-expire spaces, total USD spend, total spaces, and total child accounts.
- **D-04:** Immediately after the top metrics, show the expiring-space list. Distribution summaries and count details follow after the actionable renewal list.
- **D-05:** The dashboard is view-first. It may link to existing space detail/edit flows, but Phase 5 does not need new dashboard-specific mutation workflows.

### the agent's Discretion
- Exact card sizing, responsive grid breakpoints, and chart/table composition are planner discretion, but must preserve the compact operations-dashboard priority above.
- Metric semantics that were not explicitly discussed should follow existing project semantics: frozen USD amounts are authoritative, historical rows are not recomputed from live FX, and money math must use integer minor units and decimal-string rates.
- Alert threshold details may reuse the existing `expiryStatus` behavior unless planning finds a stronger project-consistent reason to adjust it.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements and Roadmap
- `.planning/ROADMAP.md` - Phase 5 goal and success criteria for dashboard alerts, total USD spend, distribution, and counts.
- `.planning/REQUIREMENTS.md` - DASH-01, DASH-02, DASH-03, and DASH-04 are the Phase 5 requirements.
- `.planning/STATE.md` - Current phase state and accumulated load-bearing decisions.

### Prior Phase Decisions
- `.planning/phases/04-child-accounts-cascade-delete/04-CONTEXT.md` - Child account fields, child monthly frozen USD amounts, cascade-delete semantics, and current CNY reference display decisions.
- `.planning/phases/03-spaces-expiry-usd-snapshot/03-CONTEXT.md` - Space expiry, frozen USD snapshot, mother-account model, and no-recompute historical semantics.
- `.planning/phases/02-exchange-rate-layer/02-CONTEXT.md` - FX cache semantics, X-to-USD decimal string rates, and stale/fallback behavior.
- `.planning/phases/01-foundations-schema-reference-data/01-CONTEXT.md` - UI shell, reference-data patterns, integer-minor-unit money model, and sidebar conventions.

### Existing Source Files
- `src/app/page.tsx` - Current dashboard placeholder to replace.
- `src/app/layout.tsx` - App shell, sidebar inset, providers, and page layout boundary.
- `src/components/nav/sidebar.tsx` - Dashboard nav entry and current navigation pattern.
- `src/db/schema.ts` - Existing `space`, `mother_account`, `child_account`, `currency`, `payment_channel`, and `fx_rate` schema.
- `src/db/spaces.ts` - Current space list/detail query patterns and expiry ordering.
- `src/db/childAccounts.ts` - Child-account query shape for aggregate counts and monthly USD totals.
- `src/components/spaces/space-table.tsx` - Existing compact table, action, filter, and USD/CNY display pattern.
- `src/components/spaces/expiry-badge.tsx` - Current expired/soon/normal status display.
- `src/components/spaces/child-account-table.tsx` - Child-account display pattern and monthly USD fields.
- `src/lib/expiry.ts` - Current expiry status threshold and date math.
- `src/lib/money.ts` - Integer-minor-unit money formatting and USD conversion helpers.
- `src/lib/currencies.ts` - Currency formatting helpers.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/page.tsx` is already the root dashboard route and can be replaced in place.
- Existing shadcn UI primitives (`Card`, `Badge`, `Table`, `Tooltip`, `Button`) already support the compact dashboard style.
- `ExpiryBadge` already encodes expired/soon/normal display semantics and can be reused or mirrored.
- `SpaceTable` and `ChildAccountTable` provide the app's established table density, row hierarchy, icon action, and money-display patterns.

### Established Patterns
- Server Components read data; Server Actions perform mutations. The dashboard should stay read-oriented and server-render aggregate data.
- DB helpers take an explicit `db` parameter so production and tests can share query code.
- Money is stored as integer minor units; FX rates are decimal strings; frozen USD values are authoritative and must not be recomputed from live rates.
- Existing pages use restrained page padding, compact headings, tables, and cards rather than marketing-style hero composition.

### Integration Points
- Add dashboard query helpers near the existing DB modules, likely reading from `space`, `child_account`, `currency`, and `payment_channel`.
- The expiring-space list should link back to existing `/spaces/[id]` detail routes instead of introducing new edit flows.
- Distribution summaries should derive from stored `amountUsd` and child monthly USD fields while preserving exact reconciliation to the displayed total.

</code_context>

<specifics>
## Specific Ideas

- The first viewport should answer two questions together: "What needs renewal attention?" and "What is the current USD cost footprint?"
- Top metrics order is intentionally risk-first, then cost, then inventory counts.
- Distribution and count sections are secondary; they should not push the expiring-space list below low-value decorative content.

</specifics>

<deferred>
## Deferred Ideas

- Metric-semantics details and alert-behavior edge cases were not deeply discussed. Planner may choose conservative defaults from existing code and prior decisions.
- External notifications remain deferred to v2 requirements.

</deferred>

---

*Phase: 05-dashboard-overview*
*Context gathered: 2026-06-30*
