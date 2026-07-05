# Phase 2: Exchange-Rate Layer - Pattern Map

**Mapped:** 2026-06-28
**Files analyzed:** 11 (9 new, 2 modified)
**Analogs found:** 11 / 11 (every file mirrors a verified Phase 1 counterpart)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/schema.ts` (MODIFY) | model / schema | transform | `currency` / `paymentChannel` tables in same file | exact |
| `src/db/fxRates.ts` (NEW) | query module | CRUD (upsert/read) | `src/db/channels.ts` | exact |
| `src/db/fxRates.query.test.ts` (NEW) | test | CRUD | `src/db/channels.query.test.ts` | exact |
| `src/lib/validation/fx.ts` (NEW) | validation | transform (input boundary) | `src/lib/validation/channel.ts` | role-match (external response vs form) |
| `src/lib/fx/frankfurter.ts` (NEW) | service (anti-corruption) | request-response + transform | `src/db/channels.ts` (query usage) + `src/db/seed.ts` (CURRENCY_SEED) | partial (no existing external-fetch service) |
| `src/lib/fx/frankfurter.test.ts` (NEW) | test | request-response | `src/db/channels.query.test.ts` + `src/test/db-harness.ts` | partial (fetch-mock is new) |
| `src/actions/fx.ts` (NEW) | Server Action | request-response (write) | `src/actions/channels.ts` | exact |
| `src/actions/fx.test.ts` (NEW) | test | request-response | `src/actions/channels.test.ts` | exact |
| `src/app/reference-data/rates/page.tsx` (NEW) | RSC page | request-response (read) | `src/app/reference-data/currencies/page.tsx` + `channels/page.tsx` | exact |
| `src/components/fx/rate-table.tsx` (NEW) | component (client) | event-driven | `src/components/channels/channel-table.tsx` | role-match |
| `src/components/nav/sidebar.tsx` (MODIFY) | component (nav) | static | itself (add `referenceChildren` entry) | exact (self-edit) |

## Pattern Assignments

### `src/db/schema.ts` (MODIFY — add `fxRate` table)

**Analog:** `currency` and `paymentChannel` tables in the same file (lines 10-30).

**Imports already present** (lines 1-2) — no new imports needed for a text-PK table:
```typescript
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
```

**Core pattern — text-PK table with FK + `$inferSelect` export.** Mirror the `currency` table's PK style (text primary key) and the FK reference style used by `space` (lines 44-46):
```typescript
// add to src/db/schema.ts (RESEARCH §"fx_rate schema addition")
export const fxRate = sqliteTable("fx_rate", {
  currencyCode: text("currency_code")
    .primaryKey()                       // one row per currency (D-01)
    .references(() => currency.code),   // FK to the seeded currency list
  rateToUsd: text("rate_to_usd").notNull(),  // X→USD decimal STRING, never float (D-02)
  fetchedAt: text("fetched_at").notNull(),   // ISO wall-clock of successful fetch (D-05/D-07)
  // OPTIONAL (Pitfall 4 / A1): rateDate: text("rate_date"),  // Frankfurter publication date
});
export type FxRateRow = typeof fxRate.$inferSelect;  // mirrors ChannelRow export style
```

**Conventions to copy:**
- Money/rate values are `text` (decimal string), never `integer`/float — matches `space.rateUsed` (line 53: `text("rate_used"), // decimal string, not float`).
- Export an inferred row type next to the table (mirrors `type ChannelRow = typeof paymentChannel.$inferSelect` style used in `channels.ts`).
- After editing, run the Phase 1 migration flow: `pnpm db:generate` (emits `drizzle/0001_*.sql`, commit it) → `pnpm db:migrate`.

---

### `src/db/fxRates.ts` (NEW — query module, CRUD)

**Analog:** `src/db/channels.ts` (exact structural twin).

**Imports + Db type pattern** (channels.ts lines 1-14):
```typescript
import { desc } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { fxRate } from "./schema";

// Mirror channels.ts: take an explicit `db` so helpers run against BOTH the
// production singleton AND the in-memory test harness.
type Db = BetterSQLite3Database<Record<string, unknown>>;
export type FxRateRow = typeof fxRate.$inferSelect;
```

**Read helpers** — mirror `listChannels` (channels.ts lines 19-32, the `.select().from().orderBy().all()` shape):
```typescript
export function listRates(db: Db): FxRateRow[] {
  return db.select().from(fxRate).orderBy(fxRate.currencyCode).all();
}
export function getMostRecentFetchedAt(db: Db): string | null {
  const row = db.select({ fetchedAt: fxRate.fetchedAt }).from(fxRate)
    .orderBy(desc(fxRate.fetchedAt)).limit(1).get();
  return row?.fetchedAt ?? null;
}
```

**Write helper — atomic upsert (new vs channels.ts).** channels.ts uses single `.insert().returning().get()` / `.update()` calls; here use a `db.transaction` wrapping `onConflictDoUpdate` so all 6 rows are written all-or-nothing (Pitfall 1). Source: RESEARCH Pattern 2:
```typescript
export function upsertRates(db: Db, rows: FxRateInsert[]): void {
  db.transaction(() => {                       // all-or-nothing (better-sqlite3 sync tx)
    for (const r of rows) {
      db.insert(fxRate).values(r)
        .onConflictDoUpdate({ target: fxRate.currencyCode, set: { rateToUsd: r.rateToUsd, fetchedAt: r.fetchedAt } })
        .run();
    }
  })();
}
```

**Conventions to copy from channels.ts:** explicit `db` parameter (never import the singleton inside the module), Drizzle parameterized builders only (no string SQL — T-03-SQLI discipline), JSDoc header documenting the security/data-access intent.

---

### `src/db/fxRates.query.test.ts` (NEW — test, CRUD)

**Analog:** `src/db/channels.query.test.ts` (exact structural twin).

**Harness + lifecycle pattern** (channels.query.test.ts lines 1-20):
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb } from "@/test/db-harness";
import { listRates, upsertRates, getMostRecentFetchedAt } from "@/db/fxRates";
import { fxRate } from "@/db/schema";

describe("fx_rate queries (FX-01 / D-01..D-03)", () => {
  let ctx: ReturnType<typeof createTestDb>;
  beforeEach(() => { ctx = createTestDb(); });
  afterEach(() => { ctx.sqlite.close(); });
  // ... it(...) cases
});
```

**Test-case style to copy:** one `it` per behavior with a plain-language D-reference in the title (e.g. channels test line 29 `"archive (soft-delete) preserves the row..."`). Cover from RESEARCH Test Map: upsert writes all 6 rows, re-run upserts without duplicating (PK conflict path), USD stored as `"1"`, `getMostRecentFetchedAt` returns latest.

**Note:** `createTestDb()` auto-applies `./drizzle` migrations (db-harness.ts lines 15-21), so the new `0001_*.sql` migration must be committed before these tests pass — same flow Phase 1 relied on.

---

### `src/lib/validation/fx.ts` (NEW — validation, input boundary)

**Analog:** `src/lib/validation/channel.ts` (role-match — Zod schema + `z.infer` export; data is an external API response, not a form).

**Pattern to copy** (channel.ts lines 1-15): `import { z }`, export a named schema, export `z.infer` type, JSDoc explaining this is the ASVS V5 trust boundary. Source: RESEARCH Code Examples:
```typescript
import { z } from "zod";

const positiveRate = z.number().finite().positive(); // rejects 0, negative, NaN, Infinity

export const frankfurterResponseSchema = z.object({
  amount: z.literal(1).or(z.number().positive()),
  base: z.literal("USD"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rates: z.record(z.string().length(3), positiveRate),
});
export type FrankfurterResponse = z.infer<typeof frankfurterResponseSchema>;
```

**Difference from channel.ts:** channel.ts validates user form input (`name` trim/min); this validates an untrusted *external* response. Same discipline (parse only known fields, reject bad values), different source. The JSDoc should state "validates the Frankfurter response — the anti-corruption boundary" (mirror channel.ts's ASVS V5 comment at lines 3-10).

---

### `src/lib/fx/frankfurter.ts` (NEW — anti-corruption service)

**Analog:** partial. No existing service does outbound `fetch`, so compose from: `src/db/channels.ts` (how to call query helpers with the `db` singleton), `src/db/seed.ts` `CURRENCY_SEED` (the 6-currency list), and `src/db/index.ts` (Node-runtime constraint comment). Full reference pattern in RESEARCH Pattern 1 & 2.

**Imports — wires the cache + validation + seed together:**
```typescript
import { db } from "@/db";
import { listRates, upsertRates, getMostRecentFetchedAt } from "@/db/fxRates";
import { frankfurterResponseSchema } from "@/lib/validation/fx";
import { CURRENCY_SEED } from "@/db/seed";  // authoritative 6-currency list (seed.ts lines 6-13)
```

**Core: the single fetch→validate→invert→upsert path** (RESEARCH Pattern 1, `refreshFromApi`): fetch with `AbortSignal.timeout(4000)`, `frankfurterResponseSchema.parse(json)`, inject `USD = "1"` (D-03), invert each rate, `upsertRates`, return `{ rates, fetchedAt, stale: false }`.

**Error handling — the load-bearing FX-03 pattern.** On ANY throw, fall back to cache and flag stale; never write 0/NULL (Pitfalls 1, 5):
```typescript
  } catch {
    const cached = listRates(db);
    return { rates: cached, fetchedAt: getMostRecentFetchedAt(db), stale: cached.length > 0 };
  }
```

**Inversion guard** (Pitfall 2, decimal-string money math — no floats persisted):
```typescript
function invertToUsd(usdToX: number): string {
  if (!Number.isFinite(usdToX) || usdToX <= 0) throw new Error("bad rate"); // never 0/NULL
  return (1 / usdToX).toPrecision(12).replace(/\.?0+$/, "");
}
```

**Lazy-refresh decision** (`ensureFreshRates`, D-07): if `getMostRecentFetchedAt` is within ~24h, serve cache with `stale: false`; otherwise call `refreshFromApi`. See RESEARCH Pattern 1 lines 237-246.

**Critical constraints (RESEARCH Anti-Patterns):** this is the ONLY module allowed to `fetch` Frankfurter; `stale` is computed per-request, never a DB column; runs Node runtime only (better-sqlite3 native module).

---

### `src/lib/fx/frankfurter.test.ts` (NEW — test, request-response)

**Analog:** `src/db/channels.query.test.ts` (harness lifecycle) + new `fetch` stubbing.

**Copy** the `createTestDb` + `beforeEach`/`afterEach` lifecycle from channels.query.test.ts (lines 11-20). **New for this file:** mock `fetch` per RESEARCH Validation Architecture: `vi.stubGlobal("fetch", vi.fn())` (or `vi.spyOn(globalThis, "fetch")`). Cover the RESEARCH Test Map rows: valid response → inverted X→USD + `stale:false`; timeout/throw → cached + `stale:true`, DB unchanged; malformed/0/negative → Zod rejects, no write; empty cache + failed fetch → `rates:[]`, no crash; `ensureFreshRates` fresh-vs-stale branch; inversion precision (CNY 6.7982 → ~0.14709).

---

### `src/actions/fx.ts` (NEW — Server Action, write)

**Analog:** `src/actions/channels.ts` (exact structural twin).

**Header + imports pattern** (channels.ts lines 1-11):
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { refreshFromApi } from "@/lib/fx/frankfurter";
```

**Result-type + action pattern** (channels.ts lines 26-39 — the `{ ok: true } | { ok: false; error }` discriminated union, call the helper, `revalidatePath`, return result):
```typescript
const RATES_PATH = "/reference-data/rates";

export type RefreshRatesResult =
  | { ok: true; stale: boolean; fetchedAt: string | null }
  | { ok: false; error: string };

export async function refreshRates(): Promise<RefreshRatesResult> {
  const result = await refreshFromApi();   // service owns fetch+validate+fallback
  revalidatePath(RATES_PATH);
  return { ok: true, stale: result.stale, fetchedAt: result.fetchedAt };
}
```

**Conventions to copy:** `"use server"` at top, a `*_PATH` constant for `revalidatePath` (channels.ts line 24), discriminated-union return type. **Difference:** this action takes NO client input (RESEARCH Pitfall 6) — the trust boundary is the Zod validation inside the service, not input re-parsing. So unlike channels.ts there is no `safeParse` of client args here; document that in the JSDoc.

---

### `src/actions/fx.test.ts` (NEW — test, request-response)

**Analog:** `src/actions/channels.test.ts` (exact structural twin).

**Copy the mock wiring verbatim** (channels.test.ts lines 4-23 — the `vi.hoisted` db-holder, `vi.mock("next/cache")`, `vi.mock("@/db")` getter pattern):
```typescript
const dbHolder = vi.hoisted(() => ({ current: null as unknown as TestDb }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", () => ({ get db() { return dbHolder.current; } }));
// beforeEach: ctx = createTestDb(); dbHolder.current = ctx.db;
```

**Additional mock (new):** also `vi.stubGlobal("fetch", ...)` since `refreshRates` reaches the service that fetches. Cover: `refreshRates` persists rows on success (mirror channels.test.ts line 37-44 assertion style — select rows, assert length/values).

---

### `src/app/reference-data/rates/page.tsx` (NEW — RSC page, read)

**Analog:** `src/app/reference-data/currencies/page.tsx` (RSC + `force-dynamic`) and `channels/page.tsx` (RSC → client table handoff).

**Force-dynamic + RSC pattern** (currencies/page.tsx lines 13-16, channels/page.tsx lines 5-6):
```typescript
// better-sqlite3 is a native module — keep this RSC on the Node runtime (Pitfall 3).
export const dynamic = "force-dynamic";

export default async function RatesPage() {
  const { rates, fetchedAt, stale } = await ensureFreshRates();  // lazy refresh on load (D-07/D-08)
  return <RateTable rates={rates} fetchedAt={fetchedAt} stale={stale} />;
}
```

**Pattern to copy from channels/page.tsx (lines 8-21):** RSC fetches server-side, then hands data to a `"use client"` table component as props. **Difference from currencies/page.tsx:** that page renders the table inline; the Rates page delegates to a client component because it needs an interactive refresh button (like channels). Use the `ensureFreshRates()` service call instead of a direct `db.select` so the lazy-refresh trigger runs.

---

### `src/components/fx/rate-table.tsx` (NEW — client component, event-driven)

**Analog:** `src/components/channels/channel-table.tsx` (role-match — `"use client"` + `useTransition` + Server Action + toast).

**Imports + refresh-handler pattern** (channel-table.tsx lines 1-13, 44, 51-64):
```typescript
"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, TriangleAlert } from "lucide-react";  // RESEARCH Supporting libs
import { refreshRates } from "@/actions/fx";
import type { FxRateRow } from "@/db/fxRates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
```

**Refresh handler — copy the `startTransition` + try/catch + toast shape** from `onReactivate` (channel-table.tsx lines 51-64):
```typescript
const [isPending, startTransition] = useTransition();
function onRefresh() {
  startTransition(async () => {
    try {
      const res = await refreshRates();
      if (res.ok && !res.stale) toast.success("汇率已更新");
      else if (res.ok && res.stale) toast.warning("汇率刷新失败,已使用缓存");
      else toast.error("刷新失败,请重试。");
      router.refresh();
    } catch { toast.error("刷新失败,请重试。"); }
  });
}
```

**Table + page-shell layout** — copy the `<div className="flex flex-col gap-6 p-6">` shell, the `h1` title row with a right-aligned action button (channel-table.tsx lines 68-100), and the shadcn `<Table>` markup. **New UI for this phase:** a stale banner/badge (`TriangleAlert` + `Badge`) shown only when `stale === true` (D-04), and an always-visible "rates as of `<fetchedAt>`" label (D-05). Empty-state pattern (channel-table.tsx lines 66, 90-100): when `rates.length === 0` show a distinct "rates unavailable" empty state, not a table of zeros (Pitfall 5).

---

### `src/components/nav/sidebar.tsx` (MODIFY — nav)

**Analog:** itself — add a third entry to the `referenceChildren` array (lines 32-35):
```typescript
const referenceChildren = [
  { label: "支付渠道", href: "/reference-data/channels", icon: CreditCard },
  { label: "币种", href: "/reference-data/currencies", icon: Coins },
  { label: "汇率", href: "/reference-data/rates", icon: Coins },  // NEW — pick a distinct icon
] as const;
```
Note `Coins` is already imported (line 10); for visual distinction import a different lucide icon (e.g. `TrendingUp` / `Banknote`) and add it to the import block (lines 5-11). No other change — the existing `.map` over `referenceChildren` (lines 81-98) renders it automatically.

## Shared Patterns

### Node-runtime constraint (better-sqlite3)
**Source:** `src/db/index.ts` lines 5-13 header comment; `currencies/page.tsx` line 13-14.
**Apply to:** `rates/page.tsx`, `actions/fx.ts`, `frankfurter.ts`, and any future `/api/fx/*` route.
Never set `runtime = "edge"`; RSC pages add `export const dynamic = "force-dynamic"`. The native module crashes on Edge (Pitfall 3).

### Explicit-`db` query helpers (testability)
**Source:** `src/db/channels.ts` lines 14, 19 (every helper takes `db: Db` as first arg).
**Apply to:** `src/db/fxRates.ts`.
Lets the same helpers run against the production singleton and `createTestDb()`'s in-memory DB. Never import the `@/db` singleton inside a query module.

### Zod-at-the-boundary (ASVS V5)
**Source:** `src/lib/validation/channel.ts` lines 3-13; re-parse discipline in `src/actions/channels.ts` lines 29-31.
**Apply to:** `src/lib/validation/fx.ts` + `src/lib/fx/frankfurter.ts`.
Validate untrusted input before it touches the DB. For FX the untrusted input is the *external API response* (not client data) — parse it with `frankfurterResponseSchema` before upserting; reject 0/negative/NaN.

### Discriminated-union action result + revalidatePath
**Source:** `src/actions/channels.ts` lines 24-39.
**Apply to:** `src/actions/fx.ts`.
`"use server"`, a `*_PATH` constant, `{ ok: true } | { ok: false; error }` return, `revalidatePath(PATH)` after a successful write.

### Test harness + mock wiring
**Source:** `src/test/db-harness.ts` (`createTestDb`), `src/db/channels.query.test.ts` lines 11-20 (lifecycle), `src/actions/channels.test.ts` lines 4-23 (`vi.hoisted` db-holder + `vi.mock("@/db")` + `vi.mock("next/cache")`).
**Apply to:** all three new test files. FX service/action tests additionally stub `fetch` via `vi.stubGlobal("fetch", vi.fn())`.

### Client write component (useTransition → Server Action → toast → router.refresh)
**Source:** `src/components/channels/channel-table.tsx` lines 44, 51-64.
**Apply to:** `src/components/fx/rate-table.tsx` refresh button.

### RSC → client-table handoff
**Source:** `src/app/reference-data/channels/page.tsx` lines 8-21.
**Apply to:** `src/app/reference-data/rates/page.tsx` — RSC reads server-side, passes data as props to the `"use client"` table.

## No Analog Found

No file is fully without an analog, but two have only *partial* coverage (planner should lean on RESEARCH patterns for the gaps):

| File | Role | Data Flow | Gap (use RESEARCH instead) |
|------|------|-----------|----------------------------|
| `src/lib/fx/frankfurter.ts` | service | request-response | No existing outbound-`fetch`/anti-corruption service in the codebase. Use RESEARCH Pattern 1 & 2 for fetch+timeout+invert+fallback; reuse `channels.ts` query-call style and `seed.ts` `CURRENCY_SEED`. |
| `src/lib/fx/frankfurter.test.ts` | test | request-response | No existing `fetch`-mocking test. Use RESEARCH Validation Architecture (`vi.stubGlobal("fetch", ...)`); reuse channels test harness lifecycle. |

## Metadata

**Analog search scope:** `src/db/`, `src/lib/validation/`, `src/actions/`, `src/app/reference-data/`, `src/components/channels/`, `src/components/nav/`, `src/test/`
**Files scanned:** 12 Phase 1 files (all verified analogs from RESEARCH Sources)
**Pattern extraction date:** 2026-06-28
