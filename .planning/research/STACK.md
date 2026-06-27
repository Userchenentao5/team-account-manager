# Stack Research

**Domain:** Single-user internal CRUD + dashboard tool (subscription/asset accounting, multi-currency)
**Researched:** 2026-06-27
**Confidence:** HIGH (versions verified against npm registry on research date; FX API verified against official docs)

## TL;DR (Prescriptive)

Build **one** Next.js 16 full-stack app. No separate backend, no DB server, no auth system.

- **App:** Next.js 16 (App Router) + React 19 + TypeScript — frontend, API, and server logic in a single deployable unit.
- **Data:** SQLite (file on disk) via **Drizzle ORM** + **better-sqlite3**. Single-user → a DB server is pure overhead.
- **UI:** Tailwind CSS v4 + **shadcn/ui** (you own the component code) + lucide-react icons.
- **Charts:** **Recharts 3** (via shadcn/ui chart components) for the distribution/spend dashboard.
- **Validation:** Zod 4 (shared between forms and API) + React Hook Form.
- **Dates:** date-fns 4 for expiry = opening date + period math.
- **FX rates:** **Frankfurter** (frankfurter.dev) — free, no API key, no quotas, 201 currencies. Store rates in a table; refresh lazily on dashboard load + a manual "refresh rates" button. No cron infra needed.
- **Deploy:** `next build && next start` (Node runtime) on a small VPS / home server / Docker, SQLite file on a persistent disk. Backup = copy the `.db` file.

The single most important architectural rule: **keep it one process, one file database, zero distributed infrastructure.** This is a personal accounting tool, not a SaaS.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js (App Router) | 16.2.x | Full-stack framework: UI + Server Actions (CRUD) + Route Handlers (FX refresh endpoint) | One codebase, one deploy. Server Actions remove the need to hand-write a REST API for CRUD. React Server Components let the dashboard query SQLite directly server-side — no client data-fetching layer for read-heavy views. |
| React | 19.2.x | UI rendering | Bundled/peer with Next 16; Server Components + Actions are stable. |
| TypeScript | 5.x | Type safety across DB schema, FX math, forms | End-to-end types from Drizzle schema → Server Action → form keep a money/currency app honest. |
| SQLite (via better-sqlite3) | better-sqlite3 12.11.x | Embedded relational database | Single user, single machine → no DB server to run, patch, or back up. Synchronous, fast, ACID. Relational model (spaces → mother account → child accounts, payment-channel enum, fx_rates) fits perfectly. Backup is a file copy. |
| Drizzle ORM | 0.45.x | Type-safe SQL / schema / queries | Lightweight, TypeScript-first, SQL-like. No runtime codegen engine. Ideal weight for a small tool; its aggregation API cleanly expresses the dashboard "spend by country/currency/channel" group-bys. |
| drizzle-kit | 0.31.x | Migrations / schema push | `drizzle-kit generate` + `migrate` (or `push` for solo dev) manages the SQLite schema. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | 4.3.x | Styling | Always — the styling layer for shadcn/ui. v4 uses CSS-first config. |
| shadcn/ui | (CLI, not versioned) | Accessible component primitives (tables, dialogs, forms, charts) copied into your repo | Always — gives you table/dialog/form/select components you own and can edit. No heavyweight UI dependency. |
| Recharts | 3.9.x | Charts for spend distribution & counts | Dashboard. Use through shadcn/ui's chart wrapper (which is built on Recharts) for consistent theming. |
| lucide-react | 1.21.x | Icon set | UI affordances (expiry warnings, actions). Pairs with shadcn/ui. |
| Zod | 4.4.x | Schema validation | Validate form input AND FX API responses; reuse one schema for client + Server Action. |
| React Hook Form | 7.x | Form state | The space/child-account/payment-channel CRUD forms. Integrates with Zod via resolver. |
| date-fns | 4.4.x | Date math | Compute expiry = opening date + subscription period (`addMonths`/`addQuarters`/`addYears`), and "expiring soon"/"expired" comparisons. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| pnpm | Package manager | Fast, disk-efficient; fine to use npm if preferred. |
| Drizzle Studio (`drizzle-kit studio`) | Browse/edit the SQLite data | Handy admin view of your data without writing a screen. |
| Biome or ESLint + Prettier | Lint/format | Biome is a single fast tool; Next ships an ESLint config if preferred. |

## Installation

```bash
# Scaffold the app (TypeScript + Tailwind + App Router)
npx create-next-app@latest team-account-manager --ts --tailwind --app --eslint

cd team-account-manager

# Database + ORM
npm install drizzle-orm better-sqlite3
npm install -D drizzle-kit @types/better-sqlite3

# Forms + validation + dates
npm install zod react-hook-form @hookform/resolvers date-fns

# Charts + icons (shadcn pulls Recharts in when you add chart components)
npm install recharts lucide-react

# shadcn/ui (interactive component installer)
npx shadcn@latest init
npx shadcn@latest add table dialog form select input card badge chart
```

No external paid services required. Frankfurter needs no SDK and no key — call it with `fetch`.

## Exchange-Rate Strategy (the one external dependency)

**Recommended API: Frankfurter** — https://frankfurter.dev (formerly frankfurter.app)
- Free, open-source, **no API key**, **no quotas**, commercial use allowed, self-hostable.
- 201 currencies sourced from 84 central banks; supports `base`/`from`/`to` params so you can pull rates relative to USD directly.
- Updates roughly once per working day (ECB-style), so polling more than daily is pointless.

**How to store & refresh (keep it simple):**
1. **Store, don't recompute live.** Persist fetched rates in an `fx_rates` table: `(date, base='USD', currency, rate, fetched_at)`. Convert each space's original amount to USD using the rate effective at report time, and keep the converted figure derivable (store original amount + currency; compute USD in queries/views).
2. **Refresh lazily + manually.** On dashboard load, if today's rates are missing/stale, fetch once and upsert. Always provide a manual **"Refresh rates"** button. This needs **no scheduler** — the simplest design that satisfies the requirement.
3. **Graceful degradation (matches the PROJECT constraint).** If Frankfurter is unreachable, fall back to the most recent stored rates and show a "rates as of <date>" notice. Optionally allow a manual rate override row. Never block the dashboard on a failed FX call.
4. **Money handling:** store amounts as **integer minor units** (e.g. cents) or fixed-precision decimal strings — never JS floats — to avoid rounding drift in totals. Do USD conversion with explicit rounding at display time.

**FX alternatives:**
- `open.er-api.com` (open ExchangeRate-API): free, no key, ~161 currencies, daily — good backup if Frankfurter ever changes.
- Avoid keyed/paid tiers (currencyapi, fixer, exchangerate.host's keyed plan) — unnecessary cost for a single-user daily-rate tool.

## Scheduling Note

For a single-user app, **do not build cron infrastructure.** Prefer lazy-refresh-on-load + manual button (above). If you later want truly hands-off daily updates, the lightest options in order:
1. OS-level scheduler (systemd timer / Windows Task Scheduler / cron) hitting a `/api/fx/refresh` Route Handler.
2. Platform cron (e.g. a host's scheduled job) hitting the same endpoint.
3. `node-cron` 4.x in-process — only worth it if you already run a persistent Node process and want it self-contained.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js full-stack | SvelteKit / Remix(React Router 7) / Astro | If you strongly prefer Svelte, or want a lighter runtime. All are fine; Next has the largest component/example ecosystem (esp. shadcn/ui). |
| SQLite (better-sqlite3) | libSQL / Turso (`@libsql/client`) | If you deploy to a serverless/edge host with an ephemeral filesystem (e.g. Vercel) where a local SQLite file won't persist. Same SQL, hosted. |
| SQLite | PostgreSQL | Only if this ever becomes multi-user or needs concurrent writers/managed hosting. Not now. |
| Drizzle ORM | Prisma 7 | If you prefer Prisma's schema DSL and tooling. Heavier; for a small single-user tool Drizzle is leaner with less ceremony. |
| Recharts (via shadcn) | Tremor (`@tremor/react`) | If you want pre-built dashboard "KPI card" blocks out of the box. Recharts + shadcn gives more control and fewer dependency-version constraints. |
| Server Components for reads | TanStack Query 5 | Only if you add significant client-side interactive data fetching. With RSC + Server Actions you likely won't need it. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Auth system (Auth.js, Clerk, Lucia) | Project is explicitly single-user; an account/role system is scope and complexity for zero benefit | Nothing, or a single shared password via reverse-proxy basic-auth / one env-var check if the app is exposed beyond localhost |
| Separate backend (Express/Nest) + standalone React SPA | Two codebases, two deploys, hand-written REST + CORS for one user | Next.js Server Actions + Route Handlers in the same app |
| PostgreSQL/MySQL server | Operational overhead (install, patch, back up, connection pooling) for a single-writer tool | SQLite file |
| Redis / caching layer | No traffic to cache; SQLite reads are already fast | Query SQLite directly; store FX rates in a table |
| Redux / heavy global state | Over-engineering for a small form+dashboard app | React state + Server Actions; URL/search params for filters |
| GraphQL | No client-shaping benefit for one user and a fixed schema | Server Actions / typed Route Handlers |
| Paid FX APIs | Unneeded cost; daily central-bank rates are free | Frankfurter |
| Floating-point money math | Accumulated rounding errors in USD totals | Integer minor units or decimal strings |
| Vercel serverless + local SQLite file | Ephemeral filesystem loses the DB between invocations | Self-host with a persistent disk, or use Turso/libSQL |
| Docker Compose multi-service / Kubernetes | Massive over-provisioning for one small app | Single `next start` process (optionally one Docker container) |

## Stack Patterns by Variant

**If deploying to a always-on box you control (recommended):**
- Use better-sqlite3 with a local DB file + `next start` under Node runtime.
- Back up by copying the `.db` file (and WAL) on a schedule.

**If you insist on serverless/edge hosting (e.g. Vercel):**
- Swap better-sqlite3 → `@libsql/client` (0.17.x) pointing at Turso. Drizzle supports the libSQL driver, so schema/queries are largely unchanged.

**If hands-off daily FX updates become a must-have:**
- Add an OS/platform scheduled job hitting `/api/fx/refresh`; keep the lazy-load path as the fallback.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| next@16.2.x | react@19.2.x | React 19 is the expected peer for Next 16; use the versions create-next-app installs. |
| drizzle-orm@0.45.x | better-sqlite3@12.x, drizzle-kit@0.31.x | Use the `better-sqlite3` Drizzle driver. better-sqlite3 is a native module → requires the **Node** runtime (not Edge); ensure Server Actions/Route Handlers touching the DB are not set to `runtime = 'edge'`. |
| tailwindcss@4.x | shadcn/ui (current) | shadcn/ui's current CLI targets Tailwind v4; follow its init prompts so the CSS-first config is wired correctly. |
| recharts@3.x | react@19 | shadcn/ui chart components wrap Recharts 3; add via `shadcn add chart`. |
| zod@4.x | @hookform/resolvers (current) | Ensure the resolvers version supports Zod 4 (current release does). |

## Sources

- npm registry (registry.npmjs.org `/latest`) — verified current versions on 2026-06-27: next 16.2.9, react 19.2.7, drizzle-orm 0.45.2, drizzle-kit 0.31.10, better-sqlite3 12.11.1, prisma 7.8.0, tailwindcss 4.3.1, recharts 3.9.0, @tremor/react 3.18.7, zod 4.4.3, @tanstack/react-query 5.101.1, date-fns 4.4.0, lucide-react 1.21.0, @libsql/client 0.17.4, node-cron 4.5.0 — HIGH
- frankfurter.dev (official) — confirmed free, open-source, no API key, no quotas, 201 currencies from 84 central banks, commercial use allowed, self-hostable — HIGH
- Next.js / Drizzle / shadcn/ui official docs (general architecture patterns: Server Actions, RSC, SQLite driver, Tailwind v4) — HIGH

---
*Stack research for: single-user internal multi-currency CRUD + dashboard tool*
*Researched: 2026-06-27*
