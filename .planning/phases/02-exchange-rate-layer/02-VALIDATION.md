---
phase: 2
slug: exchange-rate-layer
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-28
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source of truth: `02-RESEARCH.md` § Validation Architecture (populated 2026-06-28).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.9 `[VERIFIED: package.json]` |
| **Config file** | none explicit (vitest defaults; `@/` alias resolves — see existing Phase 1 tests) |
| **Quick run command** | `pnpm test <touched test file>` (vitest run) |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~5 seconds (Phase 1 suite baseline) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test <the touched test file>`
- **After every plan wave:** Run `pnpm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01 | 01 | 1 | FX-01 | — | upsert writes all 6 rows; re-run upserts (no dup); USD stored as "1" | unit | `pnpm test src/db/fxRates.query.test.ts` | ❌ W0 | ⬜ pending |
| 02-02 | 02 | 2 | FX-01 | — | valid response → inverted X→USD rows cached, `stale:false` | unit | `pnpm test src/lib/fx/frankfurter.test.ts` | ❌ W0 | ⬜ pending |
| 02-02 | 02 | 2 | FX-01 | — | `ensureFreshRates`: fresh cache (<1d) does NOT fetch; empty/old DOES | unit | `pnpm test src/lib/fx/frankfurter.test.ts` | ❌ W0 | ⬜ pending |
| 02-02 | 02 | 2 | FX-01 | T-02-03 | inversion correctness + precision (CNY 6.7982 → ~0.14709) | unit | `pnpm test src/lib/fx/frankfurter.test.ts` | ❌ W0 | ⬜ pending |
| 02-02 | 02 | 2 | FX-03 | T-02-01 | fetch throws/timeout → cached rates + `stale:true`, DB unchanged | unit | `pnpm test src/lib/fx/frankfurter.test.ts` | ❌ W0 | ⬜ pending |
| 02-02 | 02 | 2 | FX-03 | T-02-01 | malformed/0/negative response → Zod rejects, NO write (no 0/NULL) | unit | `pnpm test src/lib/fx/frankfurter.test.ts` | ❌ W0 | ⬜ pending |
| 02-02 | 02 | 2 | FX-03 | — | empty cache + failed fetch → no crash, `rates:[]`, no fake zeros | unit | `pnpm test src/lib/fx/frankfurter.test.ts` | ❌ W0 | ⬜ pending |
| 02-03 | 03 | 3 | FX-01 | — | `refreshRates` Server Action persists rows (mirror channels.test.ts) | unit | `pnpm test src/actions/fx.test.ts` | ❌ W0 | ⬜ pending |
| 02-03 | 03 | 3 | FX-01/03 | — | persistence across restarts; manual refresh shows updated "as of" | manual | open Rates screen, click 刷新汇率, restart app, verify rows persist | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Mocking notes: `fetch` mocked in service tests via `vi.stubGlobal("fetch", vi.fn())` (or `vi.spyOn(globalThis,"fetch")`). DB tests use `createTestDb()`; Server Action tests use the `vi.mock("@/db")` + `vi.mock("next/cache")` pattern from `src/actions/channels.test.ts`.

---

## Wave 0 Requirements

- [ ] `src/db/fxRates.query.test.ts` — covers FX-01 (upsert/list/recent)
- [ ] `src/lib/fx/frankfurter.test.ts` — covers FX-01 + FX-03 (mock fetch: success / timeout / malformed / empty-cache)
- [ ] `src/actions/fx.test.ts` — covers FX-01 Server Action (mirror channels.test.ts mocks)

*No framework install needed — vitest already configured and green in Phase 1.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Persistence across restarts; manual refresh updates "as of" | FX-01/FX-03 | Requires running app + visual confirmation of the Rates screen | Open `/reference-data/rates`, click 刷新汇率, restart app, verify rows persist and "as of" timestamp updates |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (3 test files scaffolded test-first)
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-28 (populated from RESEARCH § Validation Architecture during plan-phase verification; `wave_0_complete` flips true once the three test files are scaffolded in execution Wave 0)
