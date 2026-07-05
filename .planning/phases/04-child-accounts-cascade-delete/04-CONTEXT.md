# Phase 4: Child Accounts & Cascade Delete - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 delivers child-account management under each existing subscription space and safe space deletion. The user can manage Codex/ChatGPT seats from the space detail page, including the mother account seat metadata and child account rows. Deleting a space must cascade-delete the space, its mother account, and all child accounts in one confirmed transaction.

In scope:
- Add child accounts under a space.
- Edit and delete individual child accounts.
- Add mother-account seat metadata needed for the same seat model.
- Delete a space with explicit confirmation and cascade all related account rows.
- Extend space displays to show a current estimated CNY reference alongside the frozen USD value.

Out of scope:
- Passwords, tokens, recovery codes, API keys, or any other credentials.
- Global child-account management outside a space detail page.
- Notifications, dashboard aggregation, revenue dashboards, or CNY historical snapshots.

</domain>

<decisions>
## Implementation Decisions

### Child Account Placement and Interaction
- **D-01:** Child accounts are managed inside the corresponding space detail page only. Do not add a global child-account list or a new sidebar entry in Phase 4.
- **D-02:** Use a table on the space detail page with row actions. Add/edit uses dialog forms; delete uses a confirmation dialog. Match the existing space/reference-data maintenance style.

### Seat Model and Fields
- **D-03:** Treat the mother account as a seat too. Both the mother account and every child account have `seat_type`, constrained to `codex` or `chatgpt`.
- **D-04:** Add `can_change_seat_type` only on `mother_account`. Child accounts do not get their own `can_change_seat_type` flag.
- **D-05:** The user must be able to edit the mother account's `seat_type` and `can_change_seat_type` from the space detail page.
- **D-06:** Child account fields are: `seat_type`, email/login, note/label, joined date, monthly price original amount, monthly price currency, frozen USD monthly price, monthly payment day, and the FX snapshot fields needed for that frozen USD value.
- **D-07:** Child-account monthly currency is selected per child account. It does not have to inherit the parent space currency and is not globally fixed.
- **D-08:** No credential fields are allowed. Store only identifiers such as email/login and human-maintained labels.

### Child Monthly Price and FX Snapshot
- **D-09:** Child-account monthly price follows the existing money model: original amount is stored as integer minor units plus `currency_code`.
- **D-10:** On save, freeze the child-account monthly USD amount using the selected currency's current cached FX rate. Store `rate_used`, `rate_as_of`, `rate_source`, and `amount_usd` style fields for the monthly price. Do not recompute historical child-account USD values when FX rates refresh later.
- **D-11:** If the selected currency has no cached rate and is not USD, block save with a clear no-rate message, consistent with Phase 3 space creation behavior.

### Space Delete and Cascade
- **D-12:** Deleting a space must require typing the exact space name before the destructive action is enabled.
- **D-13:** The delete confirmation must clearly state that the space, its mother account, and all child accounts under it will be deleted.
- **D-14:** Cascade deletion must be implemented as one transaction with no orphaned mother or child account rows.

### CNY Reference Display
- **D-15:** Space displays should keep the frozen USD amount as the authoritative stored value and additionally show a current estimated CNY reference.
- **D-16:** The CNY value is display-only and computed from the current USD-to-CNY cached rate. Do not add frozen CNY snapshot columns in Phase 4.
- **D-17:** If the CNY rate is unavailable, show a graceful fallback such as "暂无 CNY 参考" while preserving the USD display.

### the agent's Discretion
- Exact column names and table organization are open, but should mirror existing Drizzle style and preserve the locked semantic fields above.
- Exact Chinese UI labels are open, but the destructive delete copy must be explicit and hard to misread.
- Planner may decide whether mother seat editing lives in the existing space edit dialog or a dedicated section on the detail page, as long as it is editable from the detail page.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements and Roadmap
- `.planning/ROADMAP.md` - Phase 4 goal and success criteria for child accounts and cascade delete.
- `.planning/REQUIREMENTS.md` - ACCT-02, ACCT-03, and SPACE-05 are Phase 4 requirements.
- `.planning/STATE.md` - Current phase state and accumulated decisions, especially money and FX snapshot constraints.

### Prior Phase Decisions
- `.planning/phases/03-spaces-expiry-usd-snapshot/03-CONTEXT.md` - Mother-account 1:1 decision, no-credential constraint, frozen USD snapshot behavior, and deferred Phase 4 account scope.
- `.planning/phases/03-spaces-expiry-usd-snapshot/03-VERIFICATION.md` - Verified Phase 3 behavior and existing space/mother-account implementation evidence.
- `.planning/phases/02-exchange-rate-layer/02-CONTEXT.md` - FX cache semantics, X-to-USD decimal string rates, manual/lazy refresh, and fallback behavior.
- `.planning/phases/01-foundations-schema-reference-data/01-CONTEXT.md` - Money as integer minor units, currency reference data, and UI shell/reference patterns.

### Existing Source Files
- `src/db/schema.ts` - Current `space`, `mother_account`, `currency`, `payment_channel`, and `fx_rate` schema definitions.
- `src/db/spaces.ts` - Current joined space detail queries, `insertSpaceWithMother`, and mother account update helper.
- `src/actions/spaces.ts` - Current create/update space action and FX freeze pipeline to mirror for child monthly pricing.
- `src/lib/money.ts` - Integer-minor-unit and decimal-string money helpers.
- `src/lib/currencies.ts` - Currency formatting and minor-unit helpers.
- `src/db/fxRates.ts` - Cached FX rate query helpers.
- `src/app/spaces/[id]/page.tsx` - Space detail page where child-account management and mother seat editing should surface.
- `src/components/spaces/space-detail-actions.tsx` - Existing detail-page edit action pattern.
- `src/components/spaces/space-table.tsx` - Existing table + row action + dialog interaction pattern.
- `src/components/ui/alert-dialog.tsx` - Existing destructive confirmation primitive.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SpaceDetailPage` already has a child-account placeholder card. Replace that placeholder with the child-account table and actions.
- `SpaceTable` establishes table rows with icon actions, tooltips, and dialog-driven edit forms. Reuse this interaction style for child accounts.
- `SpaceDetailActions` shows the existing detail-page action slot; this can be extended or paired with separate mother-account seat controls.
- `alert-dialog` already exists and should be used for destructive child-account delete and space cascade delete confirmations.

### Established Patterns
- DB helpers accept an explicit `db` parameter so production and in-memory tests share query code.
- Server Components read data; Server Actions perform mutations and call `revalidatePath`.
- Money is stored as integer minor units; rates are decimal strings; frozen USD values are not recomputed after rate refresh.
- Existing create-space flow blocks saves when a non-USD currency has no cached FX rate. Child monthly price should follow the same rule.

### Integration Points
- `mother_account` currently has `space_id` unique FK with `onDelete: cascade` and only `email`. Phase 4 extends it with seat metadata.
- A new child-account table should FK to `space.id` with cascade delete.
- `getSpaceDetail` currently joins space + mother account + payment channel + currency. Phase 4 should include child accounts and any currency/rate data needed for display.
- Space list/detail USD display should add current estimated CNY without changing the stored USD snapshot.

</code_context>

<specifics>
## Specific Ideas

- Child accounts are operational records attached to one space, not a standalone management module.
- Monthly child-account costs may differ by child account and currency, so each child account chooses its own currency.
- The mother account has a special policy flag (`can_change_seat_type`), but child accounts do not.
- Destructive space delete needs stronger confirmation than a normal yes/no dialog because it deletes multiple account records.

</specifics>

<deferred>
## Deferred Ideas

- Global child-account list or sidebar entry is deferred. Phase 4 keeps management inside the space detail page.
- Frozen CNY history is deferred/rejected for now. CNY is only a current display estimate.
- Dashboard totals for child monthly prices and CNY views belong to Phase 5 unless the planner needs minimal data plumbing to avoid rework.
- Notifications or monthly payment reminders remain out of scope.

</deferred>

---

*Phase: 04-child-accounts-cascade-delete*
*Context gathered: 2026-06-28*
