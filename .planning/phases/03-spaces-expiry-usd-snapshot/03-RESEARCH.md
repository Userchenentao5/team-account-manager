# Phase 3: Spaces (Expiry + USD Snapshot) - Research

**Researched:** 2026-06-28
**Domain:** Server Actions CRUD + calendar date math + frozen FX/money snapshot (Next.js 16 / Drizzle / better-sqlite3 / date-fns)
**Confidence:** HIGH

## Summary

This phase is a vertical CRUD slice built entirely on stack and patterns **already present and proven in this repo** (Phases 1–2). No new external packages are required — every library needed (`date-fns@4.4.0`, `drizzle-orm@0.45.2`, `better-sqlite3@12.11.1`, `zod@4.4.3`, `react-hook-form@7.80`, `shadcn/ui`) is installed and in active use. The work is: (1) add a `mother_account` table 1:1 with `space`; (2) write a save-time pipeline that freezes the FX snapshot and computes the calendar-aware expiry date; (3) build the space list (sort/filter via search params), detail, and create/edit forms following the existing channel-CRUD conventions verbatim.

The two genuinely subtle areas are **date math** and **the async/sync transaction boundary**. date-fns `addMonths`/`addQuarters`/`addYears` month-end + leap-year clamping was verified empirically against the installed `date-fns@4.4.0` — all 9 EXP-01 edge cases produce the expected result. The transaction risk is that `ensureFreshRates()` is **async** while better-sqlite3 / Drizzle transactions are **synchronous** — the rate refresh MUST be awaited *before* opening the transaction, and the `db.transaction()` callback must contain only synchronous DB calls.

**Primary recommendation:** Mirror the existing channel slice (validation/channel.ts → actions/channels.ts → RSC page → "use client" table/dialog) for the space slice. Add two pure, unit-tested helpers — `addPeriod()` (date-fns wrapper) and `freezeUsdMinor()` (exact integer/BigInt money math) — and call them inside a Server Action that does `ensureFreshRates()` → read cache (block if missing) → compute → single sync `db.transaction` writing `space` + `mother_account`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**FX snapshot (FX-02):**
- **D-01**: On save, call `ensureFreshRates()` to ensure rate freshness, then read the currency's current value from the `fx_rate` cache: `rate_to_usd` → `rate_used`, cache `fetched_at` → `rate_as_of`, `rate_source = 'frankfurter'`.
- **D-02**: If the currency has **no rate in cache** (empty cache + refresh failed), **block the save** and prompt the user to refresh rates first — never write `0`/`NULL` `amount_usd`. USD base is always treated as 1.
- **D-03**: `amount_usd` is computed and frozen once at save (`amount_minor × rate_used`, rounded to USD minor units, stored as integer). On edit, do NOT recompute the historical snapshot unless the user changed the amount/currency (freeze semantics).

**Mother account (ACCT-01):**
- **D-04**: New standalone `mother_account` table, **1:1** with `space` (FK `space_id`), paving the way for Phase 4 child accounts and SPACE-05 cascade delete — NOT a column on the `space` row.
- **D-05**: Mother account fields are only email / login name (project constraint: no passwords / sensitive credentials).

**Expiry status & list (SPACE-02, EXP-01):**
- **D-06**: List default sort = **expiry date ascending** (soonest-expiring first); supports filtering by country and payment channel.
- **D-07**: Tri-state expiry status color-coded: **expired** / **expiring soon (≤7 days)** / **normal**. "Expiring soon" threshold = 7 days.

**Calendar expiry algorithm (EXP-01):**
- **D-08**: Use date-fns `addMonths`/`addQuarters`/`addYears` with their **default month-end clamping** (e.g. 1/31 + 1mo = 2/28, leap year = 2/29), correctly handling month-end and leap years.
- **D-09**: Period unit limited to **month / quarter / year** (`period_unit` ∈ {month, quarter, year}); store structured `{unit, count}`.

### Claude's Discretion
- Amount-input UI (user enters major unit e.g. 19.99 → convert to minor units for storage), form validation (Zod + RHF), space detail/edit page layout, list pagination or not — decide per existing shadcn/ui + Server Actions patterns.
- Selectable currencies come from the Phase 1 seeded currency list.
- The detail page "child accounts" block may render as an empty placeholder this phase (child CRUD is Phase 4).

### Deferred Ideas (OUT OF SCOPE)
- Child account (codex/chatgpt) add/edit/delete — Phase 4 (ACCT-02/03).
- Space delete + cascade delete of mother/child accounts — Phase 4 (SPACE-05); the `mother_account` FK design must reserve for this (consider onDelete cascade when creating the table this phase).
- Summary/distribution/expiry-alert dashboard — Phase 5 (DASH-*).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SPACE-01 | Create space (country, payment channel, original amount+currency, opening date, subscription period) + its one mother account | Space form + Zod schema (§Code Examples), `createSpace` Server Action with same-transaction `space`+`mother_account` insert (§Pattern 2). All inputs validated against seeded reference data. |
| SPACE-02 | Space list, sortable by expiry, filterable by country / payment channel | RSC list page reading `searchParams` (§Pattern 4), Drizzle `orderBy(asc(space.expiryDate))` + conditional `where`. Lexicographic sort of `YYYY-MM-DD` text == chronological. |
| SPACE-03 | Space detail (mother account, expiry, original amount, frozen USD) | RSC detail page `/spaces/[id]`, Drizzle join `space` ⨝ `mother_account` ⨝ `payment_channel` ⨝ `currency`. Child-account block = empty placeholder (D's discretion). |
| SPACE-04 | Edit space info | `updateSpace` Server Action; re-freeze USD ONLY if amount/currency changed (D-03 freeze semantics, §Pitfall 5). |
| ACCT-01 | One mother account (email/login) per space, 1:1 | New `mother_account` table, unique FK `space_id` → `space.id` onDelete cascade (D-04/D-05, §Standard Stack / §Pattern 1). |
| EXP-01 | Auto-compute expiry = opening date + period (calendar-aware, month-end/leap correct) | `addPeriod()` helper wrapping date-fns `addMonths`/`addQuarters`/`addYears` — clamping verified empirically (§Code Examples, §State of the Art). |
| FX-02 | Freeze rate + USD amount at payment time on the space row | Save pipeline D-01/D-02/D-03: `ensureFreshRates()` → read `fx_rate` → `freezeUsdMinor()` → store `rate_used`/`rate_as_of`/`rate_source`/`amount_usd` (§Pattern 2, §Code Examples). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Space/mother CRUD writes | API / Backend (Server Actions) | — | Server Actions are this project's write API; re-parse input server-side (public endpoint). |
| FX snapshot freeze (FX-02) | API / Backend (Server Action + fx service) | Database (fx_rate cache) | `ensureFreshRates()` + cache read + money math happen server-side before the DB write. |
| Expiry computation (EXP-01) | API / Backend (pure lib fn) | — | Pure deterministic function; computed at write time, stored. Not a client concern. |
| Persistence + 1:1 integrity | Database / Storage | — | SQLite FK (`foreign_keys = ON`) + unique `space_id` enforce 1:1. |
| List sort/filter | Frontend Server (RSC) | Database | RSC reads `searchParams`, builds parameterized Drizzle query; URL is the state. |
| Expiry tri-state badge (D-07) | Frontend Server (RSC) / render | — | Display-only, recomputed from stored `expiry_date` vs today — never stored. |
| Form state + inline errors | Browser / Client ("use client") | — | RHF + zodResolver for UX; the real trust boundary is the server re-parse. |

## Standard Stack

**No new dependencies.** Everything required is installed and in production use (verified via `package.json` + `node -e "require(...)"`).

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| date-fns | 4.4.0 | `addMonths`/`addQuarters`/`addYears` for EXP-01 expiry | Already the locked choice (D-08); clamping behavior verified empirically. [VERIFIED: local execution] |
| drizzle-orm | 0.45.2 | Schema (`mother_account`), parameterized queries, `db.transaction` | Existing data layer; `better-sqlite3` driver. [VERIFIED: package.json + codebase] |
| better-sqlite3 | 12.11.1 | Embedded SQLite engine (Node runtime only) | Existing engine; **synchronous** transactions. [VERIFIED: package.json] |
| zod | 4.4.3 | Shared form + Server Action validation, mass-assignment guard | Existing pattern (`validation/channel.ts`). [VERIFIED: codebase] |
| react-hook-form | 7.80.0 | Form state for create/edit dialogs/pages | Existing pattern (`channel-dialog.tsx` + `@hookform/resolvers@5.4`). [VERIFIED: codebase] |
| next | 16.2.9 | RSC pages + Server Actions | Existing app router; `export const dynamic = "force-dynamic"` for DB-reading RSC. [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui | (CLI 4.12) | Table/Dialog/Form/Select/Badge/Card primitives (owned in `src/components/ui`) | Reuse installed ones; `Select` (radix) already present for currency/channel/country/period pickers. [VERIFIED: codebase] |
| lucide-react | 1.21.0 | Icons (add/edit, expiry warnings) | Match channel-table icon usage. [VERIFIED: codebase] |
| sonner | 2.0.7 | Toast success/error after Server Action | Existing pattern (`toast.success/error`). [VERIFIED: codebase] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server Action returning `{ok, error}` | `useActionState` / form `action=` | Existing slice uses `useTransition` + `{ok,error}` result + RHF `setError`. Stay consistent — do not introduce a second pattern. |
| BigInt exact money freeze | `Math.round(amountMinor * Number(rate) * 10**dExp)` | Float path works for realistic amounts (single multiply, no accumulation) but **violates CLAUDE.md "no floating-point money math"**. Use BigInt (§Pattern 3). |

**Installation:** None. `git pull` of node_modules already satisfies this phase. New migration only:
```bash
pnpm db:generate   # drizzle-kit generate -> new ./drizzle/000X_*.sql for mother_account
pnpm db:migrate    # tsx src/db/migrate.ts (programmatic, committed .sql is the evidence)
```

## Package Legitimacy Audit

**No external packages are installed in this phase** — all dependencies are pre-existing and verified in Phases 1–2. Package Legitimacy Gate not applicable.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                         CREATE / EDIT SPACE (SPACE-01/04, ACCT-01, FX-02, EXP-01)
 ┌──────────────┐  values  ┌─────────────────────────────────────────────────────────────┐
 │ Space Form   │ ───────▶ │ Server Action  createSpace / updateSpace  ("use server")       │
 │ (client RHF  │          │  1. Zod re-parse (server trust boundary, mass-assign guard)    │
 │  + zod)      │ ◀─────── │  2. await ensureFreshRates()         ← ASYNC (outside txn)     │
 └──────────────┘ {ok,err} │  3. read fx_rate cache for currency  ── missing? ─▶ BLOCK (D-02)│
                           │  4. addPeriod(opening, {unit,count}) → expiry_date  (date-fns)  │
                           │  5. freezeUsdMinor(amountMinor, srcExp, rateToUsd) → amount_usd │
                           │  6. db.transaction(SYNC) {                                      │
                           │       insert space (.returning().get() → id)                    │
                           │       insert mother_account { spaceId, email }                  │
                           │     }                                                           │
                           │  7. revalidatePath('/spaces')                                   │
                           └───────────────┬─────────────────────────────────────────────────┘
                                           │ writes
                                           ▼
                                   ┌──────────────────┐      reads      ┌──────────────────────┐
                                   │ SQLite (WAL,      │ ◀────────────── │ RSC list  /spaces     │
                                   │  foreign_keys=ON) │                 │  searchParams → sort/ │
                                   │  space ⨝ mother   │ ──────────────▶ │  filter; tri-state    │
                                   │  ⨝ channel ⨝ ccy  │      rows        │  badge @ render (D-07)│
                                   └──────────────────┘                 │ RSC detail /spaces/[id]│
                                                                        └──────────────────────┘
                          fx_rate cache (Phase 2) ◀── ensureFreshRates()/refreshFromApi() ──▶ Frankfurter API
```

### Recommended Project Structure (additive, follows existing layout)
```
src/
├── db/
│   ├── schema.ts            # ADD motherAccount table (1:1 FK space_id, onDelete cascade)
│   └── spaces.ts            # NEW: parameterized helpers (insertSpace+mother txn, listSpaces, getSpace, updateSpace) — take explicit `db`
├── lib/
│   ├── expiry.ts            # NEW: addPeriod(openingDate, {unit,count}) -> 'YYYY-MM-DD'; expiryStatus(expiry, today)
│   ├── money.ts             # ADD freezeUsdMinor(amountMinor, srcExp, rateToUsd, usdExp=2)
│   └── validation/space.ts  # NEW: spaceFormSchema (+ mother fields), spaceIdSchema
├── actions/
│   └── spaces.ts            # NEW: "use server" createSpace / updateSpace (Zod re-parse + freeze + txn)
├── app/spaces/
│   ├── page.tsx             # list RSC (force-dynamic, reads searchParams)
│   ├── new/page.tsx         # create (or dialog on list)
│   └── [id]/page.tsx        # detail + edit
└── components/spaces/
    ├── space-table.tsx      # "use client" list + filters (router.push search params)
    ├── space-form.tsx       # "use client" RHF + zodResolver create/edit
    └── expiry-badge.tsx     # tri-state badge (expired/soon/normal)
```

### Pattern 1: `mother_account` 1:1 table with reserved cascade (D-04/D-05)
**What:** Standalone table, unique non-null FK to `space`, cascade delete reserved for SPACE-05.
**When to use:** This phase's schema change.
```typescript
// src/db/schema.ts (ADD). Mirrors existing sqliteTable style.
export const motherAccount = sqliteTable("mother_account", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // unique => enforces 1:1; cascade reserved for SPACE-05 (Phase 4). foreign_keys=ON is set in db/index.ts + harness.
  spaceId: integer("space_id")
    .notNull()
    .unique()
    .references(() => space.id, { onDelete: "cascade" }),
  email: text("email").notNull(), // email / login name ONLY — no password (D-05)
});
export type MotherAccountRow = typeof motherAccount.$inferSelect;
```
- `space` table already has all FX/period/expiry columns (declared nullable in Phase 1, Pattern 2 in schema.ts) — **no column migration needed**, keep them nullable in DB and always populate from the action; enforce presence at the Zod layer.

### Pattern 2: Async-refresh-then-sync-transaction save pipeline (FX-02, the critical pattern)
**What:** Await the async rate refresh BEFORE opening the synchronous better-sqlite3 transaction.
**When to use:** `createSpace` and (conditionally) `updateSpace`.
```typescript
// src/actions/spaces.ts  ("use server")
const parsed = spaceFormSchema.safeParse(input);          // 1. server trust boundary
if (!parsed.success) return { ok: false, error: ... };

await ensureFreshRates();                                  // 2. ASYNC — must be OUTSIDE the txn
const rate = getRate(db, parsed.data.currencyCode);        // 3. read cache (sync)
if (!rate) return { ok: false, error: "该币种暂无汇率,请先到汇率页刷新。" }; // D-02 BLOCK

const expiryDate = addPeriod(parsed.data.openingDate, {    // 4. EXP-01
  unit: parsed.data.periodUnit, count: parsed.data.periodCount });
const srcExp = getCurrencyMinorUnit(db, parsed.data.currencyCode); // JPY=0 etc.
const amountUsd = freezeUsdMinor(parsed.data.amountMinor, srcExp, rate.rateToUsd); // 5. FX-02 freeze

db.transaction((tx) => {                                   // 6. SYNC ONLY — no await inside
  const row = tx.insert(space).values({
    name, country, paymentChannelId, currencyCode, amountMinor,
    periodUnit, periodCount, openingDate, expiryDate,
    rateUsed: rate.rateToUsd, rateAsOf: rate.fetchedAt, rateSource: "frankfurter",
    amountUsd,
  }).returning().get();
  tx.insert(motherAccount).values({ spaceId: row.id, email }).run();
});
revalidatePath("/spaces");                                 // 7.
return { ok: true };
```

### Pattern 3: Exact integer/BigInt USD freeze (CLAUDE.md "no float money math")
**What:** Multiply integer minor units by the decimal-string rate using BigInt, with currency-exponent adjustment and round-half-up.
**When to use:** `freezeUsdMinor` in `money.ts`.
```typescript
// usdMinor = round( amountMinor × rate × 10^(usdExp - srcExp) )
export function freezeUsdMinor(
  amountMinor: number, srcExp: number, rateToUsd: string, usdExp = 2,
): number {
  const [whole, frac = ""] = rateToUsd.split(".");
  const rateInt = BigInt(whole + frac);            // rate × 10^frac.length
  let num = BigInt(Math.abs(amountMinor)) * rateInt;
  let den = 10n ** BigInt(frac.length);
  const d = usdExp - srcExp;                        // USD=2; JPY src → d=+2
  if (d >= 0) num *= 10n ** BigInt(d); else den *= 10n ** BigInt(-d);
  const q = num / den, r = num % den;
  const rounded = r * 2n >= den ? q + 1n : q;       // round half up
  return amountMinor < 0 ? -Number(rounded) : Number(rounded);
}
```
- For USD itself: `rateToUsd === "1"`, `srcExp === usdExp === 2` → returns `amountMinor` unchanged (D-02 USD base = 1). [VERIFIED: arithmetic]
- For 2-decimal source currencies, `d === 0` → `round(amountMinor × rate)`.

### Pattern 4: List sort/filter via search params (SPACE-02 / D-06)
**What:** RSC reads `searchParams`; client filters drive `router.push` (exactly like `channel-table.tsx` `?archived=1`).
```typescript
// src/app/spaces/page.tsx
export const dynamic = "force-dynamic"; // better-sqlite3 = Node runtime (Pitfall: never Edge)
export default async function SpacesPage({ searchParams }: {
  searchParams: Promise<{ country?: string; channel?: string }>;
}) {
  const { country, channel } = await searchParams;
  const spaces = listSpaces(db, { country, channelId: channel ? Number(channel) : undefined });
  return <SpaceTable spaces={spaces} ... />;
}
// listSpaces: db.select()....orderBy(asc(space.expiryDate))  (D-06 default; YYYY-MM-DD text sorts chronologically)
//             conditional where(and(country && eq(...), channelId && eq(...)))
```

### Anti-Patterns to Avoid
- **`await` inside `db.transaction((tx) => {...})`** — better-sqlite3 transactions are synchronous; an async callback silently breaks atomicity. Do all awaits (rate refresh) before the transaction.
- **Storing the expiry tri-state** — D-07 status is derived from `expiry_date` vs today at render; storing it makes it go stale.
- **Recomputing the frozen USD on every edit** — D-03: only re-freeze when amount or currency changed.
- **`new Date("2025-01-31")` for opening date math** — parses as UTC midnight and can shift a day in local TZ (§Pitfall 1). Build local dates from Y/M/D parts.
- **Trusting client-side RHF/Zod** — Server Actions are public endpoints; always re-parse server-side and parse only known fields (mass-assignment guard), per `actions/channels.ts`.
- **Hardcoded `×100` for money** — breaks JPY (exponent 0). Always use the currency's `minorUnit`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Month-end/leap expiry math | Custom day arithmetic | date-fns `addMonths/addQuarters/addYears` (D-08) | Clamping + leap years are subtle; verified correct (§Code Examples). |
| Atomic 2-table write | Sequential inserts with manual rollback | `db.transaction((tx) => {...})` | All-or-nothing; mirrors `upsertRates`. |
| 1:1 enforcement | App-level "check then insert" | `.unique()` on `space_id` FK | DB-enforced, race-free. |
| Money major↔minor conversion | New parsing logic | existing `parseToMinor`/`formatMinor` (`lib/money.ts`) | Already exponent-aware + tested. |
| Cascade delete (Phase 4) | Manual child cleanup later | `onDelete: "cascade"` declared now | SPACE-05 free; `foreign_keys=ON` already set. |
| FX fetch/validation/fallback | New Frankfurter call | `ensureFreshRates()` (`lib/fx/frankfurter.ts`) | Anti-corruption boundary already owns fetch+Zod+invert+stale fallback. |

**Key insight:** This phase should add almost no new "infrastructure" — it composes Phase 1 (money/schema/reference data) and Phase 2 (fx service) primitives. The only new pure logic is `addPeriod` + `freezeUsdMinor`, both small and unit-testable.

## Common Pitfalls

### Pitfall 1: Timezone drift parsing `YYYY-MM-DD` opening dates
**What goes wrong:** `new Date("2025-01-31")` is parsed as **UTC** midnight; in a negative-UTC-offset runtime it becomes 2025-01-30 local, so `addMonths` then clamps off the wrong base date.
**Why it happens:** ISO date-only strings are spec'd as UTC; date-fns operates on the resulting local `Date`.
**How to avoid:** Build a local date from parts before date math, and format back with date-fns (no `toISOString().slice(0,10)`):
```typescript
const [y, m, d] = openingDate.split("-").map(Number);
const base = new Date(y, m - 1, d);              // local midnight, no drift
return format(addMonths(base, count), "yyyy-MM-dd"); // date-fns format == local
```
**Warning signs:** Expiry off by one day only on certain machines/CI; `openingDate` round-trips wrong.

### Pitfall 2: `await` inside a better-sqlite3 transaction
**What goes wrong:** `db.transaction(async (tx) => { await ... })` returns a promise that resolves outside the synchronous transaction window → no atomicity, confusing errors.
**Why it happens:** better-sqlite3 is synchronous by design; `ensureFreshRates()` is async.
**How to avoid:** Await the rate refresh and compute everything first; transaction callback is synchronous and only inserts.
**Warning signs:** "Transaction function cannot return a promise" or partial writes under failure.

### Pitfall 3: Wrong minor-unit exponent for JPY in the freeze
**What goes wrong:** Treating the source amount as 2-decimal corrupts JPY (exponent 0) USD totals.
**How to avoid:** Look up `currency.minorUnit` for the space's currency and pass it as `srcExp` to `freezeUsdMinor`; USD target exponent is 2.
**Warning signs:** JPY spaces show ~100× wrong USD.

### Pitfall 4: Edge runtime on a DB-reading route
**What goes wrong:** better-sqlite3 is a native module; the Edge runtime cannot load it.
**How to avoid:** Keep `export const dynamic = "force-dynamic"` (as channels/rates pages do); never set `runtime = "edge"` on routes/actions that import `@/db`.
**Warning signs:** Native module load error in build/runtime.

### Pitfall 5: Re-freezing USD on every edit
**What goes wrong:** Editing only the space name re-reads today's rate and overwrites the historical snapshot — violates freeze semantics (D-03).
**How to avoid:** In `updateSpace`, compare submitted `amountMinor`+`currencyCode` against the stored row; re-run the freeze pipeline **only** if either changed, otherwise keep existing `rate_used`/`rate_as_of`/`amount_usd`.
**Warning signs:** `amount_usd` / `rate_as_of` changes on unrelated edits.

### Pitfall 6: Validating against inactive reference data
**What goes wrong:** Accepting a soft-deleted (`is_active = 0`) payment channel or inactive currency.
**How to avoid:** Server-side, verify `paymentChannelId` exists among active channels (`listChannels(db)`) and `currencyCode` is an active seeded currency; reject otherwise (don't trust the client's select options).

## Code Examples

### Calendar-aware expiry (EXP-01) — verified against installed date-fns@4.4.0
```typescript
// src/lib/expiry.ts
import { addMonths, addQuarters, addYears, format, differenceInCalendarDays } from "date-fns";

export type PeriodUnit = "month" | "quarter" | "year";

export function addPeriod(openingDate: string, p: { unit: PeriodUnit; count: number }): string {
  const [y, m, d] = openingDate.split("-").map(Number);
  const base = new Date(y, m - 1, d); // local — avoids UTC drift (Pitfall 1)
  const next =
    p.unit === "month"   ? addMonths(base, p.count) :
    p.unit === "quarter" ? addQuarters(base, p.count) :
                           addYears(base, p.count);
  return format(next, "yyyy-MM-dd");
}

// D-07 tri-state (display only; computed, never stored)
export function expiryStatus(expiry: string, today = new Date()): "expired" | "soon" | "normal" {
  const [y, m, d] = expiry.split("-").map(Number);
  const days = differenceInCalendarDays(new Date(y, m - 1, d), today);
  if (days < 0) return "expired";
  if (days <= 7) return "soon";      // ≤7 days (D-07)
  return "normal";
}
```
**Empirically verified clamping (date-fns@4.4.0, `node` execution 2026-06-28):** [VERIFIED: local execution]

| Input | Result | Note |
|-------|--------|------|
| `addMonths(Jan31 2025, 1)` | `2025-02-28` | month-end clamp (non-leap) |
| `addMonths(Jan31 2024, 1)` | `2024-02-29` | month-end clamp (leap) |
| `addMonths(Jan31 2025, 3)` | `2025-04-30` | clamp to 30-day April |
| `addMonths(Aug31 2025, 6)` | `2026-02-28` | clamp + year cross |
| `addMonths(Mar15 2025, 1)` | `2025-04-15` | normal, no clamp |
| `addQuarters(Nov30 2025, 1)` | `2026-02-28` | = addMonths ×3 + clamp |
| `addYears(Feb29 2024, 1)` | `2025-02-28` | leap-day clamp |
| `addYears(Feb29 2024, 4)` | `2028-02-29` | lands on next leap |
| `addMonths(Dec31 2025, 1)` | `2026-01-31` | year cross, no clamp |

### Space validation schema (SPACE-01, mass-assignment guard)
```typescript
// src/lib/validation/space.ts  (shared client RHF + server re-parse, like validation/channel.ts)
import { z } from "zod";
export const spaceFormSchema = z.object({
  name: z.string().trim().min(1, "请输入空间名称。"),
  country: z.string().length(2),                 // validated against COUNTRIES server-side
  paymentChannelId: z.number().int().positive(), // validated active server-side
  currencyCode: z.string().length(3),            // validated active-seeded server-side
  amountMinor: z.number().int().positive(),       // form converts major→minor via parseToMinor
  openingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodUnit: z.enum(["month", "quarter", "year"]),  // D-09
  periodCount: z.number().int().positive(),
  motherEmail: z.string().trim().min(1, "请输入母账号邮箱/登录名。"), // ACCT-01 / D-05
});
export type SpaceFormInput = z.infer<typeof spaceFormSchema>;
export const spaceIdSchema = z.object({ id: z.number().int().positive() });
```

### Reading the cached rate for the freeze (D-01)
```typescript
// add to src/db/fxRates.ts (parameterized, takes explicit db)
export function getRate(db: Db, currencyCode: string): FxRateRow | undefined {
  return db.select().from(fxRate).where(eq(fxRate.currencyCode, currencyCode)).get();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-written REST + client fetch | Next 16 Server Actions + RSC | adopted in Phases 1–2 | Forms call actions directly; reads via RSC. Keep. |
| Moment.js add/clamp | date-fns 4 `addMonths` immutable + built-in clamp | date-fns v2+ | Locked (D-08); clamping is the documented + verified default. |
| Float money | integer minor units (+ BigInt freeze) | Phase 1 decision | CLAUDE.md hard rule; freeze must stay float-free. |

**Deprecated/outdated:** none relevant — stack is current (verified 2026-06-27 in CLAUDE.md sources, re-confirmed installed versions 2026-06-28).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `rate_source` literal value is `'frankfurter'` (lowercase) | Pattern 2 / D-01 | Cosmetic; CONTEXT D-01 specifies `'frankfurter'`. Low. |
| A2 | Keeping `space` FX/period columns nullable in DB (enforce non-null at Zod layer) is acceptable vs. a NOT NULL migration | Pattern 1 | If a NOT NULL DB constraint is desired, add a column migration. Low — Phase 1 deliberately left them nullable. |
| A3 | Mother email field has no format/email validation requirement (login names allowed, not strict email) | validation/space.ts | If strict email needed, tighten schema. Low — D-05 says "email/login name". |
| A4 | Create uses a form/page or dialog (D's discretion) — no specific UX mandated | Project Structure | None — explicitly Claude's discretion. |

**Note:** All load-bearing technical claims (date-fns behavior, transaction sync semantics, money math, schema shape, existing conventions) are VERIFIED against the codebase or live library execution — not assumed.

## Open Questions

1. **Currency `minorUnit` lookup at freeze time**
   - What we know: `currency.minorUnit` is the authority (JPY=0). The action needs it to pass `srcExp`.
   - What's unclear: whether to read it via a small `getCurrencyMinorUnit(db, code)` query or join.
   - Recommendation: add a tiny parameterized helper in `db` (single `select` of `currency.minorUnit`); consistent with existing data-helper style.

2. **stale-rate UX on save (CONTEXT specifics)**
   - What we know: D-02 blocks only when the currency has NO cached rate. If `ensureFreshRates()` fails but a cached rate exists, save proceeds with last-known rate.
   - What's unclear: whether to surface a "used stale rate" hint to the user on save.
   - Recommendation: optional — return a `stale` flag in the action result and toast a non-blocking notice; not required for FX-02.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node runtime (better-sqlite3) | All DB access | ✓ | Node 25.5.0 | — (Edge not allowed) |
| date-fns | EXP-01 | ✓ | 4.4.0 | — |
| SQLite file + migrations | Persistence | ✓ | drizzle 0.45.2 / drizzle-kit 0.31.10 | — |
| Frankfurter API | FX-02 freshness (via Phase 2 service) | ✓ (consumed indirectly) | — | Phase 2 last-good cache fallback; D-02 blocks only on fully-empty cache for the currency |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** Frankfurter live fetch — Phase 2 service already degrades to cached rates; this phase blocks save only when the specific currency has no cached rate at all (D-02).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 (`environment: "node"`, globals on) |
| Config file | `vitest.config.ts` (alias `@` → `./src`) |
| Quick run command | `npx vitest run src/lib/expiry.test.ts src/lib/money.test.ts` |
| Full suite command | `pnpm test` (`vitest run`) |

> Note: test env is `node` (no jsdom) — coverage targets pure functions, DB query helpers, and Server Actions, not rendered React components. Use the in-memory `createTestDb()` harness (`src/test/db-harness.ts`) for DB/action tests.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXP-01 | `addPeriod` month-end/leap clamping (9 cases) | unit | `npx vitest run src/lib/expiry.test.ts` | ❌ Wave 0 |
| EXP-01 | `expiryStatus` tri-state boundaries (−1/0/7/8 days) | unit | `npx vitest run src/lib/expiry.test.ts` | ❌ Wave 0 |
| FX-02 | `freezeUsdMinor` for USD(=1), 2-dec, JPY(0-dec), rounding | unit | `npx vitest run src/lib/money.test.ts` | ⚠️ extend existing |
| FX-02 | `createSpace` blocks when currency has no cached rate (D-02) | integration | `npx vitest run src/actions/spaces.test.ts` | ❌ Wave 0 |
| SPACE-01/ACCT-01 | `createSpace` writes space+mother atomically (1:1) | integration | `npx vitest run src/actions/spaces.test.ts` | ❌ Wave 0 |
| SPACE-04 | `updateSpace` re-freezes only on amount/currency change | integration | `npx vitest run src/actions/spaces.test.ts` | ❌ Wave 0 |
| SPACE-02 | `listSpaces` default expiry-asc sort + country/channel filter | unit (db) | `npx vitest run src/db/spaces.query.test.ts` | ❌ Wave 0 |
| ACCT-01 | `mother_account` unique `space_id` rejects 2nd row; cascade FK present | unit (db) | `npx vitest run src/db/spaces.query.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <the file(s) touched>`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/lib/expiry.test.ts` — covers EXP-01 (addPeriod clamping + expiryStatus)
- [ ] `src/lib/money.test.ts` — extend with `freezeUsdMinor` cases (covers FX-02 math)
- [ ] `src/db/spaces.query.test.ts` — covers SPACE-02 sort/filter + ACCT-01 1:1/cascade (uses `createTestDb`)
- [ ] `src/actions/spaces.test.ts` — covers FX-02 block, SPACE-01/04, ACCT-01 atomic write (mock/seed fx_rate + reference data in in-memory DB)
- [ ] New migration generated/committed for `mother_account` before tests run (harness applies `./drizzle`)

## Security Domain

ASVS Level 1, `security_enforcement: true`, block on high.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Single-user tool, no auth (project constraint). |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No multi-user / roles. |
| V5 Input Validation | yes | Zod `spaceFormSchema` re-parsed server-side in every Server Action; parse only known fields (mass-assignment guard); validate FKs/enums/dates against active reference data. |
| V6 Cryptography | no | No secrets stored — D-05 forbids passwords/credentials (email/login only). |

### Known Threat Patterns for {Next.js Server Actions + SQLite}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection | Tampering | Drizzle parameterized builders only — never string SQL (existing convention). |
| Mass assignment via Server Action | Tampering / Elevation | Parse only whitelisted fields with Zod; ignore extras (like `actions/channels.ts`). |
| Trusting client RHF validation | Tampering | Server Action re-parses; client validation is UX-only. |
| Orphaned/duplicate mother account | Integrity | Unique non-null FK `space_id` + `foreign_keys=ON`; single transaction insert. |
| Poisoned/zero FX rate into USD math | Tampering | Phase 2 Zod boundary already rejects 0/neg/NaN/∞; D-02 blocks empty-cache save. |
| Storing sensitive credentials | Info disclosure | Schema has no password column (D-05) — design-level mitigation. |

## Sources

### Primary (HIGH confidence)
- Local execution of `date-fns@4.4.0` `addMonths`/`addQuarters`/`addYears` (2026-06-28) — verified all 9 EXP-01 clamping/leap cases. [VERIFIED: local execution]
- Codebase read: `src/db/schema.ts`, `src/lib/fx/frankfurter.ts`, `src/db/fxRates.ts`, `src/actions/fx.ts`, `src/actions/channels.ts`, `src/lib/money.ts`, `src/lib/validation/{channel,fx}.ts`, `src/db/{channels,seed,index}.ts`, `src/components/channels/*`, `src/test/db-harness.ts`, `vitest.config.ts`, `drizzle.config.ts`, `package.json`. [VERIFIED: codebase]
- Installed versions via `node -e require(...)`: date-fns 4.4.0, better-sqlite3 12.11.1; package.json: drizzle-orm 0.45.2, drizzle-kit 0.31.10, zod 4.4.3, next 16.2.9, react-hook-form 7.80, @hookform/resolvers 5.4. [VERIFIED: tool]

### Secondary (MEDIUM confidence)
- CLAUDE.md prescriptive stack + "What NOT to Use" + money/FX constraints (project authority).

### Tertiary (LOW confidence)
- None — no web/training-only claims were needed; date-fns behavior was verified empirically rather than cited.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all installed/verified, no new packages.
- Architecture/patterns: HIGH — directly mirrors shipped Phase 1–2 code.
- Date math (EXP-01): HIGH — empirically verified against installed library.
- Money freeze (FX-02): HIGH — exact integer algorithm, consistent with existing money.ts + CLAUDE.md.
- Pitfalls: HIGH — grounded in this stack's known sync/Edge/TZ behaviors.

**Research date:** 2026-06-28
**Valid until:** 2026-07-28 (stable stack; re-verify if Next/date-fns/drizzle major bumps)
