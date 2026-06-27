---
phase: 01-foundations-schema-reference-data
plan: 03
subsystem: reference-data-channels
tags: [nextjs, server-actions, rsc, drizzle, sqlite, zod, react-hook-form, shadcn, soft-delete]

# Dependency graph
requires:
  - "01-01: paymentChannel schema (surrogate id + is_active), db singleton, vitest harness (src/test/db-harness.ts)"
  - "01-02: app shell (SidebarProvider + TooltipProvider + sonner Toaster), 参考数据 → 支付渠道 nav link"
provides:
  - "Channel Server Actions addChannel/renameChannel/archiveChannel/reactivateChannel (server-side Zod re-validation, uniform soft-delete, no hard-delete)"
  - "Shared channelSchema + channelIdSchema (client RHF + server)"
  - "Parameterized Drizzle channel helpers (src/db/channels.ts: insert/rename/setActive/findActiveByName/listChannels)"
  - "支付渠道 maintenance screen: RSC list (active/show-archived), add/rename dialog, neutral archive confirm, reactivate, sonner toasts"
affects: [space-crud, new-space-channel-picker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "'use server' action wraps parameterized Drizzle helpers + Zod re-parse + revalidatePath (Server Action = public endpoint, never trust client validation)"
    - "Query/mutation helpers take explicit db so they run against both the prod singleton and the in-memory test harness"
    - "Uniform soft-delete: removal flips is_active; there is no db.delete path (D-06), FK integrity preserved (D-07)"
    - "RSC reads via searchParams (?archived=1) → URL-driven show-archived toggle re-renders the filtered server list"
    - "Controlled shadcn Dialog/AlertDialog driven by parent table state; useTransition for pending submit + toasts"
    - "Reversible action (archive) uses a NEUTRAL confirm button — destructive/red reserved for the genuine Phase 4 cascade delete"

key-files:
  created:
    - src/lib/validation/channel.ts
    - src/db/channels.ts
    - src/actions/channels.ts
    - src/actions/channels.test.ts
    - src/db/channels.query.test.ts
    - src/app/reference-data/channels/page.tsx
    - src/components/channels/channel-table.tsx
    - src/components/channels/channel-dialog.tsx
    - src/components/channels/archive-dialog.tsx
  modified: []

key-decisions:
  - "Query/mutation helpers live in src/db/channels.ts (not the action file) because a 'use server' module may only export async functions — this also lets the action tests run against the in-memory harness"
  - "addChannel/renameChannel enforce a duplicate-active-name guard (UI-SPEC error 已存在同名的有效渠道。) — surfaced inline on the form field"
  - "Actions return { ok } | { ok:false, error } so the client surfaces inline validation/duplicate errors vs a sonner toast for unexpected failures"
  - "Icon-only row actions use className=size-11 (44px) to honor the UI-SPEC hit-area exception"

requirements-completed: [REF-01]

coverage:
  - id: REF-01-actions
    description: "Channel add/rename/archive/reactivate Server Actions with server-side Zod re-validation; uniform soft-delete preserves the row; active vs show-all filter; rename keeps surrogate id"
    requirement: "REF-01"
    verification:
      - kind: integration
        ref: "npx vitest run src/actions/channels.test.ts src/db/channels.query.test.ts — 11 tests pass (add inserts; archive preserves row + excluded from active; reactivate restores; rename keeps id; empty/duplicate rejected)"
        status: pass
    human_judgment: false
  - id: REF-01-no-hard-delete
    description: "No hard-delete path — every removal flips is_active (D-06); FK integrity preserved (D-07)"
    verification:
      - kind: integration
        ref: "grep -c db.delete src/actions/channels.ts = 0; soft-delete test asserts row count unchanged after archive"
        status: pass
    human_judgment: false
  - id: REF-01-ui
    description: "支付渠道 screen: empty state, add/rename dialog (RHF+zodResolver, pending state), neutral archive confirm, 显示已归档 toggle, reactivate, toasts"
    requirement: "REF-01"
    verification:
      - kind: build
        ref: "npx tsc --noEmit clean; npx next build green with /reference-data/channels dynamic route"
        status: pass
      - kind: human
        ref: "Task 3 human-verify checkpoint — approved (add/rename/archive with neutral button/show-archived/reactivate confirmed; correct toasts)"
        status: pass
    human_judgment: true

# Metrics
duration: ~15min
completed: 2026-06-28
status: complete
---

# Phase 1 Plan 03: Payment-Channel Maintenance Summary

**The walking skeleton's real write slice (REF-01): a 支付渠道 screen where the user adds, renames, archives (uniform soft-delete), and reactivates payment channels — persisted to SQLite through `'use server'` Server Actions with server-side Zod re-validation, referenced by stable surrogate id + FK, with a 显示已归档 affordance and no hard-delete path.**

## Performance

- **Duration:** ~15 min active execution (plus the human-verify gate)
- **Completed:** 2026-06-28
- **Tasks:** 3 (1 TDD + 1 auto + 1 human-verify checkpoint)
- **Files created:** 9

## Accomplishments
- Implemented four channel Server Actions (`addChannel`, `renameChannel`, `archiveChannel`, `reactivateChannel`), each `'use server'`, each re-parsing input with Zod server-side (parsing only the known `name`/`id` — no mass-assignment), each calling `revalidatePath('/reference-data/channels')`.
- Uniform soft-delete (D-06): archive/reactivate flip `is_active`; there is **no** `db.delete` call — the row is always preserved, keeping future-space FK integrity (D-07).
- Shared `channelSchema` (trimmed non-empty name) + `channelIdSchema` reused by the client RHF form and the server actions.
- Parameterized Drizzle helpers in `src/db/channels.ts` (`listChannels` active-only vs show-all, `insertChannel`, `renameChannelRow`, `setChannelActive`, `findActiveByName`).
- Built the 支付渠道 UI: RSC list filtered by `is_active` (with `?archived=1` show-archived), empty state, add/rename `dialog` (RHF + `zodResolver`, pending submit), `alert-dialog` archive confirm with a **neutral** 归档 button (reversible — not destructive/red), per-row 重命名/归档 and 恢复 for archived rows, `已归档` badge + muted row tint, accessible icon buttons (aria-label + tooltip, 44px hit area), and sonner toasts on every mutation.
- TDD: committed failing tests (RED) then the implementation (GREEN); full suite green (20 tests across 4 files), `tsc --noEmit` clean, `next build` succeeds with `/reference-data/channels` as a dynamic route.

## Task Commits

1. **Task 1 (TDD RED): failing channel query + action tests** - `48554c1` (test)
2. **Task 1 (TDD GREEN): Server Actions + shared Zod schema + Drizzle helpers** - `9b3ca2d` (feat)
3. **Task 2: channel maintenance UI (table, dialogs, show-archived)** - `2d5b328` (feat)
4. **Task 3: human-verify checkpoint** - approved (no code; verification gate)

## Files Created
- `src/lib/validation/channel.ts` - `channelSchema` + `channelIdSchema` (shared client/server)
- `src/db/channels.ts` - parameterized Drizzle channel helpers (take explicit db; soft-delete only)
- `src/actions/channels.ts` - `'use server'` add/rename/archive/reactivate; Zod re-parse + revalidatePath; duplicate-active-name guard
- `src/actions/channels.test.ts` - action tests against in-memory harness (mocked `@/db` + `next/cache`)
- `src/db/channels.query.test.ts` - query/soft-delete/filter tests
- `src/app/reference-data/channels/page.tsx` - RSC list (force-dynamic; active vs `?archived=1`)
- `src/components/channels/channel-table.tsx` - client table, 显示已归档 switch, row actions, empty state, toasts
- `src/components/channels/channel-dialog.tsx` - add/rename `dialog` (RHF + zodResolver, pending state)
- `src/components/channels/archive-dialog.tsx` - `alert-dialog` archive confirm (neutral button)

## Decisions Made
- **Helpers in `src/db/channels.ts`:** a `'use server'` module may only export async functions, so the synchronous parameterized Drizzle helpers live in a dedicated query module — which also lets the action tests inject the in-memory harness db.
- **Action return shape `{ ok } | { ok:false, error }`:** lets the client distinguish recoverable validation/duplicate errors (shown inline on the field) from unexpected failures (sonner `保存失败,请重试。`).
- **Neutral archive confirm:** archive is reversible (D-06/D-08), so the confirm uses `variant="secondary"`, honoring the UI-SPEC Color note that reserves destructive/red for Phase 4's genuine cascade delete.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `src/db/channels.ts` query-helper module (not in the planned file list)**
- **Found during:** Task 1 (designing testable actions)
- **Issue:** A `'use server'` module can only export async functions, so the synchronous Drizzle query/mutation helpers cannot live in `src/actions/channels.ts`; the action tests also need to run those helpers against the in-memory harness.
- **Fix:** Created `src/db/channels.ts` holding the parameterized helpers; the actions and `channels.query.test.ts` both import from it.
- **Files:** src/db/channels.ts
- **Verification:** vitest green; `tsc --noEmit` clean; within the CONTEXT "Drizzle file organization is Claude's discretion" latitude.
- **Committed in:** `9b3ca2d`

**2. [Rule 2 - Missing functionality] Duplicate-active-name guard**
- **Found during:** Task 1 (UI-SPEC error-state contract review)
- **Issue:** The UI-SPEC defines the validation error `已存在同名的有效渠道。`, but the plan's `<action>` did not spell out duplicate enforcement. Without it that contract copy is unreachable and duplicate active channels could be created.
- **Fix:** `addChannel`/`renameChannel` call `findActiveByName` and return `{ ok:false, error:"已存在同名的有效渠道。" }` (rename excludes the same row); the form surfaces it inline. Covered by a test.
- **Files:** src/actions/channels.ts, src/actions/channels.test.ts
- **Verification:** "rejects a duplicate active name" test passes.
- **Committed in:** `9b3ca2d`

**3. [Rule 3 - Blocking] Corrupted dev server `.next` from concurrent build + dev**
- **Found during:** Task 3 prep (readying the verification environment)
- **Issue:** Running `npx next build` (Task 2 verify) wrote to the same `.next` directory the prior plan's dev server (port 3000) was using, putting Turbopack into an internal-error state — both `/reference-data/channels` and the previously-working `/reference-data/currencies` returned HTTP 500.
- **Fix:** Killed the stale dev process (PID 15492), cleared `.next`, and restarted `npm run dev`; the channels route then served HTTP 200 with the empty state, making the checkpoint verifiable.
- **Files:** none (environment only)
- **Verification:** `curl /reference-data/channels` → 200; human-verify checkpoint subsequently approved.
- **Committed in:** n/a (no code change)

---

**Total deviations:** 3 (2 blocking, 1 missing-functionality). No scope creep.

## Threat Surface
- T-03-INPUT / T-03-MASS mitigated: every action re-parses with `channelSchema`/`channelIdSchema`, parsing only known fields.
- T-03-SQLI mitigated: all access via Drizzle parameterized builders — no string-concatenated SQL.
- T-03-DEL mitigated: `grep -c db.delete src/actions/channels.ts = 0` — uniform soft-delete, FK integrity preserved.
- No new trust boundary beyond the planned browser → Server Action → SQLite path.

## Known Stubs
None — the screen is fully wired to live SQLite writes/reads.

## User Setup Required
None.

## Next Phase Readiness
- REF-01 complete: the new-space picker (Phase 3) can query active channels via `listChannels(db, false)` / `is_active = 1`.
- ROADMAP Success Criterion 2 met (add/rename/remove by stable id; soft-delete only). Phase 1 reference-data slice is complete.

---
*Phase: 01-foundations-schema-reference-data*
*Completed: 2026-06-28*

## Self-Check: PASSED
All 9 created files verified present on disk; all 3 task commits (48554c1, 9b3ca2d, 2d5b328) verified in git history; vitest full suite (20 tests) green; `tsc --noEmit` clean; `next build` includes `/reference-data/channels`.
