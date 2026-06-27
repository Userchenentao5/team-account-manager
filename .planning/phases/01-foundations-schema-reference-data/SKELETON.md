# Walking Skeleton — 团队空间管理系统 (team-account-manager)

**Phase:** 1
**Generated:** 2026-06-27

## Capability Proven End-to-End

The single user can launch the app locally (`npm run dev`), navigate a left-sidebar nav shell (仪表盘 / 空间 / 参考数据), view the seeded currency list read live from SQLite (one real DB read), and add / archive / reactivate a payment channel persisted through a Server Action (one real DB write) — all backed by a migrated SQLite database whose schema already reserves the load-bearing money / FX-snapshot / period columns.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.2.x (App Router) + React 19.2.x + TypeScript 5.x | LOCKED in CLAUDE.md. One codebase/deploy; RSC reads SQLite directly; Server Actions remove hand-written REST for single-user CRUD. |
| Data layer | SQLite (better-sqlite3 12.11.x) via Drizzle ORM 0.45.x | LOCKED. Single-user → no DB server; ACID; backup = file copy. better-sqlite3 is a NATIVE module → Node runtime only, never Edge. |
| Migrations | `drizzle-kit generate` + programmatic `migrate()` (NOT `push`) | Produces a committed, reviewable `drizzle/*.sql` artifact that IS the "passing migration" evidence for Success Criterion 4. |
| Money representation | Integer minor units + per-currency exponent on `currency.minor_unit` (JPY=0, others=2) | Floats drift; hardcoded `×100` corrupts 0-decimal JPY. Authoritative exponent lives on the currency row. |
| Reference data | Surrogate-id FK + uniform soft-delete (`is_active`) for channels; seeded curated `currency` table | Renames preserve attribution (id-based, D-05); archived channels never orphan referencing spaces (D-06/D-07). |
| Country handling | Static ISO-3166 alpha-2 constant in `src/lib/countries.ts` (NOT a table) | Clean by-country grouping for the future dashboard; no maintenance UI (D-10/D-11). Defined now, consumed Phase 3. |
| Auth | None (by design) | Single-user local tool (CLAUDE.md "What NOT to Use"). |
| Deployment target | `next build && next start` on Node LTS, SQLite file on persistent disk; dev via `npm run dev` | Local-file SQLite requires always-on / persistent FS. Backup = copy `data/app.db`. |
| Node runtime | **Node 22 or 24 LTS** for install/build | Machine runs Node v25.5.0 (non-LTS) with no Python/MSVC toolchain → better-sqlite3 has no guaranteed prebuild and would fail a source compile (RESEARCH Pitfall 1 / A2). |
| Directory layout | `src/app` (routes), `src/components` (ui + nav + channels), `src/db` (schema/index/migrate/seed), `src/lib` (money/countries/validation), `src/actions` (Server Actions), `drizzle/` (committed migrations) | Matches RESEARCH "Recommended Project Structure". |
| UI kit | Tailwind v4 (CSS-first) + shadcn/ui (new-york, neutral, CSS variables) + lucide-react | LOCKED; UI-SPEC approved. Components owned in `src/components/ui`. |

## Stack Touched in Phase 1

- [x] Project scaffold (create-next-app: TS + Tailwind v4 + App Router + src/; shadcn init; vitest harness)
- [x] Routing — `/` (Dashboard placeholder), `/spaces` (placeholder), `/reference-data/currencies`, `/reference-data/channels`
- [x] Database — real read (RSC currency list) AND real write (Server Action add/archive/reactivate channel) on migrated SQLite
- [x] UI — interactive add-channel dialog + show-archived switch wired to Server Actions; live sidebar navigation
- [x] Deployment — documented local full-stack run: `npm run db:migrate && npm run db:seed && npm run dev`

## Out of Scope (Deferred to Later Slices)

- Space CRUD, mother account, child accounts, expiry computation, USD conversion logic (Phases 3–4).
- The FX rate cache + Frankfurter integration itself (Phase 2). Phase 1 only RESERVES `rate_used`/`rate_as_of`/`rate_source`/`amount_usd`.
- Currency editing/maintenance UI — Phase 1 only DISPLAYS the seeded 6 currencies (D-04); more added via seed/migration later.
- Country as a maintained reference table — rejected; fixed ISO picker chosen (D-10).
- Dashboard, expiry alerts, distribution charts, count overviews (Phase 5).
- Dark mode / theming beyond the light-mode `new-york`/`neutral` baseline.

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: Exchange-rate cache layer (Frankfurter via anti-corruption service, manual refresh, stale fallback) — fills `rate_*` data sources before any USD-aware space exists.
- Phase 3: Spaces (country + channel + amount/currency + opening date + structured period + one mother account) with auto-computed expiry and frozen USD snapshot written into the reserved columns.
- Phase 4: Child accounts (codex/chatgpt) under spaces + safe cascade delete in one transaction.
- Phase 5: Dashboard — expiry alerts, total USD spend, distribution by country/currency/channel, count overviews.
