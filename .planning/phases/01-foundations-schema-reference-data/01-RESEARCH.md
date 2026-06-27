# Phase 1: Foundations, Schema & Reference Data - Research

**Researched:** 2026-06-27
**Domain:** Next.js 16 full-stack scaffold + Drizzle/SQLite schema design + reference-data CRUD (greenfield, MVP walking skeleton)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Currency reference data (REF-02)**
- **D-01:** Currencies live in a **curated, seeded `currency` table** — not the full ISO-4217 set, not derived at runtime from the FX API.
- **D-02:** Seed exactly six majors at migration time: **USD, CNY, EUR, GBP, JPY, HKD**. All six are Frankfurter-supported so every stored currency is guaranteed convertible to USD.
- **D-03:** Each currency row stores its **ISO-4217 minor-unit exponent** (JPY = 0, all others here = 2). This exponent is the authority for integer-minor-unit money math everywhere downstream.
- **D-04:** The list is **manually extensible later**, but only currencies the FX layer can convert should be added. Phase 1 only needs to *display* the list for selection — no editing UI for currencies in this phase.

**Payment-channel reference data (REF-01)**
- **D-05:** Channels are referenced by **stable surrogate id + FK** (locked project decision — never name strings).
- **D-06:** Deletion is **uniform soft-delete** via an `is_active` flag. *All* deletes archive — there is no hard-delete path, even for channels never referenced by any space. One mental model, simplest code.
- **D-07:** Archived channels **drop out of the new-space payment-channel picker** but any space already referencing them continues to display normally (FK integrity preserved).
- **D-08:** Provide a **"show archived" affordance** in the channel maintenance UI so archived channels can be viewed and reactivated.
- **D-09:** The payment-channel table **starts empty** — no seeded channels. User adds their own.

**Country handling (schema decision, consumed Phase 3)**
- **D-10:** Country is a **fixed ISO 3166 alpha-2 picker** backed by a static constant list in code — **not** a user-maintained reference table.
- **D-11:** The space row stores the **alpha-2 code** (e.g. `US`, `CN`). No maintenance UI for countries.

**Navigation shell**
- **D-12:** Standard **left-sidebar layout** with top-level sections: **Dashboard**, **Spaces**, **Reference Data** (channels + currencies). Phase 1 delivers the working shell + Reference Data screens; later phases fill in the rest.

### Claude's Discretion
- Exact shadcn/ui component selection, table/dialog styling, and form wiring for reference-data screens.
- Drizzle schema file organization and migration tooling flow (`generate` + `migrate` vs `push`) — pick per stack guidance in CLAUDE.md.
- Naming of columns/tables beyond the locked-name FX-snapshot and period fields.
- Whether the currency exponent column is named `exponent` / `decimal_digits` etc.

### Deferred Ideas (OUT OF SCOPE)
- **Currency editing/maintenance UI** — Phase 1 only displays currencies; rows added via seed/migration for now.
- **Country as a maintained reference table** — rejected; fixed ISO picker chosen.
- Everything beyond foundations: FX cache (Phase 2), space CRUD + expiry + USD snapshot (Phase 3), child accounts + cascade delete (Phase 4), dashboard (Phase 5).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REF-01 | User can manually maintain payment channels (add/edit/delete); references are id-based; deleting an in-use channel is protected (soft-delete or block) | `payment_channel` table = surrogate `id` PK + `name` + `is_active` flag; all deletes flip `is_active=0` (D-06); Server Actions for create/rename/archive/reactivate; picker filters `is_active=1`; FK from future `space.payment_channel_id` preserves integrity (Pattern 4, Code Examples) |
| REF-02 | System provides a currency list for selection when creating/editing spaces | `currency` table seeded at migration time with 6 majors + per-currency minor-unit exponent (D-01/02/03); read-only list view in Phase 1; Server Component reads directly (Pattern 1, Code Examples) |

**Note:** Phase 1's *load-bearing* deliverable beyond REF-01/REF-02 is the locked schema — money as integer minor units, FX-snapshot columns (`rate_used`, `rate_as_of`, `rate_source`, `amount_usd`), and structured period (`{unit, count}`) reserved on the (future) space row. These columns are expensive/impossible to retrofit (Success Criterion 4).
</phase_requirements>

## Summary

This is the **foundation phase of a greenfield, single-user Next.js 16 app**. The entire stack is locked in `.claude/CLAUDE.md` and all versions were verified against the npm registry on 2026-06-27 (today): Next 16.2.9, React 19.2.7, drizzle-orm 0.45.2, drizzle-kit 0.31.10, better-sqlite3 12.11.1, tailwindcss 4.3.1, zod 4.4.3, date-fns 4.4.0, lucide-react 1.21.0. There is **no version research left to do** — the work is wiring these together correctly and getting the schema right.

Three things must be correct and are hard to change later: (1) **money is integer minor units with a per-currency exponent** — never floats; (2) the **space row reserves FX-snapshot columns** (`rate_used`, `rate_as_of`, `rate_source`, `amount_usd`) and **structured-period columns** (`{unit, count}`) even though they are populated in Phase 3 — declaring them now avoids a painful `amount_usd` backfill migration; (3) **reference data is FK-based with surrogate ids** and channels use uniform soft-delete via `is_active`.

The walking-skeleton slice is: `create-next-app` scaffold → Tailwind v4 + shadcn/ui init → Drizzle schema + `drizzle-kit generate` → programmatic migrate + seed script → left-sidebar nav shell → one real read (currency list, RSC) → one real write (add a payment channel, Server Action). The single biggest **landmine on this machine** is the better-sqlite3 native build: Node is **v25.5.0** (odd, non-LTS, bleeding edge) and there is **no Python and no C++ toolchain installed** — if a prebuilt binary for Node 25's ABI does not exist, `npm install better-sqlite3` will try to compile from source and fail. Recommendation: install on **Node 22 or 24 LTS**.

**Primary recommendation:** Scaffold with `create-next-app` (TS + Tailwind + App Router + `src/`), use **`drizzle-kit generate` + a programmatic `migrate()` + seed script** (not `push`) so Success Criterion 4 ("verified by a passing migration") is satisfiable as a committed, reviewable artifact; declare the full locked schema (including Phase 3 reserved columns) up front; run everything on a Node LTS, not Node 25.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Currency list display (REF-02) | Frontend Server (RSC) | Database | Read-only data; a Server Component queries SQLite directly — no client fetch layer needed |
| Payment-channel CRUD (REF-01) | API/Backend (Server Actions) | Database | Mutations run server-side via Server Actions; `revalidatePath` refreshes the RSC list |
| Soft-delete / archive logic | API/Backend (Server Actions) | Database | `is_active` flip is a write; business rule lives server-side, never in the browser |
| Schema / migration / seed | Database | Build tooling (drizzle-kit) | DDL + seed are build-time concerns; the DB file is the source of truth |
| Navigation shell / layout | Frontend Server (SSR layout) | Browser/Client | `app/layout.tsx` renders the sidebar; only interactive bits (active link, dialogs) are client components |
| Form validation | API/Backend + Browser/Client | — | Zod schema shared: client (RHF resolver) for UX, **re-validated in the Server Action** for safety |
| DB connection | API/Backend (Node runtime only) | — | better-sqlite3 is a native module → must run under Node runtime, never Edge |

## Standard Stack

> All versions LOCKED in `.claude/CLAUDE.md` and verified against npm registry on 2026-06-27. Do not re-litigate.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.x (16.2.9) | Full-stack framework (UI + Server Actions + Route Handlers) | `[VERIFIED: npm registry]` One codebase/deploy; RSC reads SQLite directly; Server Actions remove hand-written REST |
| react | 19.2.x (19.2.7) | UI rendering | `[VERIFIED: npm registry]` Peer of Next 16; Server Components + Actions stable |
| typescript | 5.x | Type safety schema→action→form | `[CITED: CLAUDE.md]` End-to-end types from Drizzle schema |
| better-sqlite3 | 12.11.x (12.11.1) | Embedded SQLite driver (synchronous) | `[VERIFIED: npm registry]` Single-user → no DB server; ACID; backup = file copy. **Native module → Node runtime only** |
| drizzle-orm | 0.45.x (0.45.2) | Type-safe SQL/schema/queries | `[VERIFIED: npm registry]` TS-first, SQL-like, lightweight; aggregation API fits later dashboard group-bys |
| drizzle-kit | 0.31.x (0.31.10) | Migrations / schema generate+migrate | `[VERIFIED: npm registry]` `generate` + `migrate` produces committed, reviewable SQL |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tailwindcss | 4.3.x (4.3.1) | Styling (CSS-first config) | Always — styling layer for shadcn/ui |
| shadcn/ui | CLI (unversioned) | Accessible component primitives copied into repo | Reference-data tables/dialogs/forms/selects + sidebar |
| lucide-react | 1.21.x | Icon set | Sidebar icons, archive/restore affordances |
| zod | 4.4.x (4.4.3) | Schema validation (client + server) | Channel form input + reused in Server Action |
| react-hook-form | 7.x | Form state | Channel add/edit dialog form |
| @hookform/resolvers | current | Bridge Zod 4 ↔ RHF | `zodResolver` in the channel form |
| date-fns | 4.4.x | Date math | Not heavily used in Phase 1; installed for Phase 3 expiry |

### Alternatives Considered (rejected per CLAUDE.md "What NOT to Use")
| Instead of | Could Use | Tradeoff / Why Rejected |
|------------|-----------|-------------------------|
| better-sqlite3 | @libsql/client + Turso (0.17.x) | Only if deploying to ephemeral-FS serverless. Self-hosted persistent disk is the plan → local file wins |
| Drizzle | Prisma 7 | Heavier; Drizzle is leaner for a small tool |
| `generate`+`migrate` | `drizzle-kit push` | `push` is great for rapid prototyping but writes no reviewable artifact — Success Criterion 4 wants "a passing migration", so prefer committed SQL |
| Reference tables | hardcoded enums | User must maintain channels without redeploy; FK can't enforce code enums |

**Installation:**
```bash
# Scaffold (TS + Tailwind v4 + App Router + src/ dir)
npx create-next-app@latest team-account-manager --ts --tailwind --app --src-dir --eslint

cd team-account-manager

# DB + ORM
npm install drizzle-orm better-sqlite3
npm install -D drizzle-kit @types/better-sqlite3 tsx

# Forms + validation + dates
npm install zod react-hook-form @hookform/resolvers date-fns

# Icons (Recharts only needed in Phase 5)
npm install lucide-react

# shadcn/ui (interactive installer; targets Tailwind v4)
npx shadcn@latest init
npx shadcn@latest add table dialog form select input button card badge sonner
```

> `tsx` is added as a dev dep to run the TypeScript migrate/seed script (`npx tsx src/db/migrate.ts`).

## Package Legitimacy Audit

> Verified via `gsd-tools query package-legitimacy check --ecosystem npm` on 2026-06-27.

| Package | Registry | Published | Weekly Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----------|------------------|-------------|---------|-------------|
| next | npm | 2026-06-09 | 41.3M | github.com/vercel/next.js | SUS (too-new) | **Approved** — false positive; recent point release of canonical framework |
| react | npm | 2026-06-01 | 148.2M | github.com/facebook/react | SUS (too-new) | **Approved** — false positive; recent point release |
| drizzle-orm | npm | 2026-03-27 | 11.5M | github.com/drizzle-team/drizzle-orm | OK | Approved |
| drizzle-kit | npm | 2026-03-17 | 9.6M | github.com/drizzle-team/drizzle-orm | OK | Approved |
| better-sqlite3 | npm | 2026-06-15 | 7.5M | github.com/WiseLibs/better-sqlite3 | SUS (too-new) | **Approved** — false positive; recent point release. **Note native-build risk below** |
| zod | npm | 2026-05-04 | 211.0M | github.com/colinhacks/zod | OK | Approved |
| react-hook-form | npm | 2026-06-20 | 55.4M | github.com/react-hook-form/react-hook-form | SUS (too-new) | **Approved** — false positive |
| @hookform/resolvers | npm | 2026-05-21 | 46.8M | github.com/react-hook-form/resolvers | OK | Approved |
| date-fns | npm | 2026-05-29 | 92.2M | github.com/date-fns/date-fns | SUS (too-new) | **Approved** — false positive |
| lucide-react | npm | 2026-06-18 | 84.4M | github.com/lucide-icons/lucide | SUS (too-new) | **Approved** — false positive |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged [SUS]:** next, react, better-sqlite3, react-hook-form, date-fns, lucide-react — **all SUS verdicts are `too-new` false positives**: each is a top-tier package with tens of millions of weekly downloads and an official source repo. The `too-new` signal fired only because each shipped a recent point release. **No `checkpoint:human-verify` needed.** All postinstall scripts are `null` (no install-time code execution). These are all transitively required and/or installed by `create-next-app` / `shadcn` anyway.

## Architecture Patterns

### System Architecture Diagram

```
                 ┌─────────────────────────────────────────────┐
   Browser  ───► │  app/layout.tsx  (left-sidebar nav shell)    │
   request       │   Dashboard | Spaces | Reference Data        │
                 └───────────────┬──────────────┬───────────────┘
                                 │              │
              read path (RSC)    │              │   write path (Server Action)
                                 ▼              ▼
                 ┌───────────────────────┐  ┌──────────────────────────────┐
                 │ Server Component       │  │ "use server" action          │
                 │ - currency list        │  │ - zod.parse(formData)        │
                 │ - channel list (active/ │  │ - db.insert/update channel   │
                 │   archived)             │  │ - revalidatePath('/ref/...') │
                 └──────────┬─────────────┘  └──────────────┬───────────────┘
                            │  db query                     │ db mutation
                            ▼                               ▼
                 ┌───────────────────────────────────────────────────────┐
                 │  src/db/index.ts  — drizzle(better-sqlite3) singleton   │
                 │  (Node runtime only; auto-externalized by Next.js)      │
                 └───────────────────────────┬───────────────────────────┘
                                             ▼
                 ┌───────────────────────────────────────────────────────┐
                 │  SQLite file  (data/app.db, WAL mode)                   │
                 │  currency · payment_channel · (space: reserved cols)    │
                 └───────────────────────────────────────────────────────┘
                                             ▲
                          drizzle-kit generate → migrate() + seed (build-time)
```

### Recommended Project Structure
```
src/
├── app/
│   ├── layout.tsx                 # root layout = sidebar shell (D-12)
│   ├── page.tsx                   # Dashboard placeholder
│   ├── spaces/page.tsx            # Spaces placeholder (filled Phase 3)
│   └── reference-data/
│       ├── channels/page.tsx      # REF-01 channel maintenance (RSC list + client dialog)
│       └── currencies/page.tsx    # REF-02 read-only currency list (RSC)
├── components/
│   ├── ui/                        # shadcn-generated (owned code)
│   └── nav/sidebar.tsx            # nav shell
├── db/
│   ├── schema.ts                  # ALL tables incl. reserved space columns
│   ├── index.ts                   # drizzle(better-sqlite3) singleton
│   ├── migrate.ts                 # programmatic migrate() runner
│   └── seed.ts                    # seed 6 currencies (idempotent upsert)
├── lib/
│   ├── money.ts                   # integer-minor-unit helpers (format/parse by exponent)
│   ├── countries.ts               # static ISO-3166 alpha-2 constant (D-10/11)
│   └── validation/channel.ts      # shared zod schema
└── actions/
    └── channels.ts                # "use server" create/rename/archive/reactivate
drizzle/                            # generated SQL migrations + snapshot.json (committed)
drizzle.config.ts
data/app.db                         # SQLite file (gitignored)
```

### Pattern 1: RSC reads, Server Actions write
**What:** Server Components query SQLite directly for read-only views (currency list, channel list); mutations go through `"use server"` actions that call `revalidatePath()` to refresh the RSC.
**When to use:** All Phase 1 data flow. No TanStack Query / client fetch layer (CLAUDE.md "What NOT to Use").
**Example:** see Code Examples → "Server Action: add/archive channel".

### Pattern 2: Declare the full locked schema now (including Phase 3 reserved columns)
**What:** Even though spaces aren't built until Phase 3, declare the `space` table's money/FX-snapshot/period columns in this phase's schema and migration.
**Why:** Adding `amount_usd` / `rate_used` later forces a backfill migration over existing rows. Declaring them now (nullable until Phase 3 populates them) is free and satisfies Success Criterion 4. `[CITED: .planning/research/ARCHITECTURE.md "Suggested Build Order" — building rate layer first avoids amount_usd backfill]`

### Pattern 3: Integer minor units + per-currency exponent
**What:** Money columns are `integer` (minor units, e.g. `1999` = $19.99). The authoritative exponent lives on `currency.minor_unit` (JPY=0, others=2). All formatting/parsing goes through `lib/money.ts` keyed by the currency's exponent.
**Why:** IEEE-754 floats drift; `× 100` corrupts 0-decimal currencies like JPY. `[CITED: .planning/research/PITFALLS.md Pitfall 1]`

### Pattern 4: Surrogate-id FK + uniform soft-delete for channels
**What:** `payment_channel` = surrogate `id` PK + `name` + `is_active`. Future `space.payment_channel_id` is an FK to `payment_channel.id`. Every delete sets `is_active = 0` (D-06). Picker query filters `WHERE is_active = 1`; "show archived" toggles the filter (D-08).
**Why:** Renames preserve history (id-based); archived channels never orphan referencing spaces; one uniform code path. `[CITED: .planning/research/PITFALLS.md Pitfall 8]`

### Anti-Patterns to Avoid
- **`runtime = 'edge'` on any route/action touching the DB:** better-sqlite3 is native → Edge has no Node APIs → runtime crash. Keep DB code on the default Node runtime. `[VERIFIED: Next.js docs serverExternalPackages]`
- **Storing money as `real`/float, or hardcoding `× 100`:** breaks JPY and accumulates drift. `[CITED: PITFALLS.md]`
- **Referencing channels by name string:** rename loses attribution. Use the surrogate id. `[CITED: PITFALLS.md Pitfall 8]`
- **Hard-deleting reference rows:** orphans future FK references. Soft-delete only (D-06).
- **New `Database()` per request:** exhausts handles / breaks under HMR. Use a module-singleton (see Code Examples).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL migrations | Hand-written `CREATE TABLE` strings + a custom runner | `drizzle-kit generate` + `drizzle-orm/better-sqlite3/migrator` `migrate()` | Tracks applied migrations, diffs schema, idempotent |
| Money formatting | `(cents/100).toFixed(2)` everywhere | `Intl.NumberFormat` + per-currency exponent helper in `lib/money.ts` | Handles JPY (0dp) and locale grouping correctly |
| Form validation | Manual `if (!name) ...` | Zod schema shared client+server | One source of truth; type inference; re-validated server-side |
| Accessible table/dialog/select | Custom modal + focus traps | shadcn/ui `dialog` `table` `select` `form` | A11y + keyboard handled; you own the code |
| Native SQLite binary | Compile SQLite yourself | better-sqlite3 prebuilt binaries | Prebuilds exist for LTS Node ABIs |
| ISO country list | Free-text country field | Static `countries.ts` constant (D-10) | Clean grouping for the future dashboard |

**Key insight:** In this phase the only "logic" worth writing is the money/exponent helper and the soft-delete picker filter. Everything else is wiring well-trodden libraries.

## Common Pitfalls

### Pitfall 1: better-sqlite3 native build fails on Node 25 / no toolchain (BLOCKING on this machine)
**What goes wrong:** `npm install better-sqlite3` downloads a prebuilt binary matching the Node ABI. This machine runs **Node v25.5.0** (odd, non-LTS, very new) and has **no Python and no Visual Studio C++ build tools**. If no prebuild exists for Node 25's ABI, install falls back to `node-gyp` source compile → fails.
**Why it happens:** Prebuilt binaries target released ABIs; bleeding-edge Node may not be covered. `[VERIFIED: local env probe — node v25.5.0, python MISSING, no MSVC toolchain]`
**How to avoid:** Use **Node 22 LTS or Node 24 LTS** (Next 16 requires ≥20.9). With an LTS, better-sqlite3 12.11.x prebuilds install cleanly with zero compilation. If Node 25 is mandatory, install Python 3 + "Desktop development with C++" (VS Build Tools) first.
**Warning signs:** `gyp ERR!`, `prebuild-install warn install No prebuilt binaries found`, `MSB...` errors on `npm install`.

### Pitfall 2: DB code accidentally bundled for Edge / double-instantiated under HMR
**What goes wrong:** Setting `export const runtime = 'edge'` (or middleware importing db) crashes — Edge has no `fs`/native addons. Separately, Next dev HMR re-evaluates modules, opening many SQLite handles.
**How to avoid:** Next.js **already auto-externalizes `better-sqlite3`** (it's in the built-in `serverExternalPackages` opt-out list) — no config needed, but you may add it explicitly for clarity. Keep all DB imports out of `middleware.ts` and Client Components. Cache the `Database` instance on `globalThis` in dev. `[VERIFIED: Next.js docs — better-sqlite3 listed in auto-externalized packages]`
**Warning signs:** `Module not found: Can't resolve 'fs'`, "too many open files", stale data after edits.

### Pitfall 3: Floating-point money / wrong exponent for JPY
**What goes wrong:** Storing `real`, or `× 100` for every currency, corrupts JPY (0 decimals) and drifts totals. `[CITED: PITFALLS.md Pitfall 1]`
**How to avoid:** `integer` minor-unit columns; exponent from `currency.minor_unit`; round once at the boundary.
**Warning signs:** column type `real`/`float`; `parseFloat` on an amount; a hardcoded `100`.

### Pitfall 4: Missing FX-snapshot / period columns → painful retrofit
**What goes wrong:** Spaces ship in Phase 3 without `amount_usd`/`rate_used`, then a backfill migration is needed over live data. `[CITED: ARCHITECTURE.md Build Order]`
**How to avoid:** Declare `rate_used`, `rate_as_of`, `rate_source`, `amount_usd`, `period_unit`, `period_count` (nullable) on the `space` table in this phase's migration.

### Pitfall 5: Tailwind v4 + shadcn mismatch
**What goes wrong:** Following an old Tailwind v3 shadcn guide (with `tailwind.config.js` + `content` array) breaks under v4's CSS-first `@import "tailwindcss"` model.
**How to avoid:** Scaffold Tailwind via `create-next-app --tailwind` (gives the v4 CSS-first setup) and let `npx shadcn@latest init` (current CLI targets v4) wire `globals.css` + `components.json`. Don't hand-create a v3-style config. `[CITED: CLAUDE.md version-compatibility; ui.shadcn.com/docs/installation/next]`
**Warning signs:** shadcn components render unstyled; CLI complains it can't find Tailwind config.

## Code Examples

> Patterns below combine official Drizzle docs with the locked stack. FK `references()` and `.unique()` syntax is standard Drizzle API `[ASSUMED]` (the column-types doc page did not show them inline; verify against /docs/indexes-constraints during planning).

### drizzle.config.ts
```ts
// Source: orm.drizzle.team/docs/get-started-sqlite (config object shape)
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DB_FILE_NAME ?? './data/app.db' },
});
```

### src/db/index.ts — singleton client (HMR-safe)
```ts
// Source: orm.drizzle.team/docs/get-started/better-sqlite3 (client creation)
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { sqlite?: Database.Database };
const sqlite = globalForDb.sqlite ?? new Database(process.env.DB_FILE_NAME ?? './data/app.db');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');           // SQLite needs FKs explicitly enabled
if (process.env.NODE_ENV !== 'production') globalForDb.sqlite = sqlite;

export const db = drizzle({ client: sqlite, schema });
```

### src/db/schema.ts — reference tables + reserved space columns
```ts
// Source: orm.drizzle.team/docs/column-types/sqlite (integer/text modes, defaults)
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// REF-02 — seeded currency list with authoritative minor-unit exponent (D-01/02/03)
export const currency = sqliteTable('currency', {
  code: text('code').primaryKey(),                         // 'USD','CNY','EUR','GBP','JPY','HKD'
  name: text('name').notNull(),
  minorUnit: integer('minor_unit').notNull(),              // JPY=0, others=2 — money authority
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

// REF-01 — user-maintained channels; surrogate id + uniform soft-delete (D-05/06)
export const paymentChannel = sqliteTable('payment_channel', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

// Phase 3 entity — DECLARED NOW so FX/period/money columns never need a backfill (Pattern 2)
export const space = sqliteTable('space', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  country: text('country').notNull(),                      // ISO-3166 alpha-2 (D-11)
  paymentChannelId: integer('payment_channel_id')
    .notNull()
    .references(() => paymentChannel.id),                  // FK preserves integrity (D-07)
  currencyCode: text('currency_code')
    .notNull()
    .references(() => currency.code),
  // money as integer minor units (Pattern 3)
  amountMinor: integer('amount_minor').notNull(),
  // structured subscription period {unit, count} (locked names)
  periodUnit: text('period_unit'),                         // 'month' | 'quarter' | 'year'
  periodCount: integer('period_count'),
  // FX-snapshot reserved columns (locked names; nullable until Phase 3)
  rateUsed: text('rate_used'),                             // decimal string, not float
  rateAsOf: text('rate_as_of'),
  rateSource: text('rate_source'),
  amountUsd: integer('amount_usd'),                        // USD minor units, frozen at payment
  openingDate: text('opening_date'),                       // calendar date YYYY-MM-DD
  expiryDate: text('expiry_date'),                         // derived+stored Phase 3
});
```

### src/db/migrate.ts — programmatic migrate (Success Criterion 4)
```ts
// Source: orm.drizzle.team/docs/migrations (migrate runner pattern, better-sqlite3 namespace)
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';

const sqlite = new Database(process.env.DB_FILE_NAME ?? './data/app.db');
const db = drizzle({ client: sqlite });
migrate(db, { migrationsFolder: './drizzle' });   // applies unapplied migrations; idempotent
console.log('migrations applied');
sqlite.close();
```
Run: `npx tsx src/db/migrate.ts`. A passing run with all 6 currency rows present satisfies Success Criterion 4.

### src/db/seed.ts — idempotent currency seed (D-02/03)
```ts
import { db } from './index';
import { currency } from './schema';

const SEED = [
  { code: 'USD', name: 'US Dollar',        minorUnit: 2 },
  { code: 'CNY', name: 'Chinese Yuan',     minorUnit: 2 },
  { code: 'EUR', name: 'Euro',             minorUnit: 2 },
  { code: 'GBP', name: 'Pound Sterling',   minorUnit: 2 },
  { code: 'JPY', name: 'Japanese Yen',     minorUnit: 0 },   // 0 decimals — exponent matters
  { code: 'HKD', name: 'Hong Kong Dollar', minorUnit: 2 },
];

for (const row of SEED) {
  db.insert(currency).values(row).onConflictDoNothing().run();   // re-runnable
}
console.log('seeded currencies');
```

### Server Action: add / archive channel (REF-01)
```ts
'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { paymentChannel } from '@/db/schema';
import { channelSchema } from '@/lib/validation/channel';   // shared zod (Zod 4)

export async function addChannel(formData: FormData) {
  const { name } = channelSchema.parse({ name: formData.get('name') }); // re-validate server-side
  db.insert(paymentChannel).values({ name }).run();
  revalidatePath('/reference-data/channels');
}

export async function archiveChannel(id: number) {                      // D-06 uniform soft-delete
  db.update(paymentChannel).set({ isActive: false }).where(eq(paymentChannel.id, id)).run();
  revalidatePath('/reference-data/channels');
}
```

### next.config.ts (optional explicit externalization)
```ts
// better-sqlite3 is auto-externalized, but listing it documents intent.
// Source: nextjs.org/docs/.../serverExternalPackages
import type { NextConfig } from 'next';
const nextConfig: NextConfig = { serverExternalPackages: ['better-sqlite3'] };
export default nextConfig;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` + `content` array (v3) | CSS-first `@import "tailwindcss"` (v4) | Tailwind v4 | shadcn CLI now targets v4; don't hand-write a v3 config |
| `serverComponentsExternalPackages` (experimental) | `serverExternalPackages` (stable) | Next 15.0.0 | better-sqlite3 is in the built-in auto-opt-out list |
| Pages Router API routes for CRUD | Server Actions (`"use server"`) | Next 14/15+ | No hand-written REST for single-user CRUD |
| Convert currency on read | Snapshot rate + store `amount_usd` | (this project's locked decision) | Phase 1 reserves the columns; Phase 3 populates |

**Deprecated/outdated:**
- Tailwind v3 shadcn install guides — do not follow; use the v4 flow.
- `runtime = 'edge'` for anything touching SQLite — incompatible with native modules.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Drizzle FK `references(() => table.col)` and `.unique()` syntax as shown | Code Examples / schema | LOW — standard Drizzle API; confirm against /docs/indexes-constraints during planning |
| A2 | better-sqlite3 12.11.x has a prebuilt binary for Node 25 ABI is **uncertain** | Pitfall 1 / Environment | HIGH — if false, install fails without LTS Node or a C++ toolchain |
| A3 | `drizzle-orm/better-sqlite3/migrator` exports `migrate(db, {migrationsFolder})` | Code Examples / migrate.ts | LOW — docs showed node-postgres equivalent; better-sqlite3 namespace is conventional |
| A4 | shadcn `init` auto-wires Tailwind v4 `globals.css` + `components.json` with no manual v4 config | Pitfall 5 | MEDIUM — shadcn install/Next page didn't show the v4 CSS snippet; verify the theming/components-json pages |
| A5 | Period unit vocabulary `month`/`quarter`/`year` | schema | LOW — Phase 3 decision; column is reserved text, exact enum can be finalized then |

**If empty:** not empty — A2 (native build on Node 25) is the one to resolve before any install.

## Open Questions (RESOLVED)

1. **Will better-sqlite3 install on Node 25 here, or must we switch to LTS?**
   - What we know: Node v25.5.0 installed; no Python/MSVC toolchain; better-sqlite3 needs a prebuild or compiles from source.
   - What's unclear: whether a Node-25-ABI prebuild exists for 12.11.x.
   - Recommendation: **Plan to run on Node 22/24 LTS** (use `nvm`/`fnm`). Cheapest path; avoids installing a C++ toolchain. Add an early plan task: verify `npm install better-sqlite3` succeeds and `new Database()` opens before building features.
   - **RESOLVED:** Incorporated into 01-01 Task 1 — switch to Node 22/24 LTS before install + smoke-test `require('better-sqlite3')(':memory:')`.

2. **`generate` + `migrate` vs `push` for this solo project?**
   - What we know: CLAUDE.md allows either; Success Criterion 4 says "verified by a passing migration".
   - Recommendation: **`generate` + programmatic `migrate()`** — produces a committed, reviewable `drizzle/*.sql` artifact that *is* the "passing migration" evidence. Keep `push` only for throwaway local experiments.
   - **RESOLVED:** Incorporated into 01-01 Task 3 — `db:generate` + programmatic `src/db/migrate.ts` (NOT push); committed `drizzle/*.sql` is the SC-4 evidence.

3. **SQLite `foreign_keys` PRAGMA** is OFF by default per-connection — must be enabled (`pragma('foreign_keys = ON')`) for FK enforcement to actually protect references. Included in `db/index.ts` above; confirm it's set on the migrate connection too.
   - **RESOLVED:** Incorporated into 01-01 Task 3 (and Task 2's `db/index.ts`) — `pragma('foreign_keys = ON')` set on both the app singleton and the migrate connection.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Entire app | ✓ | v25.5.0 (non-LTS) | **Switch to 22/24 LTS for better-sqlite3 prebuilds** |
| npm | Install/scripts | ✓ | 11.8.0 | — |
| npx | scaffolding/shadcn | ✓ | 11.8.0 | — |
| pnpm | (optional pkg mgr) | ✗ | — | Use npm (fine per CLAUDE.md) |
| Python 3 | node-gyp (only if no prebuild) | ✗ | — | Use LTS Node so no compile is needed |
| C++ build tools (MSVC) | node-gyp (only if no prebuild) | ✗ | — | Use LTS Node so no compile is needed |
| git | version control | ✓ | 2.37.3 | — |

**Missing dependencies with no fallback:** none hard-blocking *if* Node LTS is used.
**Missing dependencies with fallback:**
- Python 3 + MSVC toolchain — only needed if better-sqlite3 must compile from source. **Avoid by running on Node 22/24 LTS** (recommended). If Node 25 is non-negotiable and no prebuild exists, install Python 3.x + "Desktop development with C++".
- pnpm — npm is an accepted substitute.

## Validation Architecture

> `workflow.nyquist_validation` is enabled in config.json — this section applies.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **Vitest** (recommended) + a DB-level migration assertion | none installed yet — Wave 0 |
| Config file | none — see Wave 0 (`vitest.config.ts`) |
| Quick run command | `npx vitest run src/db` |
| Full suite command | `npx vitest run` |

> Vitest is recommended over Jest for a Vite/TS-native ESM project; it integrates cleanly with better-sqlite3 (use an in-memory `:memory:` DB or a temp file per test). `[ASSUMED]` — confirm at plan time; Jest is an acceptable alternative.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| (SC-4) | Migration applies cleanly + all tables exist | integration | `npx tsx src/db/migrate.ts` then assert tables | ❌ Wave 0 |
| REF-02 | 6 currencies seeded with correct `minor_unit` (JPY=0) | unit/integration | `npx vitest run src/db/seed.test.ts` | ❌ Wave 0 |
| REF-01 | `addChannel` inserts; `archiveChannel` flips `is_active`, row still exists | integration | `npx vitest run src/actions/channels.test.ts` | ❌ Wave 0 |
| REF-01 | Picker query returns only `is_active=1`; "show archived" returns all | unit | `npx vitest run src/db/channels.query.test.ts` | ❌ Wave 0 |
| (schema) | Money round-trips as integer minor units; JPY (0dp) formats correctly | unit | `npx vitest run src/lib/money.test.ts` | ❌ Wave 0 |
| (manual) | App launches, sidebar renders, navigate to Reference Data | manual-only | `npm run dev` + visual check | n/a |

### Sampling Rate
- **Per task commit:** `npx vitest run src/db` (fast schema/seed/query checks)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green + `npx tsx src/db/migrate.ts` exits 0 with 6 currencies present, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `vitest.config.ts` + `vitest` install (`npm i -D vitest`)
- [ ] `src/db/seed.test.ts` — covers REF-02 (counts + JPY exponent)
- [ ] `src/actions/channels.test.ts` — covers REF-01 (add + soft-delete preserves row)
- [ ] `src/db/channels.query.test.ts` — active vs archived picker filter
- [ ] `src/lib/money.test.ts` — integer-minor-unit round-trip incl. JPY
- [ ] Test DB harness — `:memory:` or temp-file SQLite per test, run migrations in `beforeAll`

## Security Domain

> `security_enforcement` enabled, ASVS level 1. Single-user local tool, **no auth by design** (CLAUDE.md "What NOT to Use" — auth is explicitly out of scope).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Single-user; no account system by design. (If exposed beyond localhost, front with reverse-proxy basic-auth — not in this phase.) |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No multi-user/roles |
| V5 Input Validation | **yes** | **Zod 4** schema parsed in every Server Action (server-side, not just client RHF) |
| V6 Cryptography | no | No secrets/credentials stored (child-account passwords explicitly out of scope) |
| V7 Error Handling/Logging | minimal | Don't log full amounts/PII verbosely |

### Known Threat Patterns for Next.js + Drizzle + SQLite

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection | Tampering | Drizzle parameterizes all queries; never string-concatenate SQL. `db.insert(...).values(...)` is safe |
| Unvalidated Server Action input | Tampering | Server Actions are public endpoints — re-validate with Zod **inside** the action, never trust client validation alone |
| Mass-assignment via FormData | Tampering | Parse only known fields from FormData via the Zod schema |
| Path/DB file exposure | Info disclosure | Keep `data/app.db` gitignored and outside the served/public dir |
| Native module on Edge | DoS (crash) | Keep DB code on Node runtime (Pitfall 2) |

**Note:** No credential storage anywhere (PROJECT constraint). The dominant Phase-1 security control is simply **server-side Zod validation in Server Actions** + Drizzle's parameterized queries.

## Sources

### Primary (HIGH confidence)
- nextjs.org/docs/.../serverExternalPackages (v16.2.9, updated 2025-12-05) — `better-sqlite3` is in Next's built-in auto-externalized package list; `serverExternalPackages` stable since v15.0.0
- orm.drizzle.team/docs/get-started-sqlite — better-sqlite3 client creation (`drizzle({ client })`, file-path, config object); install commands
- orm.drizzle.team/docs/migrations — `generate` vs `migrate` vs `push` semantics; programmatic `migrate()` runner pattern
- orm.drizzle.team/docs/column-types/sqlite — `integer`/`text` modes (`boolean`, `timestamp`, `json`), `primaryKey({autoIncrement})`, `.notNull()`, `.default(sql\`...\`)`, `.$type()`
- .planning/research/PITFALLS.md (project research, 2026-06-27) — float-money, snapshot, channel-integrity pitfalls
- .planning/research/ARCHITECTURE.md (project research, 2026-06-27) — layered monolith, build order, reference-table patterns
- .planning/research/STACK.md + .claude/CLAUDE.md — locked stack with npm-verified versions (2026-06-27)

### Secondary (MEDIUM confidence)
- ui.shadcn.com/docs/installation/next — shadcn init/add flow for Next (Tailwind v4 CSS-specific config on separate theming/components-json pages — verify at plan time)

### Tertiary (LOW confidence)
- Local environment probe (Node v25.5.0, npm 11.8.0, no Python, no MSVC, no pnpm) — drives the native-build risk and LTS recommendation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions npm-verified today; stack locked in CLAUDE.md
- Architecture / patterns: HIGH — official Drizzle + Next docs + project research
- Schema design: HIGH — column types confirmed from Drizzle docs; FK/`unique` syntax MEDIUM (A1)
- Native-build risk on Node 25: MEDIUM — env confirmed; prebuild availability unverified (A2, biggest risk)
- shadcn Tailwind v4 wiring: MEDIUM — flow confirmed, exact v4 CSS snippet not fetched (A4)

**Research date:** 2026-06-27
**Valid until:** ~2026-07-27 (stack stable; re-check shadcn CLI + better-sqlite3 prebuilds if Node changes)
