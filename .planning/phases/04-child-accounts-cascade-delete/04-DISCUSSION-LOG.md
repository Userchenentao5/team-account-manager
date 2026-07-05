# Phase 4: Child Accounts & Cascade Delete - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-06-28
**Phase:** 04-child-accounts-cascade-delete
**Areas discussed:** Child account placement, child account fields, delete confirmation, interaction model, mother account seat metadata, child monthly price FX, CNY reference display

---

## Child Account Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Space detail only | Manage child accounts inside the owning space detail page. | yes |
| Detail plus global list | Manage on detail page and also provide a global list. | |
| Independent sidebar entry | Treat child accounts as a top-level navigation resource. | |

**User's choice:** Space detail only.
**Notes:** Keeps Phase 4 aligned with the data hierarchy: space -> mother account -> child accounts.

---

## Child Account Fields

| Option | Description | Selected |
|--------|-------------|----------|
| Note/label only beyond required fields | Add a human label while keeping scope small. | |
| Required fields only | Store only type and email/login. | |
| Expanded account and billing fields | Include label, joined date, monthly price, monthly payment day, and selected currency. | yes |

**User's choice:** Expanded account and billing fields.
**Notes:** User explicitly added joined date, monthly price, and monthly payment time. Later clarified each child account chooses its own monthly currency.

---

## Delete Confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Type space name | Require typing the exact space name before cascade delete. | yes |
| Simple confirmation dialog | One-click confirmation after opening dialog. | |
| Two-step confirmation | Show impact list, then confirm. | |

**User's choice:** Type space name.
**Notes:** Delete copy must state that mother account and all child accounts under the space are deleted.

---

## Child Account Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Table + row actions + dialog forms | Reuse existing maintenance UI pattern. | yes |
| Card list + dialog forms | More spacious visual layout for fewer accounts. | |
| Inline editable table | Faster bulk edits but more complex and riskier. | |

**User's choice:** Table + row actions + dialog forms.
**Notes:** Should live on the space detail page.

---

## Mother Account Seat Metadata

| Option | Description | Selected |
|--------|-------------|----------|
| Flag only on mother account | Mother account has `can_change_seat_type`; all seats have `seat_type`. | yes |
| Flag on every seat | Mother and child accounts each have the changeability flag. | |
| Flag on space | Space-level policy for all seats. | |

**User's choice:** Flag only on mother account.
**Notes:** User said each seat, including mother and child accounts, has a Codex/ChatGPT seat type. Mother account should also have a state for whether its seat type can change.

---

## Mother Account Editing

| Option | Description | Selected |
|--------|-------------|----------|
| Editable on space detail page | Edit mother `seat_type` and `can_change_seat_type` from detail page. | yes |
| Data only, no UI | Add fields but do not expose editing yet. | |
| Seat type only | Edit `seat_type` but not the changeability flag. | |

**User's choice:** Editable on space detail page.
**Notes:** This makes the mother seat part of the same operational maintenance surface as child accounts.

---

## Child Monthly Price FX

| Option | Description | Selected |
|--------|-------------|----------|
| Original currency plus frozen USD | Store original monthly amount/currency and freeze USD on save. | yes |
| Original currency only | Defer USD conversion. | |
| USD only | Simplify aggregation but lose original currency. | |

**User's choice:** Original currency plus frozen USD.
**Notes:** User clarified monthly currency is selected per child account, not inherited or globally fixed.

---

## CNY Reference Display

| Option | Description | Selected |
|--------|-------------|----------|
| Current estimated CNY | Keep frozen USD as source of truth and display current CNY estimate. | yes |
| Frozen CNY snapshot | Store CNY history beside USD. | |
| Dashboard only | Defer CNY display to Phase 5. | |

**User's choice:** Current estimated CNY.
**Notes:** If CNY rate is unavailable, UI should degrade gracefully and keep USD visible.

---

## the agent's Discretion

- Exact component split, route helper names, schema column names, and Chinese copy are left to planning and implementation as long as the locked semantics are preserved.

## Deferred Ideas

- Global child-account list/sidebar.
- Frozen CNY historical snapshot.
- Dashboard aggregation and reminder/notification behavior.
