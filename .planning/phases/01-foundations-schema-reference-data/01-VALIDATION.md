---
phase: 1
slug: foundations-schema-reference-data
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-27
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **Vitest** + a DB-level migration assertion (in-memory `:memory:` SQLite per test) |
| **Config file** | `vitest.config.ts` — none yet; installed in Wave 0 (01-01 Task 1) |
| **Quick run command** | `npx vitest run src/db` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

> Vitest is the chosen framework (Vite/TS-native ESM; integrates cleanly with better-sqlite3 via an in-memory or temp-file DB per test). Jest is an acceptable alternative but not used here.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/db` (fast schema/seed/query checks)
- **After every plan wave:** Run `npx vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite green + `npm run db:migrate` exits 0 with all 6 currencies present
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | (env/scaffold) | T-01-SC | better-sqlite3 prebuilt binary loads (no source compile) on Node LTS | smoke | `node -e "require('better-sqlite3')(':memory:').close()"` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | (schema) | T-01-EDGE | Money round-trips as integer minor units; JPY (0dp) formats correctly; DB code stays Node-runtime | unit | `npx vitest run src/lib/money.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | REF-02 / (SC-4) | T-01-DB | Migration applies cleanly + all tables exist; 6 currencies seeded with correct `minor_unit` (JPY=0); idempotent | integration | `npm run db:migrate && npm run db:seed && npx vitest run src/db/seed.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 2 | (SC-1) | T-02-EDGE | Nav shell renders; build passes | build | `npx next build` | n/a | ⬜ pending |
| 1-02-02 | 02 | 2 | REF-02 | T-02-READ | Currency list server-renders 6 rows live from SQLite (read-only RSC) | build + manual | `npx next build` + human-verify | n/a | ⬜ pending |
| 1-03-01 | 03 | 2 | REF-01 | T-03-INPUT / T-03-DEL | `addChannel` inserts; `archiveChannel` flips `is_active` (row preserved); reactivate restores; rename keeps id; active vs archived filter; Zod re-validated server-side | integration | `npx vitest run src/actions/channels.test.ts src/db/channels.query.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 2 | REF-01 | T-03-INPUT | Channel maintenance UI builds; archive confirm neutral; show-archived toggle | build + manual | `npx next build` + human-verify | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` install + `vitest.config.ts` (node environment, globals on) — 01-01 Task 1
- [ ] `src/test/db-harness.ts` — in-memory `:memory:` SQLite, runs `migrate()` + `foreign_keys = ON`, shared by tests — 01-01 Task 1
- [ ] `src/lib/money.test.ts` — integer-minor-unit round-trip incl. JPY (exponent 0) — 01-01 Task 2
- [ ] `src/db/seed.test.ts` — REF-02: 6 currencies, JPY `minor_unit=0`, idempotency (run-twice) — 01-01 Task 3
- [ ] `src/actions/channels.test.ts` — REF-01: add inserts; archive soft-deletes (row preserved); reactivate restores; rename keeps id — 01-03 Task 1
- [ ] `src/db/channels.query.test.ts` — active-only picker filter vs show-all — 01-03 Task 1

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App launches, sidebar renders, navigate to Reference Data | SC-1 | Visual layout / interactive nav | `npm run dev`; confirm sidebar groups 仪表盘/空间/参考数据, active highlight (01-02 checkpoint) |
| Currency list displays 6 seeded rows with correct exponents | REF-02 / SC-3 | Visual table render | `npm run dev` → 参考数据 → 币种; confirm USD/CNY/EUR/GBP/JPY/HKD, JPY minor-unit=0 (01-02 checkpoint) |
| Channel add/rename/archive/show-archived/reactivate flow | REF-01 / SC-2 | Interactive dialog + toast + soft-delete UX | `npm run dev` → 参考数据 → 支付渠道; exercise full flow (01-03 checkpoint) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter (strategy filled; all code tasks carry an `<automated>` verify or a Wave 0 dependency)

**Approval:** pending
