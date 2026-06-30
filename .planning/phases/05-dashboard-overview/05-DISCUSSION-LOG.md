# Phase 5: Dashboard & Overview - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 5-Dashboard & Overview
**Areas discussed:** Dashboard Priority

---

## Dashboard Priority

### First-Screen Job

| Option | Description | Selected |
|--------|-------------|----------|
| Core value first | Show renewal risk and total USD spend together at the top, with distributions and counts below. | Yes |
| Renewal risk first | Make expired/soon spaces the dominant first-screen section, with costs secondary. | |
| Cost overview first | Lead with total USD spend and distribution analysis, with renewal risk secondary. | |
| Agent decides | Let the agent infer the ordering from project goals and code structure. | |

**User's choice:** Core value first.
**Notes:** The first screen should preserve the project core value: renewal risk and USD cost footprint visible at a glance.

### Information Density

| Option | Description | Selected |
|--------|-------------|----------|
| Compact operations dashboard | Top key metrics, then expiring-space list and distribution summaries for repeated scanning. | Yes |
| Spacious overview dashboard | Larger, lighter metrics with less information visible in one viewport. | |
| List-first dashboard | Expiring-space list dominates, with metrics reduced to a summary. | |
| Agent decides | Let the agent choose density during planning. | |

**User's choice:** Compact operations dashboard.
**Notes:** The dashboard should feel like an internal operating surface, not a landing page.

### Section Order

| Option | Description | Selected |
|--------|-------------|----------|
| Expiring-space list first | Put the actionable expired/soon list immediately after top metrics. | Yes |
| Distribution summaries first | Put country/currency/payment-channel summaries before the list. | |
| Side-by-side | Use a desktop split layout with mobile stacking. | |
| Agent decides | Let the agent decide section order. | |

**User's choice:** Expiring-space list first.
**Notes:** Distribution summaries and count overviews are secondary to renewal action.

### Top Metric Order

| Option | Description | Selected |
|--------|-------------|----------|
| Renewal risk plus total spend first | Expired/soon spaces, total USD spend, total spaces, total child accounts. | Yes |
| Total spend plus distribution first | Total USD spend, distribution entry points, total spaces, total child accounts. | |
| Counts plus risk first | Total spaces, total child accounts, renewal risk, total USD spend. | |
| Agent decides | Let the agent decide metric order. | |

**User's choice:** Renewal risk plus total spend first.
**Notes:** Final order: expired/soon spaces, total USD spend, total spaces, total child accounts.

---

## the agent's Discretion

- Exact responsive layout, chart/table composition, and metric card styling.
- Conservative defaults for metric semantics and alert behavior from existing code and prior phase decisions.

## Deferred Ideas

- Metric Semantics and Alert Behavior were offered but not discussed in depth.
