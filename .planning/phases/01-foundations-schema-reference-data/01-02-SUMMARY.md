---
phase: 01-foundations-schema-reference-data
plan: 02
subsystem: navigation-ui
tags: [nextjs, app-router, rsc, shadcn, sidebar, drizzle, sqlite, reference-data]

# Dependency graph
requires:
  - "01-01: Drizzle schema (currency table) + HMR-safe db singleton + 6 seeded currencies + shadcn components (sidebar/table/tooltip/sonner)"
provides:
  - "Persistent left-sidebar navigation shell (D-12) with active-route highlighting"
  - "Root layout shell mounting SidebarProvider + TooltipProvider + sonner Toaster"
  - "Dashboard (/) and Spaces (/spaces) placeholder routes"
  - "Read-only currency list RSC reading 6 currencies live from SQLite (REF-02 display side)"
affects: [reference-data-channels, space-crud, dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client nav component uses usePathname() for single-active-item highlighting"
    - "RSC reads SQLite directly via db singleton (Pattern 1 — no client fetch layer)"
    - "force-dynamic on DB-reading RSC keeps native better-sqlite3 on the Node runtime"
    - "Active nav state styled with accent tint via data-[active=true] (primary/10 + primary text)"

key-files:
  created:
    - src/components/nav/sidebar.tsx
    - src/app/spaces/page.tsx
    - src/app/reference-data/currencies/page.tsx
  modified:
    - src/app/layout.tsx
    - src/app/page.tsx

key-decisions:
  - "Wrapped sidebar shell in TooltipProvider in layout.tsx — radix-nova SidebarProvider does not include one, and SidebarMenuButton tooltip prop crashed next build"
  - "Currency RSC marked force-dynamic so the DB read runs at request time on the Node runtime (avoids static prerender of a native-module read)"
  - "Active highlight uses primary/10 tint per UI-SPEC (accent reserved for active nav item) rather than the default sidebar-accent"

requirements-completed: [REF-02]

coverage:
  - id: D-12
    description: "Persistent left sidebar with 仪表盘 / 空间 / 参考数据 (→ 支付渠道 / 币种), lucide icons, exactly one active item highlighted"
    requirement: "REF-02"
    verification:
      - kind: human
        ref: "Task 3 human-verify checkpoint — approved (nav shell + active highlighting confirmed)"
        status: pass
    human_judgment: true
  - id: REF-02-display
    description: "Read-only currency list renders 6 seeded currencies live from SQLite (JPY minor_unit=0, others=2) with read-only caption"
    requirement: "REF-02"
    verification:
      - kind: integration
        ref: "npx next build — /reference-data/currencies compiled as dynamic RSC; db.select from currency table"
        status: pass
      - kind: human
        ref: "Task 3 checkpoint — 6 rows (USD/CNY/EUR/GBP/JPY/HKD), JPY=0/others=2, caption confirmed"
        status: pass
    human_judgment: true

# Metrics
duration: ~15min
completed: 2026-06-28
status: complete
---

# Phase 1 Plan 02: Navigation Shell & Currency List Summary

**The working app shell — a persistent left-sidebar nav (仪表盘 / 空间 / 参考数据 → 支付渠道 / 币种) with active-route highlighting, plus a server-rendered read-only currency list that reads the 6 seeded currencies LIVE from SQLite (the walking skeleton's "one real DB read").**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-06-28
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files created/modified:** 5

## Accomplishments
- Built `AppSidebar` (client component): three nav groups with lucide icons (LayoutDashboard / Boxes / Database → CreditCard / Coins), Simplified-Chinese labels per UI-SPEC, and `usePathname()`-driven active highlighting (exactly one active item, accent tint).
- Rewired `src/app/layout.tsx` into the app shell: `SidebarProvider` + `SidebarInset` + `SidebarTrigger`, wrapped in `TooltipProvider`, with the sonner `Toaster` mounted at root for later plans; zh-CN lang + product metadata.
- Replaced the create-next-app default `page.tsx` with a Dashboard placeholder card and added the Spaces placeholder route.
- Implemented the read-only currency list RSC: reads all rows from the `currency` table via the `db` singleton (Pattern 1, no client fetch), renders a shadcn `table` with 代码 (mono) / 名称 / 最小单位位数 columns and the read-only caption.
- Verified end-to-end: `npx tsc --noEmit` clean, `npx next build` green, dev server boots, and the human-verify checkpoint passed.

## Task Commits

1. **Task 1: Left-sidebar nav shell + dashboard/spaces placeholders** - `69426eb` (feat)
2. **Task 2: Read-only currency list RSC (REF-02)** - `9296ad9` (feat)
3. **Task 3: Human-verify checkpoint** - approved (no code; verification gate)

## Files Created/Modified
- `src/components/nav/sidebar.tsx` - client `AppSidebar`; nav groups + lucide icons + usePathname active highlighting
- `src/app/layout.tsx` - app shell: SidebarProvider + TooltipProvider + SidebarInset/Trigger + sonner Toaster; zh-CN metadata
- `src/app/page.tsx` - Dashboard placeholder card (replaced create-next-app default)
- `src/app/spaces/page.tsx` - Spaces placeholder card
- `src/app/reference-data/currencies/page.tsx` - read-only currency list RSC (force-dynamic; db.select from currency)

## Decisions Made
- **TooltipProvider in layout:** the radix-nova `SidebarProvider` does not wrap its children in a `TooltipProvider`, so `SidebarMenuButton`'s `tooltip` prop (which renders a Radix `Tooltip`) crashed at prerender. Wrapped the shell in `TooltipProvider`.
- **force-dynamic currency RSC:** the page reads via the native better-sqlite3 singleton; marking it `force-dynamic` runs the read at request time on the Node runtime and avoids prerendering a native-module read (Pitfall 2 / threat T-02-EDGE mitigation).
- **Accent active styling:** active nav items use a `primary/10` background tint + `primary` text via `data-[active=true]`, honoring UI-SPEC's "accent reserved for the active sidebar item" rather than the default sidebar-accent gray.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing TooltipProvider crashed `next build`**
- **Found during:** Task 1 (verification — `npx next build`)
- **Issue:** `SidebarMenuButton`'s `tooltip` prop renders a Radix `Tooltip`, but the radix-nova `SidebarProvider` does not include a `TooltipProvider`. Build failed prerendering `/_not-found` with `Tooltip must be used within TooltipProvider`.
- **Fix:** Imported `TooltipProvider` from `@/components/ui/tooltip` and wrapped the sidebar shell (`SidebarProvider` + children) in it within `src/app/layout.tsx`.
- **Files modified:** src/app/layout.tsx
- **Verification:** `npx next build` succeeds (all 5 routes generated).
- **Committed in:** `69426eb` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (blocking). No scope creep.

## Threat Surface
- T-02-EDGE (DB read on Node runtime) mitigated: currency RSC uses the Node-only `db` singleton and is `force-dynamic` (no Edge runtime). No new security surface introduced — nav + read-only reference data only.

## Issues Encountered
- None beyond the TooltipProvider deviation above.

## User Setup Required
None.

## Next Phase Readiness
- Navigation shell + currency read slice complete (ROADMAP Success Criteria 1 & 3 met). The `参考数据 → 支付渠道` link (`/reference-data/channels`) is a plain href awaiting Plan 03's payment-channel maintenance screen.
- sonner `Toaster` is already mounted at root, ready for Plan 03's mutation toasts.

---
*Phase: 01-foundations-schema-reference-data*
*Completed: 2026-06-28*

## Self-Check: PASSED
All 5 created/modified files verified present; both task commits (69426eb, 9296ad9) verified in git history.
