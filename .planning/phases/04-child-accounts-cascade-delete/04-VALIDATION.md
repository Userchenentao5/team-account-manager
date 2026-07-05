---
phase: 4
slug: child-accounts-cascade-delete
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-28
---

# Phase 4 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source of truth: `04-RESEARCH.md` - Validation Architecture, plus Phase 04 plans 04-01 through 04-05.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run <touched test file>` |
| Full suite command | `npm test` |
| Type check | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Build | `npm run build` |
| Estimated quick latency | Under 60 seconds for targeted Vitest commands |

---

## Sampling Strategy

- After every task commit: run the targeted command named in that task's `<verify><automated>` block.
- After every plan wave: run the plan-level checks listed in the plan's `<verification>` block.
- Before Phase 04 UAT or `$gsd-verify-work`: run `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
- Migration evidence sampling: Plan 04-01 must run `npx drizzle-kit generate` and inspect `drizzle/0004_*.sql` before action/UI work begins.
- Security sampling: every Server Action mutation path must be covered by action tests that parse untrusted inputs server-side and assert no credential-like fields persist.
- Manual sampling: perform the UI checklist once after Plan 04-05 passes automated verification.
- Max feedback gap: no three consecutive tasks may complete without an automated command run.

---

## Requirement Validation Map

| Req ID | Behavior | Planned Test / Check | Automated Command | Manual Check | Phase Gate |
|--------|----------|----------------------|-------------------|--------------|------------|
| ACCT-02 | User can add child accounts under a space with `codex` / `chatgpt`, email/login, monthly price, currency, joined date, payment day, and frozen monthly USD snapshot. | `src/db/childAccounts.query.test.ts` and `src/actions/childAccounts.test.ts` cover insert/list, validation, no-rate block, and snapshot creation. | `npx vitest run src/db/childAccounts.query.test.ts src/actions/childAccounts.test.ts` | On `/spaces/[id]`, add a child account and verify the row appears in the detail-page table only. | Plan 04-01 + 04-02 + 04-03 green |
| ACCT-03 | User can edit and delete individual child accounts. | Action tests cover non-price edit preservation, amount/currency refreeze, delete, invalid IDs, and mass-assignment protection; DB tests cover update/delete isolation. | `npx vitest run src/actions/childAccounts.test.ts src/db/childAccounts.query.test.ts` | Edit a child row, delete a child row, and verify the space and mother account remain. | Plan 04-02 + 04-03 green |
| SPACE-05 | User can delete a space and cascade delete mother and child accounts. | DB/action tests cover exact-name mismatch no-op, exact-match transactional delete, and zero mother/child orphans. | `npx vitest run src/db/spaces.query.test.ts src/actions/spaces.test.ts src/db/childAccounts.query.test.ts` | On `/spaces/[id]`, type the exact space name, confirm delete, and verify the list no longer shows the space. | Plan 04-04 green |

---

## Decision Validation Map

| Decision | Coverage | Planned Test / Check | Command / Gate |
|----------|----------|----------------------|----------------|
| D-01 | Child management stays inside the space detail page only. | Source assertion rejects a global child-account route; manual UI check verifies no sidebar/global list entry. | `powershell -NoProfile -Command "if (Test-Path 'src/app/child-accounts') { throw 'global child account route is not allowed' }"` |
| D-02 | Child table uses row actions; add/edit/delete use dialogs. | Plan 04-03 type check plus manual UI inspection of table row icon actions and dialogs. | `npx tsc --noEmit` |
| D-03 | Mother and child accounts have `seat_type`. | Schema/migration assertions and action/UI tests cover mother seat update and child seat selection. | `npx vitest run src/db/childAccounts.query.test.ts src/actions/childAccounts.test.ts` |
| D-04 | `can_change_seat_type` exists only on `mother_account`. | DB helper tests assert child rows do not expose child-level `can_change_seat_type`; validation schema is narrow. | `npx vitest run src/db/childAccounts.query.test.ts src/actions/childAccounts.test.ts` |
| D-05 | Mother seat metadata is editable from the detail page. | `MotherSeatCard` wiring check and action test for `updateMotherSeat`. | `npx tsc --noEmit` and `npx vitest run src/actions/childAccounts.test.ts` |
| D-06 | Child fields include seat type, identifier, label, joined date, monthly original price/currency, frozen USD snapshot, payment day, and FX snapshot fields. | Schema, validation, action, and table tests/checks cover the full field set. | `npx vitest run src/db/childAccounts.query.test.ts src/actions/childAccounts.test.ts` |
| D-07 | Monthly currency is selected per child account. | Action tests create/update children with per-child currency and refreeze on currency change. | `npx vitest run src/actions/childAccounts.test.ts` |
| D-08 | No credential fields are allowed. | Source assertion checks child form copy; action tests cover mass-assignment protection for credential-looking payload keys. | `npx vitest run src/actions/childAccounts.test.ts` plus source grep gate in Plan 04-03 |
| D-09 | Child monthly price uses integer minor units plus currency. | Validation and action tests use `monthlyAmountMinor` and `monthlyCurrencyCode`; UI parses with `parseToMinor`. | `npx vitest run src/actions/childAccounts.test.ts src/lib/money.test.ts` |
| D-10 | Child monthly USD snapshot freezes on save and is not recomputed on non-price edits. | Action tests assert snapshot creation, non-price preservation, and amount/currency refreeze. | `npx vitest run src/actions/childAccounts.test.ts` |
| D-11 | Save is blocked when a selected non-USD currency has no cached rate. | Action test asserts no-rate result and unchanged row counts. | `npx vitest run src/actions/childAccounts.test.ts` |
| D-12 | Space delete requires typing the exact space name. | Server action tests mismatch rejection; UI source assertion checks `confirmationName`. | `npx vitest run src/actions/spaces.test.ts` |
| D-13 | Delete copy states the space, mother account, and all child accounts will be deleted. | Source assertion checks destructive dialog copy includes mother and child scope; manual UI check reads the dialog. | Source gate in Plan 04-04 |
| D-14 | Cascade delete is one transaction with no mother/child orphans. | DB tests cover `deleteSpaceCascade` and FK cascade; generated migration is checked for `ON DELETE cascade`. | `npx vitest run src/db/spaces.query.test.ts src/db/childAccounts.query.test.ts` |
| D-15 | Frozen USD remains authoritative while CNY is reference-only. | Money/UI checks keep USD primary; no data rewrite test is required beyond no schema CNY persistence. | `npx tsc --noEmit` and Plan 04-05 source gate |
| D-16 | CNY is computed from current cache and no frozen CNY columns are added. | Money tests cover USD-to-CNY conversion direction; source gate rejects CNY persistence columns. | `npx vitest run src/lib/money.test.ts` |
| D-17 | Missing CNY rate shows a graceful fallback while preserving USD display. | UI display check and manual check cover fallback text; type check protects render path. | `npx tsc --noEmit` and manual UI check |

---

## Per-Plan Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | ACCT-02, ACCT-03, SPACE-05 | T-04-01-TAMPER / T-04-01-INFO | Schema excludes credential fields and defines child FK cascade plus mother seat defaults. | type/schema | `npx tsc --noEmit` | existing source, new schema edits | pending |
| 04-01-02 | 01 | 1 | SPACE-05 | T-04-01-TAMPER | Migration contains child FK cascade and defaulted mother seat columns. | migration inspection | `npx drizzle-kit generate` plus migration source assertion | new migration | pending |
| 04-01-03 | 01 | 1 | ACCT-02, ACCT-03, SPACE-05 | T-04-01-TAMPER | DB helpers isolate spaces and prove no child/mother orphans after parent delete. | DB integration | `npx vitest run src/db/childAccounts.query.test.ts src/db/spaces.query.test.ts` | Wave 0 creates `src/db/childAccounts.query.test.ts` | pending |
| 04-02-01 | 02 | 2 | ACCT-02, ACCT-03 | T-04-02-TAMPER / T-04-02-INFO | Zod schemas whitelist child and mother fields. | type/validation | `npx tsc --noEmit` | new validation modules | pending |
| 04-02-02 | 02 | 2 | ACCT-02, ACCT-03 | T-04-02-TAMPER / T-04-02-DOS | Server Actions validate payloads, block no-rate saves, preserve/refreeze snapshots correctly, and ignore credential-looking keys. | action integration | `npx vitest run src/actions/childAccounts.test.ts src/db/childAccounts.query.test.ts` | Wave 0 creates `src/actions/childAccounts.test.ts` | pending |
| 04-03-01 | 03 | 3 | ACCT-02, ACCT-03 | T-04-03-INFO | UI exposes only non-credential child fields in table/dialog/delete flows. | type/source/manual | `npx tsc --noEmit` plus child form source assertion | new UI files | pending |
| 04-03-02 | 03 | 3 | ACCT-02, ACCT-03 | T-04-03-SPOOF | Detail route validates numeric ID and wires child table plus mother seat card. | type/source | `npx tsc --noEmit` plus detail-page source assertion | modified detail page | pending |
| 04-04-01 | 04 | 4 | SPACE-05 | T-04-04-TAMPER / T-04-04-DATA | Delete action validates exact name server-side and transactional delete leaves no orphans. | DB/action integration | `npx vitest run src/db/spaces.query.test.ts src/actions/spaces.test.ts src/db/childAccounts.query.test.ts` | existing tests extended | pending |
| 04-04-02 | 04 | 4 | SPACE-05 | T-04-04-REP | Delete dialog uses typed confirmation and names the full cascade scope. | type/source/manual | `npx tsc --noEmit` plus space delete dialog source assertion | new UI file | pending |
| 04-05-01 | 05 | 5 | SPACE-05 support, D-15..D-17 | T-04-05-TAMPER | USD-to-CNY reference conversion uses the correct inverted rate direction and integer math. | unit | `npx vitest run src/lib/money.test.ts` | existing test extended | pending |
| 04-05-02 | 05 | 5 | SPACE-05 support, D-15..D-17 | T-04-05-DOS | Missing CNY rate preserves USD display and shows fallback without CNY persistence columns. | type/source/manual | `npx tsc --noEmit` plus CNY source assertion | modified list/detail UI | pending |
| 04-05-03 | 05 | 5 | ACCT-02, ACCT-03, SPACE-05 | all Phase 04 mitigated threats | Integrated phase passes tests, type check, lint, and production build. | full gate | `npm test`; `npx tsc --noEmit`; `npm run lint`; `npm run build` | existing config | pending |

---

## Wave 0 Requirements

- [ ] `src/db/childAccounts.query.test.ts` - child CRUD, per-space isolation, mother seat update coverage, and FK cascade coverage.
- [ ] `src/actions/childAccounts.test.ts` - action validation, no-rate block, snapshot preservation/refreeze, delete, invalid IDs, and mass-assignment protection.
- [ ] Extend `src/actions/spaces.test.ts` - typed-name cascade delete action coverage.
- [ ] Extend `src/db/spaces.query.test.ts` - transactional `deleteSpaceCascade` mismatch/success and orphan checks.
- [ ] Extend `src/lib/money.test.ts` - USD-to-current-CNY conversion direction and invalid-rate coverage.

No framework install is needed; Vitest is already configured.

---

## Manual-Only Verifications

| Behavior | Requirement / Decision | Why Manual | Test Instructions |
|----------|------------------------|------------|-------------------|
| Child management placement and table/dialog UX | ACCT-02, ACCT-03, D-01, D-02 | Visual placement and row-action affordances require UI inspection. | Start the app, open `/spaces/[id]`, confirm child accounts appear only on the detail page with add/edit dialogs and row delete confirmation. |
| Mother seat editor usability | D-03, D-04, D-05 | Visual copy and switch/select placement require UI inspection. | On `/spaces/[id]`, edit the mother seat type and change permission flag, save, refresh, and verify values persist. |
| Space cascade delete confirmation copy | SPACE-05, D-12, D-13, D-14 | Destructive copy and exact-name interaction are user-facing safeguards. | Open the space delete dialog, verify the scope names space, mother, and children, confirm disabled state before exact name, then delete with exact name. |
| Current CNY reference display | D-15, D-16, D-17 | Relative visual priority and fallback copy require UI inspection. | Verify frozen USD remains primary; when CNY rate exists, current CNY is secondary; when missing, fallback appears and USD remains visible. |

---

## Phase Acceptance Gates

- [ ] `npx drizzle-kit generate` creates `drizzle/0004_*.sql` with `child_account`, `space_id` cascade, `mother_account.seat_type` default `'codex'`, and `mother_account.can_change_seat_type` default `true`.
- [ ] `npx vitest run src/db/childAccounts.query.test.ts src/db/spaces.query.test.ts` passes.
- [ ] `npx vitest run src/actions/childAccounts.test.ts src/actions/spaces.test.ts` passes.
- [ ] `npx vitest run src/lib/money.test.ts` passes.
- [ ] `npm test` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Manual UI checks above are completed before final verification sign-off.

---

## Validation Sign-Off

- [x] All planned tasks have `<automated>` verification commands.
- [x] Sampling continuity prevents three consecutive unverified tasks.
- [x] Wave 0 covers all test files that do not exist before execution.
- [x] No watch-mode flags are used in validation commands.
- [x] Requirements ACCT-02, ACCT-03, and SPACE-05 map to automated tests and manual checks.
- [x] Decisions D-01 through D-17 map to automated tests, source gates, or manual checks.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-06-28 for planning; `wave_0_complete` remains false until the listed test files are created/extended during execution.
