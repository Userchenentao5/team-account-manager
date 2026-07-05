# Phase 3: Spaces (Expiry + USD Snapshot) - Pattern Map

**Mapped:** 2026-06-28
**Files analyzed:** 16 (9 new, 4 modified, 1 generated migration, plus 2 reused-as-is)
**Analogs found:** 16 / 16 — every file has a direct in-repo analog (Phases 1–2 shipped the full vertical-slice template).

This phase adds **no new patterns**. It composes the proven channel CRUD slice (form → action → query → RSC page → client table) with the FX service's async-refresh-then-sync-write discipline. The planner should treat the analog files below as copy-from templates, changing only the entity shape.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/schema.ts` (MODIFY: add `motherAccount`) | model | persistence | existing tables in same file (`paymentChannel`, `space`) | exact |
| `src/db/spaces.ts` (NEW) | data-access | CRUD + atomic 2-table txn | `src/db/channels.ts` (queries) + `src/db/fxRates.ts` (`upsertRates` txn) | exact |
| `src/db/fxRates.ts` (MODIFY: add `getRate`) | data-access | request-response read | existing `listRates`/`getMostRecentFetchedAt` in same file | exact |
| `src/db/currencies.ts` (NEW: `getCurrencyMinorUnit`) | data-access | request-response read | `src/db/channels.ts` `findActiveByName` (single-row select) | exact |
| `src/lib/expiry.ts` (NEW: `addPeriod`, `expiryStatus`) | utility (pure) | transform | `src/lib/money.ts` (pure exponent-keyed helpers) | role-match |
| `src/lib/money.ts` (MODIFY: add `freezeUsdMinor`) | utility (pure) | transform | existing `parseToMinor`/`formatMinor` in same file | exact |
| `src/lib/validation/space.ts` (NEW) | validation schema | transform | `src/lib/validation/channel.ts` | exact |
| `src/actions/spaces.ts` (NEW: `createSpace`/`updateSpace`) | controller (Server Action) | request-response + async→sync txn | `src/actions/channels.ts` (re-parse + result shape) + `src/actions/fx.ts` (async service before write) | exact |
| `src/app/spaces/page.tsx` (MODIFY: list RSC) | route (RSC) | request-response read | `src/app/reference-data/channels/page.tsx` | exact |
| `src/app/spaces/new/page.tsx` OR list dialog (NEW) | route / component | request-response | channels page + `channel-dialog.tsx` (D's discretion) | role-match |
| `src/app/spaces/[id]/page.tsx` (NEW: detail/edit RSC) | route (RSC) | request-response read (join) | `src/app/reference-data/channels/page.tsx` | role-match |
| `src/components/spaces/space-table.tsx` (NEW) | component (client) | request-response + URL filters | `src/components/channels/channel-table.tsx` + `src/components/fx/rate-table.tsx` | exact |
| `src/components/spaces/space-form.tsx` (NEW) | component (client) | request-response | `src/components/channels/channel-dialog.tsx` | exact |
| `src/components/spaces/expiry-badge.tsx` (NEW) | component (render) | transform/display | `Badge` usage in `channel-table.tsx` lines 121-127 | role-match |
| `src/lib/expiry.test.ts` + `src/lib/money.test.ts` (MODIFY) + `src/db/spaces.query.test.ts` + `src/actions/spaces.test.ts` (NEW) | test | — | `channels.test.ts`, `channels.query.test.ts`, `db-harness.ts` | exact |
| `drizzle/000X_mother_account.sql` (GENERATED) | migration | — | existing `./drizzle/*.sql` (via `pnpm db:generate`) | exact |

**Reused as-is (do NOT modify, consume directly):**
- `src/lib/fx/frankfurter.ts` — `ensureFreshRates()` (Phase 2). Call in `createSpace`/`updateSpace`.
- `src/lib/countries.ts` — `COUNTRIES` constant for the country picker + server-side validation.
- `src/db/seed.ts` — `CURRENCY_SEED` for the currency picker options.
- `src/test/db-harness.ts` — `createTestDb()` for DB/action tests.

## Pattern Assignments

### `src/db/schema.ts` (MODIFY — add `motherAccount`, model, persistence)

**Analog:** existing tables in the same file. Mirror the `sqliteTable` style of `paymentChannel` (lines 23-30) and the FK style of `space` (lines 60-65).

**FK + 1:1 pattern to copy** (`space` FK style, lines 60-65):
```typescript
paymentChannelId: integer("payment_channel_id")
  .notNull()
  .references(() => paymentChannel.id), // FK preserves integrity (D-07)
```

**New table to add** (after the `space` table, line 78). Add `.unique()` for 1:1 and `onDelete: "cascade"` reserved for SPACE-05 (D-04/D-05):
```typescript
export const motherAccount = sqliteTable("mother_account", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  spaceId: integer("space_id")
    .notNull()
    .unique()                                       // enforces 1:1
    .references(() => space.id, { onDelete: "cascade" }), // SPACE-05 reserved
  email: text("email").notNull(),                   // email / login name ONLY (D-05)
});
export type MotherAccountRow = typeof motherAccount.$inferSelect;
```
- The `space` table (lines 56-78) already has every FX/period/expiry column declared nullable — **no `space` column migration needed**. Keep them nullable in DB; enforce presence at the Zod layer (research A2).
- Type export convention: `export type XRow = typeof table.$inferSelect;` (schema.ts line 49).

---

### `src/db/spaces.ts` (NEW — data-access, CRUD + atomic 2-table transaction)

**Analog:** `src/db/channels.ts` (parameterized helper shape) + `src/db/fxRates.ts` `upsertRates` (the `db.transaction` pattern).

**Explicit-`db` helper convention** (channels.ts lines 14-16) — never import the `@/db` singleton here so the same helpers run against the test harness:
```typescript
type Db = BetterSQLite3Database<Record<string, unknown>>;
export type SpaceRow = typeof space.$inferSelect;
```

**Single-transaction multi-table write** (copy from `fxRates.ts` `upsertRates`, lines 42-54). CRITICAL: the callback is SYNCHRONOUS — no `await` inside (Pitfall 2):
```typescript
db.transaction((tx) => {
  for (const r of rows) {
    tx.insert(fxRate).values(r).onConflictDoUpdate({ ... }).run();
  }
});
```
Adapt for space + mother insert with `.returning().get()` to capture the new id:
```typescript
export function insertSpaceWithMother(db: Db, spaceValues: ..., email: string): SpaceRow {
  return db.transaction((tx) => {
    const row = tx.insert(space).values(spaceValues).returning().get();
    tx.insert(motherAccount).values({ spaceId: row.id, email }).run();
    return row;
  });
}
```

**List with conditional where + orderBy** (D-06; copy the `listChannels` conditional shape, channels.ts lines 19-32; use `asc` from drizzle-orm and `and(...)` like `findActiveByName` line 75):
```typescript
import { and, asc, eq } from "drizzle-orm";
// db.select().from(space).where(and(country && eq(space.country, country), ...))
//   .orderBy(asc(space.expiryDate)).all()   // YYYY-MM-DD text sorts chronologically
```

**Detail join** (SPACE-03): `db.select().from(space).where(eq(space.id, id))` then join `motherAccount`/`paymentChannel`/`currency`. Use Drizzle's `leftJoin`/`innerJoin`; single-row via `.get()` like `findActiveByName` (channels.ts lines 68-77).

---

### `src/db/fxRates.ts` (MODIFY — add `getRate`, data-access read)

**Analog:** existing single-row helper style in the same file. Add alongside `listRates` (lines 22-24):
```typescript
import { eq } from "drizzle-orm";
/** Read one currency's cached rate for the freeze (D-01). */
export function getRate(db: Db, currencyCode: string): FxRateRow | undefined {
  return db.select().from(fxRate).where(eq(fxRate.currencyCode, currencyCode)).get();
}
```
`Db` type and `FxRateRow` are already defined in this file (lines 16-18). Returns `rateToUsd` (→ `rate_used`) and `fetchedAt` (→ `rate_as_of`) per D-01.

---

### `src/db/currencies.ts` (NEW — data-access read, `getCurrencyMinorUnit`)

**Analog:** `findActiveByName` single-column-keyed select (channels.ts lines 68-77). Resolves Open Question 1 — the freeze needs `srcExp` (JPY=0). Mirror the explicit-`db` + parameterized style:
```typescript
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { currency } from "./schema";
type Db = BetterSQLite3Database<Record<string, unknown>>;

export function getCurrencyMinorUnit(db: Db, code: string): number | undefined {
  return db.select({ minorUnit: currency.minorUnit })
    .from(currency).where(eq(currency.code, code)).get()?.minorUnit;
}
```
(`currency.minorUnit` authority defined in schema.ts lines 10-15; JPY=0 in seed.ts line 11.)

---

### `src/lib/expiry.ts` (NEW — pure utility, transform)

**Analog:** `src/lib/money.ts` — pure, dependency-light, exponent/parameter-keyed functions with no DB or I/O. Match the doc-comment + named-export style (money.ts lines 1-26).

**Use date-fns + local-date construction to avoid TZ drift** (Pitfall 1; verified clamping in RESEARCH lines 340-352):
```typescript
import { addMonths, addQuarters, addYears, format, differenceInCalendarDays } from "date-fns";
export type PeriodUnit = "month" | "quarter" | "year";

export function addPeriod(openingDate: string, p: { unit: PeriodUnit; count: number }): string {
  const [y, m, d] = openingDate.split("-").map(Number);
  const base = new Date(y, m - 1, d);              // local midnight — no UTC drift
  const next = p.unit === "month" ? addMonths(base, p.count)
    : p.unit === "quarter" ? addQuarters(base, p.count)
    : addYears(base, p.count);
  return format(next, "yyyy-MM-dd");               // local format, never toISOString().slice
}

export function expiryStatus(expiry: string, today = new Date()): "expired" | "soon" | "normal" {
  const [y, m, d] = expiry.split("-").map(Number);
  const days = differenceInCalendarDays(new Date(y, m - 1, d), today);
  if (days < 0) return "expired";
  if (days <= 7) return "soon";                    // ≤7 days threshold (D-07)
  return "normal";
}
```
- `date-fns` `format` import already proven in `rate-table.tsx` line 4. Status is display-only — never stored (anti-pattern, RESEARCH line 255).

---

### `src/lib/money.ts` (MODIFY — add `freezeUsdMinor`, pure transform)

**Analog:** existing `parseToMinor`/`formatMinor` in the same file (lines 12-47) — exponent-aware, integer-only, throws on bad input. Add `freezeUsdMinor` in the same float-free style. **No `Number` multiply on money** (CLAUDE.md hard rule; RESEARCH line 99):
```typescript
// usdMinor = round( amountMinor × rate × 10^(usdExp - srcExp) ) — BigInt, round-half-up
export function freezeUsdMinor(
  amountMinor: number, srcExp: number, rateToUsd: string, usdExp = 2,
): number {
  const [whole, frac = ""] = rateToUsd.split(".");
  const rateInt = BigInt(whole + frac);
  let num = BigInt(Math.abs(amountMinor)) * rateInt;
  let den = 10n ** BigInt(frac.length);
  const d = usdExp - srcExp;
  if (d >= 0) num *= 10n ** BigInt(d); else den *= 10n ** BigInt(-d);
  const q = num / den, r = num % den;
  const rounded = r * 2n >= den ? q + 1n : q;
  return amountMinor < 0 ? -Number(rounded) : Number(rounded);
}
```
- USD self: `rateToUsd === "1"`, `srcExp === usdExp === 2` → returns `amountMinor` unchanged (D-02 USD base = 1).
- Follow the existing `throw new Error(...)` guard style (money.ts lines 13-17) if validating inputs.

---

### `src/lib/validation/space.ts` (NEW — validation schema, transform)

**Analog:** `src/lib/validation/channel.ts` — shared client RHF + server re-parse, doc-comment explaining the trust boundary, `z.infer` type export, separate `*IdSchema` (channel.ts lines 11-20).

**Schema to write** (mass-assignment guard = parse only known fields; RESEARCH lines 358-371):
```typescript
import { z } from "zod";
export const spaceFormSchema = z.object({
  name: z.string().trim().min(1, "请输入空间名称。"),
  country: z.string().length(2),
  paymentChannelId: z.number().int().positive(),
  currencyCode: z.string().length(3),
  amountMinor: z.number().int().positive(),
  openingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodUnit: z.enum(["month", "quarter", "year"]),  // D-09
  periodCount: z.number().int().positive(),
  motherEmail: z.string().trim().min(1, "请输入母账号邮箱/登录名。"), // D-05
});
export type SpaceFormInput = z.infer<typeof spaceFormSchema>;
export const spaceIdSchema = z.object({ id: z.number().int().positive() });
```

---

### `src/actions/spaces.ts` (NEW — Server Action, request-response + async→sync txn)

**Analog (primary):** `src/actions/channels.ts` — `"use server"`, security doc-comment, `safeParse` + `{ ok: false, error }` result shape, `revalidatePath`, `Result` union type (channels.ts lines 1-39).
**Analog (secondary):** `src/actions/fx.ts` — awaiting an async FX service before touching the DB (fx.ts lines 27-32).

**Result-type + re-parse pattern to copy** (channels.ts lines 26-39):
```typescript
export type SpaceActionResult = { ok: true } | { ok: false; error: string };
const parsed = spaceFormSchema.safeParse(input);
if (!parsed.success) {
  return { ok: false, error: parsed.error.issues[0]?.message ?? "..." };
}
```

**THE critical pattern — await async refresh OUTSIDE the synchronous transaction** (RESEARCH Pattern 2, lines 188-213; Pitfall 2):
```typescript
await ensureFreshRates();                          // ASYNC — must be before db.transaction
const rate = getRate(db, parsed.data.currencyCode);
if (!rate) return { ok: false, error: "该币种暂无汇率,请先到汇率页刷新。" }; // D-02 BLOCK
const expiryDate = addPeriod(parsed.data.openingDate, { unit, count });
const srcExp = getCurrencyMinorUnit(db, parsed.data.currencyCode);
const amountUsd = freezeUsdMinor(parsed.data.amountMinor, srcExp, rate.rateToUsd);
insertSpaceWithMother(db, { ...spaceValues, rateUsed: rate.rateToUsd,
  rateAsOf: rate.fetchedAt, rateSource: "frankfurter", amountUsd, expiryDate },
  parsed.data.motherEmail);                         // sync txn inside the helper
revalidatePath("/spaces");
return { ok: true };
```

**Server-side reference-data validation** (Pitfall 6): verify `paymentChannelId` ∈ `listChannels(db)` active set and `currencyCode` ∈ active seeded currencies before insert — never trust the client select options.

**`updateSpace` re-freeze guard** (D-03 / Pitfall 5): compare submitted `amountMinor`+`currencyCode` against the stored row; re-run the freeze pipeline ONLY if either changed, otherwise preserve existing `rateUsed`/`rateAsOf`/`amountUsd`.

**Imports to copy** (channels.ts lines 1-11): `"use server"`, `revalidatePath` from `next/cache`, `db` from `@/db`, schemas from `@/lib/validation/space`, helpers from `@/db/spaces`. Add `ensureFreshRates` from `@/lib/fx/frankfurter` and `getRate` from `@/db/fxRates`.

---

### `src/app/spaces/page.tsx` (MODIFY — list RSC, request-response read)

**Analog:** `src/app/reference-data/channels/page.tsx` (exact). Currently a placeholder (spaces/page.tsx lines 1-17) — replace with the channels-page shape.

**Pattern to copy verbatim** (channels page lines 1-21) — `force-dynamic` for the Node-runtime DB read (Pitfall 4), `searchParams` is a Promise in Next 16:
```typescript
import { db } from "@/db";
import { listSpaces } from "@/db/spaces";
import { SpaceTable } from "@/components/spaces/space-table";
export const dynamic = "force-dynamic";            // better-sqlite3 = Node runtime

export default async function SpacesPage({ searchParams }: {
  searchParams: Promise<{ country?: string; channel?: string }>;
}) {
  const { country, channel } = await searchParams;  // D-06 filters
  const spaces = listSpaces(db, { country, channelId: channel ? Number(channel) : undefined });
  return <SpaceTable spaces={spaces} ... />;
}
```

---

### `src/app/spaces/[id]/page.tsx` (NEW — detail/edit RSC)

**Analog:** channels page RSC shape (lines 1-21). Same `force-dynamic` + async-`params` (Next 16 `params` is a Promise). Read the joined row via the `src/db/spaces.ts` detail helper, render detail + an edit entry point. The "child accounts" block is an empty placeholder this phase (D's discretion / RESEARCH line 40) — use the `Card` placeholder pattern from the current `spaces/page.tsx` lines 6-15.

---

### `src/components/spaces/space-table.tsx` (NEW — client component, list + URL filters)

**Analog (primary):** `src/components/channels/channel-table.tsx` — `"use client"`, `useState`/`useTransition`, `useRouter`, shadcn `Table`, dialog-state union, empty-state block, `toast` on action result (channel-table.tsx full file).
**Analog (secondary):** `rate-table.tsx` for `router.refresh()` after an action (lines 40-56).

**URL-driven filter pattern to copy** (channel-table.tsx lines 46-49) — filters drive `router.push` so the RSC re-queries (D-06):
```typescript
function toggleArchived(next: boolean) {
  router.push(next ? "/reference-data/channels?archived=1" : "/reference-data/channels");
}
```
Adapt to `?country=..&channel=..` for the space list (country/channel selects → `router.push`).

**Action-result handling to copy** (channel-table.tsx lines 51-64): `startTransition(async () => { const res = await action(); if (res.ok) toast.success(...) else toast.error(...) })`.

---

### `src/components/spaces/space-form.tsx` (NEW — client component, RHF create/edit)

**Analog:** `src/components/channels/channel-dialog.tsx` (exact). Copy the entire RHF wiring: `useForm` + `zodResolver(spaceFormSchema)`, `useTransition`, `form.reset` on open, `onSubmit` calling the action, **server validation errors mapped back to fields via `form.setError`** (channel-dialog.tsx lines 59-78), and the shadcn `Form`/`FormField`/`FormItem`/`FormControl`/`FormMessage` structure (lines 91-127).

**Additional widgets:** use the existing shadcn `Select` (`src/components/ui/select.tsx`, already in repo) for country (`COUNTRIES`), payment channel (`listChannels`), currency (`CURRENCY_SEED`), and `periodUnit`. Amount input: user enters major unit → convert with `parseToMinor(value, exponent)` (money.ts lines 29-47) before submit.

**Submit/result + setError block to copy** (channel-dialog.tsx lines 59-78):
```typescript
startTransition(async () => {
  try {
    const res = mode === "add" ? await createSpace(values) : await updateSpace(id, values);
    if (res.ok) { toast.success("已保存"); onOpenChange(false); }
    else form.setError("root", { message: res.error }); // e.g. D-02 no-rate block
  } catch { toast.error("保存失败,请重试。"); }
});
```

---

### `src/components/spaces/expiry-badge.tsx` (NEW — render component, tri-state)

**Analog:** `Badge` usage in `channel-table.tsx` lines 121-127 (`<Badge variant="secondary">已归档</Badge>` / `variant="outline"`). Map `expiryStatus()` output to a `Badge` variant + label:
```typescript
import { Badge } from "@/components/ui/badge";
import { expiryStatus } from "@/lib/expiry";
// expired → variant="destructive" "已过期"; soon → "即将到期"; normal → variant="outline" "正常"
```
Status computed at render from stored `expiryDate` vs today — never stored (D-07 / anti-pattern RESEARCH line 255).

---

### Test files

**`src/lib/expiry.test.ts` (NEW)** & **`src/lib/money.test.ts` (MODIFY)** — pure-function unit tests. Analog: `src/lib/money.test.ts` (existing). Cover the 9 EXP-01 clamping cases (RESEARCH lines 340-352), `expiryStatus` boundaries (−1/0/7/8), and `freezeUsdMinor` for USD(=1)/2-dec/JPY(0-dec)/rounding.

**`src/db/spaces.query.test.ts` (NEW)** — DB-helper test. Analog: `src/db/channels.query.test.ts` (exact). Use `createTestDb()` (`beforeEach`/`afterEach` close, harness.ts) — covers SPACE-02 sort/filter and ACCT-01 unique-`space_id` rejection + cascade FK.

**`src/actions/spaces.test.ts` (NEW)** — integration test. Analog: `src/actions/channels.test.ts` (exact). Copy the `vi.hoisted` db-holder + `vi.mock("@/db")` + `vi.mock("next/cache")` setup (channels.test.ts lines 7-13) so actions run against the in-memory harness. Seed `fx_rate` + reference data; cover the D-02 no-rate block, SPACE-01/ACCT-01 atomic write, and SPACE-04 conditional re-freeze.

**`drizzle/000X_mother_account.sql` (GENERATED)** — run `pnpm db:generate` then `pnpm db:migrate`; commit the `.sql`. The harness applies `./drizzle` migrations, so this must exist before tests run (RESEARCH lines 455-460).

## Shared Patterns

### Server Action result shape + server-side re-parse
**Source:** `src/actions/channels.ts` lines 26-39
**Apply to:** `src/actions/spaces.ts` (both actions)
```typescript
export type SpaceActionResult = { ok: true } | { ok: false; error: string };
const parsed = spaceFormSchema.safeParse(input);
if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "..." };
// ...mutate... then:
revalidatePath("/spaces");
return { ok: true };
```
Server Actions are public endpoints — always re-parse with Zod, parse only whitelisted fields (mass-assignment guard, ASVS V5).

### Explicit-`db` parameterized data helpers
**Source:** `src/db/channels.ts` lines 14-16, `src/db/fxRates.ts` lines 16-18
**Apply to:** `src/db/spaces.ts`, `src/db/currencies.ts`, `src/db/fxRates.ts` (`getRate`)
```typescript
type Db = BetterSQLite3Database<Record<string, unknown>>;
export type SpaceRow = typeof space.$inferSelect;
```
Never import the `@/db` singleton inside `db/*` helpers — pass `db` so the same code runs against `createTestDb()`. All queries use Drizzle parameterized builders, never string SQL.

### Atomic multi-row transaction (synchronous)
**Source:** `src/db/fxRates.ts` `upsertRates` lines 42-54
**Apply to:** `src/db/spaces.ts` (`insertSpaceWithMother`)
The `db.transaction((tx) => {...})` callback is SYNCHRONOUS — do every `await` (i.e. `ensureFreshRates()`) BEFORE opening it. An async callback silently breaks atomicity (Pitfall 2).

### `force-dynamic` Node-runtime RSC reading SQLite
**Source:** `src/app/reference-data/channels/page.tsx` lines 5-6
**Apply to:** `src/app/spaces/page.tsx`, `src/app/spaces/[id]/page.tsx`
```typescript
export const dynamic = "force-dynamic"; // better-sqlite3 native module → never Edge (Pitfall 4)
```

### Client form: RHF + zodResolver + server-error mapping
**Source:** `src/components/channels/channel-dialog.tsx` lines 46-78
**Apply to:** `src/components/spaces/space-form.tsx`
`useForm({ resolver: zodResolver(schema) })` + `useTransition`; on `res.ok === false`, surface the server message inline via `form.setError(...)`; on exception, `toast.error`.

### URL-as-state list filtering
**Source:** `src/components/channels/channel-table.tsx` lines 46-49 (`router.push`) + `src/components/fx/rate-table.tsx` lines 50-51 (`router.refresh`)
**Apply to:** `src/components/spaces/space-table.tsx`
Filters call `router.push("/spaces?country=..&channel=..")`; the RSC re-reads `searchParams` and re-queries (D-06).

### Money is integer minor units, FX is decimal string
**Source:** `src/lib/money.ts` (lines 1-47), `src/lib/fx/frankfurter.ts` `invertToUsd` (lines 38-41), CLAUDE.md hard rule
**Apply to:** `src/lib/money.ts` `freezeUsdMinor`, `src/actions/spaces.ts`
Never float-multiply money. Convert major→minor with the currency's `minorUnit` exponent (JPY=0); freeze USD with BigInt round-half-up.

### Test harness + action mocking
**Source:** `src/test/db-harness.ts` (`createTestDb`), `src/actions/channels.test.ts` lines 7-13
**Apply to:** `src/db/spaces.query.test.ts`, `src/actions/spaces.test.ts`
In-memory DB per test with `foreign_keys = ON` + `./drizzle` migrations applied; for action tests, `vi.hoisted` db-holder + `vi.mock("@/db")` + `vi.mock("next/cache")`.

## No Analog Found

None. Every file maps to a shipped Phase 1–2 analog. The only genuinely new logic is the two pure helpers `addPeriod` (date-fns wrapper) and `freezeUsdMinor` (BigInt money math) — both modeled on the pure-function style of `src/lib/money.ts`, and both fully specified with verified behavior in RESEARCH.md (lines 314-352, 215-235).

## Metadata

**Analog search scope:** `src/actions`, `src/db`, `src/lib`, `src/lib/validation`, `src/lib/fx`, `src/app`, `src/components/channels`, `src/components/fx`, `src/test`
**Files scanned:** 18 source files read in full (channels slice, fx slice, schema, money, seed, countries, db index, harness, both test styles)
**Pattern extraction date:** 2026-06-28
