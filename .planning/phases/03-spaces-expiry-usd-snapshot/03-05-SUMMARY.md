---
phase: 03-spaces-expiry-usd-snapshot
plan: 05
subsystem: ui
tags: [nextjs, react-hook-form, shadcn, spaces]

requires:
  - phase: 03-spaces-expiry-usd-snapshot
    provides: space actions, validation, data helpers, expiry badge logic
provides:
  - Space list route and URL-driven filters
  - Space create/edit dialog
  - Space detail route with frozen USD snapshot
  - Human UAT checklist for visual verification
affects: [phase-04-child-accounts, phase-05-dashboard]

tech-stack:
  added: []
  patterns: [force-dynamic RSC, client dialog form, URL search param filters]

key-files:
  created:
    - src/components/spaces/expiry-badge.tsx
    - src/components/spaces/space-form.tsx
    - src/components/spaces/space-table.tsx
    - src/components/spaces/space-detail-actions.tsx
    - src/app/spaces/[id]/page.tsx
    - src/lib/currencies.ts
    - .planning/phases/03-spaces-expiry-usd-snapshot/03-UAT.md
  modified:
    - src/app/spaces/page.tsx
    - src/db/spaces.ts
    - src/db/seed.ts

key-decisions:
  - "Create/edit uses a dialog to mirror the existing payment-channel slice."
  - "Currency seed data now lives in client-safe src/lib/currencies.ts; db/seed.ts re-exports it for DB seeding."

patterns-established:
  - "Client components must not import db/seed.ts because it pulls better-sqlite3 into the browser bundle."
  - "Detail edit action is isolated in a client component while the page remains a force-dynamic RSC."

requirements-completed: [SPACE-01, SPACE-02, SPACE-03, SPACE-04]

coverage:
  - id: D1
    description: "`/spaces` renders a force-dynamic, URL-filtered list backed by joined space rows."
    requirement: SPACE-02
    verification:
      - kind: other
        ref: "npm run build"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit"
        status: pass
    human_judgment: true
    rationale: "Visual list behavior and filter affordances require browser walkthrough."
  - id: D2
    description: "Space form creates/edits spaces with amount major-unit input converted to minor units and action errors surfaced inline/toast."
    requirement: SPACE-01
    verification:
      - kind: other
        ref: "npm run build"
        status: pass
    human_judgment: true
    rationale: "Toast and dialog behavior require human UI verification."
  - id: D3
    description: "`/spaces/[id]` shows mother account, expiry badge, original amount, frozen USD amount, as-of label, and child-account placeholder."
    requirement: SPACE-03
    verification:
      - kind: other
        ref: "npm run build"
        status: pass
    human_judgment: true
    rationale: "Visual detail layout requires browser walkthrough."
  - id: D4
    description: "Edit UI exposes name-only and amount/currency update paths for freeze semantics."
    requirement: SPACE-04
    verification:
      - kind: integration
        ref: "src/actions/spaces.test.ts#preserves frozen snapshot and re-freezes cases"
        status: pass
    human_judgment: true
    rationale: "Action semantics are automated; UI edit flow still requires human walkthrough."

duration: 25min
completed: 2026-06-28
status: human_verification_pending
---

# Phase 3 Plan 05: Space UI Summary

**Space list, create/edit dialog, detail page, and expiry badge wired to the frozen USD action pipeline**

## Performance

- **Duration:** 25 min
- **Started:** 2026-06-28T04:42:00Z
- **Completed:** 2026-06-28T05:07:00Z
- **Tasks:** 4
- **Files modified:** 10

## Accomplishments

- Added `ExpiryBadge` with expired / soon / normal labels.
- Added `SpaceForm` create/edit dialog using RHF, Zod, shadcn controls, action result handling, and amount conversion.
- Added `SpaceTable` with URL-driven country/channel filters, true-empty and filtered-empty states, right-aligned money columns, and edit affordances.
- Replaced `/spaces` placeholder with a force-dynamic RSC backed by `listSpaceDetails`.
- Added `/spaces/[id]` detail page with mother account, expiry badge, original amount, frozen USD amount, as-of label, and child-account placeholder.
- Added `03-UAT.md` for the required human visual verification.

## Task Commits

Each task was executed in the working tree; commits were not created because this Codex run is operating inline rather than as a GSD executor subagent.

1. **Task 1: expiry-badge.tsx + space-form.tsx** - pending commit
2. **Task 2: space-table.tsx + list page** - pending commit
3. **Task 3: detail page /spaces/[id]** - pending commit
4. **Task 4: Human visual verification** - pending user approval

## Files Created/Modified

- `src/components/spaces/expiry-badge.tsx` - Tri-state expiry badge.
- `src/components/spaces/space-form.tsx` - Create/edit dialog.
- `src/components/spaces/space-table.tsx` - List table, filters, empty states.
- `src/components/spaces/space-detail-actions.tsx` - Detail-page edit dialog trigger.
- `src/app/spaces/page.tsx` - Force-dynamic list route.
- `src/app/spaces/[id]/page.tsx` - Force-dynamic detail route.
- `src/db/spaces.ts` - Adds joined list rows for UI.
- `src/lib/currencies.ts` and `src/db/seed.ts` - Split client-safe currency constants from DB seeding.
- `.planning/phases/03-spaces-expiry-usd-snapshot/03-UAT.md` - Human verification checklist.

## Decisions Made

- Split currency constants into `src/lib/currencies.ts` after build revealed that importing `src/db/seed.ts` from a client component pulled `better-sqlite3` into the browser bundle.
- Added `listSpaceDetails` so UI list rows include mother account/payment channel/currency data without client-side DB lookups.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed DB seed import from client components**
- **Found during:** `npm run build`
- **Issue:** Client components imported `CURRENCY_SEED` from `src/db/seed.ts`, causing `better-sqlite3` and Node `fs` to enter the browser bundle.
- **Fix:** Moved currency constants to `src/lib/currencies.ts` and made `src/db/seed.ts` re-export that pure data.
- **Files modified:** `src/lib/currencies.ts`, `src/db/seed.ts`, `src/components/spaces/space-form.tsx`, `src/components/spaces/space-table.tsx`
- **Verification:** `npm run build` passed.
- **Committed in:** pending commit

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** UI behavior unchanged; client/server boundary is now correct.

## Issues Encountered

- Browser automation could not connect due to a runtime metadata error (`sandboxPolicy` missing). Human UAT remains pending in `03-UAT.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Implementation is build/test clean. Human visual verification must be completed before Phase 3 can be marked fully verified.

---
*Phase: 03-spaces-expiry-usd-snapshot*
*Completed: 2026-06-28*
