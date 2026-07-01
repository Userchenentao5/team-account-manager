---
phase: 5
slug: dashboard-overview
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-30
---

# Phase 5 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source of truth: `05-RESEARCH.md` - Validation Architecture, plus `05-CONTEXT.md` and `05-UI-SPEC.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- src/db/dashboard.query.test.ts` |
| Full suite command | `npm test` |
| Lint | `npm run lint` |
| Build | `npm run build` |
| Estimated quick latency | Under 60 seconds for targeted Vitest commands |

---

## Sampling Strategy

- After every task commit: run the targeted command named in that task's `<verify><automated>` block.
- After dashboard aggregate tasks: run `npm test -- src/db/dashboard.query.test.ts`.
- After UI integration tasks: run `npm run lint` and `npm run build`.
- After every plan wave: run the plan-level checks listed in the plan's `<verification>` block.
- Before Phase 05 UAT or `$gsd-verify-work`: run `npm test`, `npm run lint`, and `npm run build`.
- Max feedback gap: no three consecutive tasks may complete without an automated command run.
- Do not use Jest-only flags such as `--runInBand`; this project uses Vitest.

---

## Requirement Validation Map

| Req ID | Behavior | Planned Test / Check | Automated Command | Manual Check | Phase Gate |
|--------|----------|----------------------|-------------------|--------------|------------|
| DASH-01 | Expired and soon-expiring spaces are counted, tiered, ordered with expired first, and normal spaces are excluded from the risk list. | `src/db/dashboard.query.test.ts` covers expiry status buckets and list ordering over stored expiry dates. | `npm test -- src/db/dashboard.query.test.ts` | Open `/` and confirm the expiring section appears before distributions with tiered status labels. | Dashboard query test and build green |
| DASH-02 | Total spend converted to USD reconciles exactly from stored frozen USD fields, with separate space payment and child monthly subtotals. | `src/db/dashboard.query.test.ts` asserts integer-minor USD totals from `space.amountUsd` and `childAccount.monthlyAmountUsd` without join double-counting. | `npm test -- src/db/dashboard.query.test.ts` | Compare total, space subtotal, and child subtotal displayed on `/`; verify they reconcile to the grand total. | Dashboard query test and build green |
| DASH-03 | Spend distribution by country, currency, and payment channel reconciles to the dashboard grand total. | `src/db/dashboard.query.test.ts` covers bucket totals and reconciliation for all three distribution dimensions. | `npm test -- src/db/dashboard.query.test.ts` | Open `/` and confirm CSS bar/list distributions render without a chart package. | Dashboard query test and build green |
| DASH-04 | Count overviews include spaces, child accounts, status counts, and seat-type counts. | `src/db/dashboard.query.test.ts` covers summary counts returned by the aggregate facade. | `npm test -- src/db/dashboard.query.test.ts` | Open `/` and confirm count cards are visible without mutation controls. | Dashboard query test and build green |

---

## Decision Validation Map

| Decision | Coverage | Planned Test / Check | Command / Gate |
|----------|----------|----------------------|----------------|
| D-01 | Root dashboard is the default working surface. | `/` imports the dashboard aggregate facade and renders the overview as the first screen. | `npm run build` plus source assertion in the dashboard UI plan |
| D-02 | Dashboard is read-only and links to existing detail/list routes for edits. | UI source contains links but no create/update/delete Server Action form wiring. | `npm run build` plus source assertion rejecting mutation controls on `/` |
| D-03 | All monetary totals use stored frozen USD fields. | Query tests assert no live FX recomputation and totals come from stored USD integer fields. | `npm test -- src/db/dashboard.query.test.ts` |
| D-04 | Space and child-account USD subtotals are aggregated separately to avoid join double-counting. | Query tests seed spaces with multiple children and assert exact separate subtotals and grand total. | `npm test -- src/db/dashboard.query.test.ts` |
| D-05 | No new chart package is introduced for Phase 05. | Source/package assertions verify CSS bar/list implementations and no dependency additions. | `npm run build` plus package/source assertion in the UI plan |
| D-06 | Root dashboard becomes dynamic when it reads SQLite. | `src/app/page.tsx` exports `dynamic = "force-dynamic"` or equivalent route behavior after DB import. | `npm run build` plus source assertion in the integration plan |

---

## Per-Plan Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | DASH-01, DASH-02, DASH-03, DASH-04 | T-05-01-TAMPER / T-05-01-INFO | Aggregate facade returns derived dashboard data without credential fields, live FX calls, or join double-counting. | DB unit | `npm test -- src/db/dashboard.query.test.ts` | Wave 0 creates `src/db/dashboard.query.test.ts` | pending |
| 05-01-02 | 01 | 1 | DASH-01, DASH-02, DASH-03, DASH-04 | T-05-01-DOS | Query facade handles empty and partial data sets with stable zero/fallback values. | DB unit | `npm test -- src/db/dashboard.query.test.ts` | Wave 0 creates `src/db/dashboard.query.test.ts` | pending |
| 05-02-01 | 02 | 2 | DASH-01, DASH-02, DASH-04 | T-05-02-INFO | Root dashboard renders read-only overview data without mutation controls or sensitive fields. | build/source/manual | `npm run lint`; `npm run build` | modified root page and optional dashboard components | pending |
| 05-02-02 | 02 | 2 | DASH-03 | T-05-02-INFO | Distribution UI renders accessible CSS bar/list summaries without adding chart dependencies. | build/source/manual | `npm run lint`; `npm run build` | modified root page and optional dashboard components | pending |
| 05-03-01 | 03 | 3 | DASH-01, DASH-02, DASH-03, DASH-04 | all Phase 05 mitigated threats | Integrated dashboard passes query tests, lint, production build, and manual visual checks. | full gate | `npm test`; `npm run lint`; `npm run build` | existing config | pending |

---

## Wave 0 Requirements

- [ ] `src/db/dashboard.query.test.ts` - covers DASH-01, DASH-02, DASH-03, and DASH-04.
- [ ] `src/db/dashboard.ts` - read-only dashboard aggregate facade under the existing explicit-db pattern.
- [ ] `src/components/dashboard/` - focused presentational components if `src/app/page.tsx` would otherwise become too large.
- [ ] Source/package assertion for no new chart dependency and no dashboard mutation controls.

No framework install is needed; Vitest is already configured.

---

## Manual-Only Verifications

| Behavior | Requirement / Decision | Why Manual | Test Instructions |
|----------|------------------------|------------|-------------------|
| Dashboard scan order and emphasis | DASH-01, DASH-02, DASH-04, D-01 | The UI spec requires first-viewport metric hierarchy and expiring-risk priority that need visual inspection. | Start the app, open `/`, and confirm metrics appear first, expiring/expired spaces are prominent, and no section feels like a marketing landing page. |
| Monetary reconciliation display | DASH-02, DASH-03, D-03, D-04 | Exact numbers are automated, but subtotal labeling and scan clarity are visual. | Compare space USD subtotal, child monthly USD subtotal, grand total, and distribution totals on `/`; confirm labels make the reconciliation clear. |
| Distribution presentation | DASH-03, D-05 | CSS bar/list density and overflow behavior need browser inspection. | Confirm country, currency, and payment-channel distributions render without chart-package visuals and remain readable at desktop and mobile widths. |
| Read-only dashboard behavior | DASH-04, D-02, D-06 | Navigation affordances and absence of mutation controls are user-facing safeguards. | Confirm `/` has only links into existing detail/list workflows and no create/edit/delete forms or buttons. |

---

## Phase Acceptance Gates

- [ ] `npm test -- src/db/dashboard.query.test.ts` passes.
- [ ] `npm test` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Source/package assertion confirms no new chart dependency.
- [ ] Source assertion confirms root dashboard is dynamic when reading SQLite.
- [ ] Manual UI checks above are completed before final verification sign-off.

---

## Validation Sign-Off

- [x] All planned tasks have `<automated>` verification commands or explicit manual checks.
- [x] Sampling continuity prevents three consecutive unverified tasks.
- [x] Wave 0 covers all test files and aggregate modules that do not exist before execution.
- [x] No watch-mode flags or Jest-only flags are used in validation commands.
- [x] Requirements DASH-01, DASH-02, DASH-03, and DASH-04 map to automated tests and manual checks.
- [x] Dashboard decisions map to automated tests, source gates, build gates, or manual checks.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-06-30 for planning; `wave_0_complete` remains false until the listed test files and dashboard modules are created during execution.
