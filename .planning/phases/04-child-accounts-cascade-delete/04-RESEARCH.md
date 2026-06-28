# Phase 04: Child Accounts & Cascade Delete - Research

**Researched:** 2026-06-28  
**Domain:** Next.js Server Actions + Drizzle SQLite relational CRUD, FX money snapshots, destructive cascade delete  
**Confidence:** HIGH for codebase patterns; MEDIUM for external framework docs because Context7 was unavailable and official web/docs plus installed package types were used.

<user_constraints>
## User Constraints (from CONTEXT.md)

All constraints in this section are copied from `.planning/phases/04-child-accounts-cascade-delete/04-CONTEXT.md`. [VERIFIED: codebase file read]

### Locked Decisions

### Child Account Placement and Interaction
- **D-01:** Child accounts are managed inside the corresponding space detail page only. Do not add a global child-account list or a new sidebar entry in Phase 4.
- **D-02:** Use a table on the space detail page with row actions. Add/edit uses dialog forms; delete uses a confirmation dialog. Match the existing space/reference-data maintenance style.

### Seat Model and Fields
- **D-03:** Treat the mother account as a seat too. Both the mother account and every child account have `seat_type`, constrained to `codex` or `chatgpt`.
- **D-04:** Add `can_change_seat_type` only on `mother_account`. Child accounts do not get their own `can_change_seat_type` flag.
- **D-05:** The user must be able to edit the mother account's `seat_type` and `can_change_seat_type` from the space detail page.
- **D-06:** Child account fields are: `seat_type`, email/login, note/label, joined date, monthly price original amount, monthly price currency, frozen USD monthly price, monthly payment day, and the FX snapshot fields needed for that frozen USD value.
- **D-07:** Child-account monthly currency is selected per child account. It does not have to inherit the parent space currency and is not globally fixed.
- **D-08:** No credential fields are allowed. Store only identifiers such as email/login and human-maintained labels.

### Child Monthly Price and FX Snapshot
- **D-09:** Child-account monthly price follows the existing money model: original amount is stored as integer minor units plus `currency_code`.
- **D-10:** On save, freeze the child-account monthly USD amount using the selected currency's current cached FX rate. Store `rate_used`, `rate_as_of`, `rate_source`, and `amount_usd` style fields for the monthly price. Do not recompute historical child-account USD values when FX rates refresh later.
- **D-11:** If the selected currency has no cached rate and is not USD, block save with a clear no-rate message, consistent with Phase 3 space creation behavior.

### Space Delete and Cascade
- **D-12:** Deleting a space must require typing the exact space name before the destructive action is enabled.
- **D-13:** The delete confirmation must clearly state that the space, its mother account, and all child accounts under it will be deleted.
- **D-14:** Cascade deletion must be implemented as one transaction with no orphaned mother or child account rows.

### CNY Reference Display
- **D-15:** Space displays should keep the frozen USD amount as the authoritative stored value and additionally show a current estimated CNY reference.
- **D-16:** The CNY value is display-only and computed from the current USD-to-CNY cached rate. Do not add frozen CNY snapshot columns in Phase 4.
- **D-17:** If the CNY rate is unavailable, show a graceful fallback such as "暂无 CNY 参考" while preserving the USD display.

### the agent's Discretion
- Exact column names and table organization are open, but should mirror existing Drizzle style and preserve the locked semantic fields above.
- Exact Chinese UI labels are open, but the destructive delete copy must be explicit and hard to misread.
- Planner may decide whether mother seat editing lives in the existing space edit dialog or a dedicated section on the detail page, as long as it is editable from the detail page.

### Deferred Ideas (OUT OF SCOPE)
- Global child-account list or sidebar entry is deferred. Phase 4 keeps management inside the space detail page.
- Frozen CNY history is deferred/rejected for now. CNY is only a current display estimate.
- Dashboard totals for child monthly prices and CNY views belong to Phase 5 unless the planner needs minimal data plumbing to avoid rework.
- Notifications or monthly payment reminders remain out of scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACCT-02 | User can add child accounts under a space, choose `codex` / `chatgpt`, and enter email/login. [VERIFIED: `.planning/REQUIREMENTS.md`] | Add `child_account` table, validation schema, explicit-db data helpers, Server Actions, and a detail-page table/dialog UI. [VERIFIED: codebase] |
| ACCT-03 | User can edit and delete child accounts. [VERIFIED: `.planning/REQUIREMENTS.md`] | Mirror `SpaceForm`, `ChannelDialog`, `ArchiveDialog`, and table row-action patterns. [VERIFIED: codebase] |
| SPACE-05 | User can delete a space and cascade delete mother and child accounts. [VERIFIED: `.planning/REQUIREMENTS.md`] | Use FK `onDelete: "cascade"` plus an explicit `deleteSpaceCascade(db, id)` transaction and typed-name confirmation. [VERIFIED: codebase; CITED: https://orm.drizzle.team/docs/transactions] |
</phase_requirements>

## Summary

Phase 04 is additive over the Phase 03 space implementation. The current code already has `space`, `mother_account`, `fx_rate`, currency minor-unit helpers, frozen USD snapshot helpers, Server Actions, and detail-page placeholders for child accounts. [VERIFIED: `src/db/schema.ts`, `src/actions/spaces.ts`, `src/app/spaces/[id]/page.tsx`] The planner should extend these patterns rather than introduce a new module architecture or new dependencies. [VERIFIED: `package.json`]

**Primary recommendation:** add a `child_account` table with `space_id` `ON DELETE CASCADE`, extend `mother_account` with seat metadata defaults, implement child monthly-price freezing by extracting the existing Phase 03 snapshot pipeline into a reusable helper, and add a typed-name space delete dialog whose Server Action deletes the `space` row inside one transaction. [VERIFIED: codebase; CITED: https://orm.drizzle.team/docs/transactions]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Child account persistence and cascade integrity | Database / Storage | API / Backend | `child_account.space_id` and `mother_account.space_id` own referential integrity; Server Actions validate and call data helpers. [VERIFIED: `src/db/schema.ts`; CITED: https://orm.drizzle.team/docs/indexes-constraints] |
| Child account add/edit/delete | API / Backend | Browser / Client | Client dialogs collect values; exported Server Actions re-parse untrusted input and mutate SQLite. [VERIFIED: `src/actions/spaces.ts`, `src/components/spaces/space-form.tsx`; CITED: https://nextjs.org/docs/app/guides/data-security] |
| Child monthly USD snapshot | API / Backend | Database / Storage | Snapshot computation belongs server-side because it reads trusted currency exponents and FX cache rows before writing frozen fields. [VERIFIED: `src/actions/spaces.ts`, `src/db/fxRates.ts`, `src/lib/money.ts`] |
| Space delete confirmation | Browser / Client | API / Backend | The client disables the button until the exact name is typed; the action must still validate the ID and current name before deleting. [VERIFIED: `src/components/channels/archive-dialog.tsx`; CITED: https://nextjs.org/docs/app/guides/data-security] |
| Current CNY reference display | Frontend Server (RSC) | Database / Storage | RSC can read the frozen USD amount plus current cached CNY rate and pass display values to UI without persisting CNY columns. [VERIFIED: `src/app/spaces/[id]/page.tsx`, `src/db/fxRates.ts`] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.9 installed / 16.2.9 current on npm | App Router RSC and Server Actions. [VERIFIED: `package.json`; VERIFIED: npm registry] | Existing app uses RSC reads and Server Actions writes; no new routing stack. [VERIFIED: codebase] |
| Drizzle ORM | 0.45.2 installed / 0.45.2 current on npm | SQLite schema, typed queries, FK declaration, transactions. [VERIFIED: `package.json`; VERIFIED: npm registry] | Existing DB helpers and tests use Drizzle builders with explicit `db` parameter. [VERIFIED: `src/db/spaces.ts`, `src/test/db-harness.ts`] |
| better-sqlite3 | 12.11.1 installed | Local SQLite runtime. [VERIFIED: `package.json`] | Existing singleton enables `foreign_keys = ON`; test harness does the same. [VERIFIED: `src/db/index.ts`, `src/test/db-harness.ts`] |
| Zod | 4.4.3 installed / 4.4.3 current on npm | Server-side input parsing and mass-assignment guard. [VERIFIED: `package.json`; VERIFIED: npm registry] | Existing actions re-parse inputs because Server Actions are public mutation endpoints. [VERIFIED: `src/actions/spaces.ts`; CITED: https://nextjs.org/docs/app/guides/data-security] |
| React Hook Form + `@hookform/resolvers` | RHF 7.80.0, resolvers 5.4.0 installed/current on npm | Dialog form state and Zod resolver. [VERIFIED: `package.json`; VERIFIED: npm registry] | Existing `SpaceForm` and channel dialogs already use this pattern. [VERIFIED: codebase] |
| Vitest | 4.1.9 installed / 4.1.9 current on npm | DB/action/helper tests. [VERIFIED: `package.json`; VERIFIED: npm registry] | Existing `createTestDb()` applies migrations to isolated in-memory SQLite. [VERIFIED: `src/test/db-harness.ts`] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 1.21.0 installed | Row-action icons. [VERIFIED: `package.json`, `src/components/spaces/space-table.tsx`] | Use `Plus`, `Pencil`, `Trash2`, and possibly `UserPlus` inside icon buttons with tooltips. [VERIFIED: codebase pattern] |
| radix-ui via local shadcn components | 1.6.0 installed | Dialog and alert-dialog primitives. [VERIFIED: `package.json`, `src/components/ui/dialog.tsx`, `src/components/ui/alert-dialog.tsx`] | Add/edit child accounts use `Dialog`; destructive child/space delete uses `AlertDialog`. [VERIFIED: codebase] |
| sonner | 2.0.7 installed | Toast feedback. [VERIFIED: `package.json`] | Match `SpaceForm` and `ArchiveDialog` success/error handling. [VERIFIED: codebase] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New child-account page/sidebar | Detail-page-only child account table | Detail-page-only is locked by D-01; global list is out of scope. [VERIFIED: `04-CONTEXT.md`] |
| Manual deletion of child/mother rows | FK cascade plus transaction | FK cascade prevents orphans even if future code paths delete a space; transaction gives a single explicit boundary. [VERIFIED: `src/db/schema.ts`; CITED: https://orm.drizzle.team/docs/transactions] |
| Frozen CNY columns | Current display conversion from cached CNY rate | Frozen CNY history is explicitly rejected for Phase 04. [VERIFIED: `04-CONTEXT.md`] |

**Installation:** no new package installation is recommended. [VERIFIED: `package.json`]

## Package Legitimacy Audit

No new external packages are required for Phase 04. [VERIFIED: codebase] Existing stack package versions were checked with `npm view`; package-legitimacy seam marked `drizzle-kit`, `zod`, and `@hookform/resolvers` OK, and flagged some already-installed packages as SUS because of "too-new" or unknown-downloads heuristics. [VERIFIED: npm registry; VERIFIED: package-legitimacy seam] Because Phase 04 does not install or upgrade them, the planner should not add install checkpoints. [VERIFIED: `package.json`]

| Package | Registry | Version Checked | Source Repo | Verdict | Disposition |
|---------|----------|-----------------|-------------|---------|-------------|
| drizzle-orm | npm | 0.45.2 | github.com/drizzle-team/drizzle-orm | SUS: unknown downloads | Existing dependency; do not reinstall. |
| drizzle-kit | npm | 0.31.10 | github.com/drizzle-team/drizzle-orm | OK | Existing dev dependency. |
| zod | npm | 4.4.3 | github.com/colinhacks/zod | OK | Existing dependency. |
| react-hook-form | npm | 7.80.0 | github.com/react-hook-form/react-hook-form | SUS: too new | Existing dependency; do not reinstall. |
| @hookform/resolvers | npm | 5.4.0 | github.com/react-hook-form/resolvers | OK | Existing dependency. |
| next | npm | 16.2.9 | github.com/vercel/next.js | SUS: too new | Existing dependency; do not reinstall. |
| vitest | npm | 4.1.9 | github.com/vitest-dev/vitest | SUS: too new | Existing dev dependency; do not reinstall. |

**Packages removed due to [SLOP] verdict:** none. [VERIFIED: package-legitimacy seam]  
**Packages flagged as suspicious [SUS]:** existing-only packages listed above; no new install planned. [VERIFIED: package-legitimacy seam]

## Architecture Patterns

### System Architecture Diagram

```text
Space detail RSC (/spaces/[id])
  -> getSpaceDetail(db, id)
  -> child account list query + current CNY rate query
  -> renders mother seat controls + child account table + delete controls

Child add/edit dialog
  -> client parses money input using selected currency exponent
  -> Server Action re-parses Zod payload
  -> validate space exists + currency exists
  -> ensureFreshRates()
  -> getRate(currency)
  -> freezeUsdMinor(monthlyAmountMinor, currency.minorUnit, rate.rateToUsd)
  -> insert/update child_account row with frozen monthly USD fields
  -> revalidatePath('/spaces') and revalidatePath(`/spaces/${spaceId}`)

Space delete dialog
  -> user types exact space name
  -> Server Action validates {id, confirmationName}
  -> transaction checks current space.name
     -> mismatch: return error, no delete
     -> match: delete from space where id = ?
       -> SQLite FK cascades mother_account + child_account
  -> revalidatePath('/spaces')
```

### Recommended Project Structure

```text
src/
├── actions/
│   ├── childAccounts.ts      # child add/edit/delete + mother seat update
│   └── spaces.ts             # add deleteSpace action or delegate to spaces DB helper
├── db/
│   ├── childAccounts.ts      # explicit-db CRUD/list helpers
│   ├── spaces.ts             # extend detail query + deleteSpaceCascade helper
│   └── schema.ts             # child_account table + mother_account seat metadata
├── lib/
│   ├── money.ts              # add USD->CNY display conversion helper
│   └── validation/
│       ├── childAccount.ts   # child form/id schemas
│       └── motherAccount.ts  # mother seat edit schema if separate
└── components/spaces/
    ├── child-account-table.tsx
    ├── child-account-form.tsx
    ├── child-account-delete-dialog.tsx
    ├── mother-seat-card.tsx
    └── space-delete-dialog.tsx
```

### Pattern 1: Child Account Schema

**What:** Add a standalone `child_account` table with a non-null FK to `space.id` and cascade delete. [VERIFIED: `src/db/schema.ts`; CITED: https://orm.drizzle.team/docs/indexes-constraints]

**Recommended columns:** `id`, `space_id`, `seat_type`, `email`, `label`, `joined_date`, `monthly_amount_minor`, `monthly_currency_code`, `monthly_rate_used`, `monthly_rate_as_of`, `monthly_rate_source`, `monthly_amount_usd`, `monthly_payment_day`, `created_at`, `updated_at`. [VERIFIED: `04-CONTEXT.md`; VERIFIED: codebase money naming pattern]

**Constraint guidance:** mirror local style with `text("seat_type").notNull().default("codex")` and Zod `z.enum(["codex","chatgpt"])`; add SQL `CHECK` constraints in the migration only if the planner wants DB-level enum enforcement beyond current local style. [VERIFIED: `src/lib/validation/space.ts`; ASSUMED: Drizzle CHECK ergonomics for current sqlite builder]

```ts
// Source: local schema pattern + Drizzle FK docs
export const childAccount = sqliteTable("child_account", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  spaceId: integer("space_id")
    .notNull()
    .references(() => space.id, { onDelete: "cascade" }),
  seatType: text("seat_type").notNull().default("codex"),
  email: text("email").notNull(),
  label: text("label").notNull().default(""),
  joinedDate: text("joined_date").notNull(),
  monthlyAmountMinor: integer("monthly_amount_minor").notNull(),
  monthlyCurrencyCode: text("monthly_currency_code")
    .notNull()
    .references(() => currency.code),
  monthlyRateUsed: text("monthly_rate_used").notNull(),
  monthlyRateAsOf: text("monthly_rate_as_of").notNull(),
  monthlyRateSource: text("monthly_rate_source").notNull(),
  monthlyAmountUsd: integer("monthly_amount_usd").notNull(),
  monthlyPaymentDay: integer("monthly_payment_day").notNull(),
});
```

### Pattern 2: Mother Seat Metadata Migration

**What:** Extend `mother_account` with `seat_type` and `can_change_seat_type`. [VERIFIED: `04-CONTEXT.md`]  
**Migration strategy:** use not-null defaults so existing Phase 03 mother rows migrate without manual backfill. [VERIFIED: live schema has existing `mother_account.email`; VERIFIED: `src/db/schema.ts`] Recommended defaults are `seat_type = 'codex'` and `can_change_seat_type = true`; if that default is semantically wrong for existing data, planner must add a Wave 0 human checkpoint before migration. [ASSUMED]

### Pattern 3: Reusable USD Snapshot Helper

**What:** Extract the duplicated Phase 03 snapshot flow into a helper that child and space actions can share. [VERIFIED: `src/actions/spaces.ts`]  
**When to use:** child create and update when monthly amount or monthly currency changes. [VERIFIED: `04-CONTEXT.md`]

```ts
// Source: src/actions/spaces.ts + src/lib/money.ts
async function computeUsdSnapshot(input: { amountMinor: number; currencyCode: string }) {
  await ensureFreshRates();
  const rate = getRate(db, input.currencyCode);
  if (!rate) return { ok: false as const, error: NO_RATE_ERROR };
  const srcExp = getCurrencyMinorUnit(db, input.currencyCode);
  if (srcExp === undefined) return { ok: false as const, error: "请选择有效的币种。" };
  return {
    ok: true as const,
    rateUsed: rate.rateToUsd,
    rateAsOf: rate.fetchedAt,
    rateSource: "frankfurter" as const,
    amountUsd: freezeUsdMinor(input.amountMinor, srcExp, rate.rateToUsd),
  };
}
```

### Pattern 4: Space Delete Transaction

**What:** Add `deleteSpaceCascade(db, id, expectedName)` in `src/db/spaces.ts`; it checks the name and deletes the `space` row inside one `db.transaction`. [VERIFIED: `src/db/spaces.ts`; CITED: https://orm.drizzle.team/docs/transactions]

**Why:** SQLite FK cascade deletes dependent `mother_account` and `child_account` rows, while the transaction gives a single mutation boundary and a clean mismatch/no-op path. [VERIFIED: `src/db/schema.ts`, `src/test/db-harness.ts`]

### Pattern 5: Current CNY Reference

**What:** Display CNY as a current estimate from frozen USD and cached `fx_rate` row for `CNY`; do not store a CNY snapshot. [VERIFIED: `04-CONTEXT.md`, `src/db/fxRates.ts`]

**Important rate direction:** `fx_rate.rate_to_usd` is X→USD, so CNY display must invert the CNY rate. Do not call `freezeUsdMinor` backward. [VERIFIED: `02-CONTEXT.md`, `src/lib/money.ts`]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Referential cascade | Manual delete loops for child and mother accounts | SQLite FK `ON DELETE CASCADE` plus Drizzle transaction | Prevents orphan rows across all future delete paths. [VERIFIED: `src/db/schema.ts`; CITED: https://orm.drizzle.team/docs/indexes-constraints] |
| Money parsing and display | Float math or hardcoded `* 100` | `parseToMinor`, `formatMinor`, `formatCurrencyMinor`, `freezeUsdMinor` | Currency exponents differ; JPY is already 0-decimal. [VERIFIED: `src/lib/money.ts`, `src/lib/currencies.ts`] |
| Server input trust | Trusting client RHF values or disabled buttons | Zod parse in every Server Action | Server Actions are externally reachable mutation endpoints. [CITED: https://nextjs.org/docs/app/guides/data-security] |
| Child account global module | New sidebar/list page | Space detail table | Locked out by D-01. [VERIFIED: `04-CONTEXT.md`] |
| Historical CNY storage | `amount_cny` columns | Display-only current conversion | Frozen CNY history is out of scope. [VERIFIED: `04-CONTEXT.md`] |

**Key insight:** Phase 04 should preserve the Phase 03 "write once, freeze USD snapshot" rule for child monthly prices, while treating CNY as a read-time reference only. [VERIFIED: `03-CONTEXT.md`, `04-CONTEXT.md`]

## Common Pitfalls

### Pitfall 1: Orphans despite an FK-looking schema
**What goes wrong:** child rows remain after a space delete. [VERIFIED: `.planning/research/PITFALLS.md`]  
**Why it happens:** SQLite requires `foreign_keys = ON` per connection; migrations/tests already enable it and new code must keep that invariant. [VERIFIED: `src/db/index.ts`, `src/db/migrate.ts`, `src/test/db-harness.ts`]  
**How to avoid:** add FK cascade in schema, verify generated SQL includes `ON DELETE cascade`, and add a DB test that deletes a space and counts zero mother/child rows. [VERIFIED: Phase 03 test pattern]

### Pitfall 2: Re-freezing child USD snapshots on every edit
**What goes wrong:** editing label/email/joined date silently changes monthly USD history after FX refresh. [VERIFIED: `04-CONTEXT.md`]  
**How to avoid:** copy the Phase 03 `shouldRefreeze` gate: only re-run FX when monthly amount or monthly currency changes. [VERIFIED: `src/actions/spaces.ts`, `src/actions/spaces.test.ts`]

### Pitfall 3: Wrong USD-to-CNY conversion direction
**What goes wrong:** UI multiplies USD by `CNY.rate_to_usd`, producing a value smaller than USD instead of CNY. [VERIFIED: `02-CONTEXT.md`]  
**How to avoid:** add a tested helper that divides USD by the CNY→USD decimal string using BigInt decimal parsing. [VERIFIED: `src/lib/money.ts` pattern]

### Pitfall 4: Credential scope creep
**What goes wrong:** child account form adds password/token/API-key fields. [VERIFIED: `.planning/REQUIREMENTS.md`, `04-CONTEXT.md`]  
**How to avoid:** schema and validation must only include email/login and human labels/notes; tests should assert mass-assignment ignores unknown credential-looking keys. [CITED: https://nextjs.org/docs/app/guides/data-security]

### Pitfall 5: Typed confirmation only enforced in the browser
**What goes wrong:** direct POST to the Server Action deletes a space without typing the name. [CITED: https://nextjs.org/docs/app/guides/data-security]  
**How to avoid:** action validates `{ id, confirmationName }`, fetches current `space.name`, and rejects mismatches before deleting. [VERIFIED: local action validation pattern]

## Code Examples

### Action-Level Child Create Flow

```ts
// Source: src/actions/spaces.ts pattern
export async function createChildAccount(spaceId: number, input: unknown): Promise<ActionResult> {
  const parsedId = spaceIdSchema.safeParse({ id: spaceId });
  const parsed = childAccountFormSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) return { ok: false, error: "子账号信息无效。" };

  const existingSpace = getSpaceDetail(db, parsedId.data.id);
  if (!existingSpace) return { ok: false, error: "空间不存在。" };

  const snapshot = await computeUsdSnapshot({
    amountMinor: parsed.data.monthlyAmountMinor,
    currencyCode: parsed.data.monthlyCurrencyCode,
  });
  if (!snapshot.ok) return snapshot;

  insertChildAccount(db, parsedId.data.id, { ...parsed.data, ...snapshot });
  revalidatePath("/spaces");
  revalidatePath(`/spaces/${parsedId.data.id}`);
  return { ok: true };
}
```

### DB Test for Cascade

```ts
// Source: src/db/spaces.query.test.ts pattern
it("deleting a space cascades mother and child accounts", () => {
  const row = makeSpace({ name: "Cascade All" });
  insertChildAccount(ctx.db, row.id, childValues);

  deleteSpaceCascade(ctx.db, row.id, "Cascade All");

  expect(countMotherAccounts(ctx.db, row.id)).toBe(0);
  expect(countChildAccounts(ctx.db, row.id)).toBe(0);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Space detail shows child placeholder | Detail page owns child account CRUD | Phase 04 | Replace placeholder card in `src/app/spaces/[id]/page.tsx`. [VERIFIED: codebase] |
| Mother account only stores email | Mother account also stores seat metadata | Phase 04 | Add not-null defaulted migration and detail-page edit UI. [VERIFIED: `04-CONTEXT.md`] |
| Space USD display only | Space USD plus current CNY reference | Phase 04 | Read `CNY` cached rate at render time; no CNY column. [VERIFIED: `04-CONTEXT.md`, `src/db/fxRates.ts`] |

**Deprecated/outdated:** global child-account management is explicitly out of scope for this phase. [VERIFIED: `04-CONTEXT.md`]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Defaulting existing mother accounts to `seat_type = 'codex'` and `can_change_seat_type = true` is acceptable. | Mother Seat Metadata Migration | Existing live rows may need different metadata; planner should add a quick human/default confirmation if data already matters. |
| A2 | Drizzle SQLite CHECK constraints are worth adding only if convenient in current schema/migration flow. | Child Account Schema | If DB-level enum enforcement is required, planner must include a schema/migration check task rather than relying only on Zod. |

## Open Questions

1. **What defaults should existing mother accounts receive?**
   - What we know: new columns need defaults to migrate existing rows safely. [VERIFIED: `src/db/schema.ts`]
   - What's unclear: whether old mother seats are mostly Codex or ChatGPT. [ASSUMED]
   - Recommendation: default to `codex` unless user confirms otherwise; make it editable from detail page immediately. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Next/Vitest/Drizzle tooling | yes | v25.5.0 | none needed. [VERIFIED: local command] |
| npm | scripts and package metadata | yes | 11.8.0 | none needed. [VERIFIED: local command] |
| TypeScript | type check | yes | 5.9.3 | none needed. [VERIFIED: local command] |
| Vitest | automated tests | yes | 4.1.9 | none needed. [VERIFIED: local command] |
| Next.js | build/dev app | yes | 16.2.9 | none needed. [VERIFIED: local command] |
| SQLite DB file | live local data | yes | `data/app.db` exists | migration handles additive schema. [VERIFIED: file listing] |

**Missing dependencies with no fallback:** none identified. [VERIFIED: local commands]  
**Missing dependencies with fallback:** Context7 docs CLI/MCP unavailable; official docs and installed package types were used instead. [VERIFIED: tool/CLI check]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9. [VERIFIED: local command] |
| Config file | `vitest.config.ts`. [VERIFIED: codebase] |
| Quick run command | `npx vitest run src/db/spaces.query.test.ts src/actions/spaces.test.ts src/lib/money.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| ACCT-02 | Add child under a space with seat type, email/login, monthly price, currency, joined date, payment day, and frozen USD snapshot. | action + DB integration | `npx vitest run src/actions/childAccounts.test.ts` | no, Wave 0 |
| ACCT-03 | Edit child preserves frozen USD for non-price edits and re-freezes only when amount/currency changes. | action integration | `npx vitest run src/actions/childAccounts.test.ts` | no, Wave 0 |
| ACCT-03 | Delete child removes only that row and leaves space/mother/other children. | DB + action | `npx vitest run src/db/childAccounts.query.test.ts src/actions/childAccounts.test.ts` | no, Wave 0 |
| SPACE-05 | Delete space cascades mother and all child accounts in one transaction. | DB integration | `npx vitest run src/db/spaces.query.test.ts` | existing file, extend |
| SPACE-05 | Typed-name mismatch rejects deletion and leaves all rows intact. | action integration | `npx vitest run src/actions/spaces.test.ts` | existing file, extend |
| D-15..D-17 | CNY reference displays when CNY rate exists and falls back when missing. | helper/unit + manual UI | `npx vitest run src/lib/money.test.ts` | existing file, extend |

### Sampling Rate

- **Per task commit:** targeted `npx vitest run ...` for touched helper/action/query file. [VERIFIED: existing test style]
- **Per wave merge:** `npm test`, `npx tsc --noEmit`, `npm run lint`. [VERIFIED: `package.json`, `03-VERIFICATION.md`]
- **Phase gate:** `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run lint`, plus human UI checks. [VERIFIED: `03-VERIFICATION.md`]

### Wave 0 Gaps

- [ ] `src/db/childAccounts.query.test.ts` — child CRUD and FK cascade coverage. [VERIFIED: test file absent]
- [ ] `src/actions/childAccounts.test.ts` — action validation, no-rate block, snapshot preservation/refreeze, delete. [VERIFIED: test file absent]
- [ ] Extend `src/actions/spaces.test.ts` — typed-name cascade delete action. [VERIFIED: existing file]
- [ ] Extend `src/lib/money.test.ts` — USD minor to CNY minor display conversion. [VERIFIED: existing file]
- [ ] Human verification checklist: add/edit/delete child, edit mother seat metadata, delete space with exact name, verify no row remains and list/detail refresh. [VERIFIED: Phase 03 UAT pattern]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Single-user local app has no auth system in v1. [VERIFIED: `.planning/REQUIREMENTS.md` Out of Scope] |
| V3 Session Management | no | No sessions in this phase. [VERIFIED: `.planning/REQUIREMENTS.md`] |
| V4 Access Control | no | Single-user app; still validate object IDs exist before mutation. [VERIFIED: local action pattern] |
| V5 Input Validation | yes | Zod schemas in Server Actions; ignore unknown credential fields. [VERIFIED: `src/lib/validation/space.ts`; CITED: https://nextjs.org/docs/app/guides/data-security] |
| V6 Cryptography | no | No secrets or credentials stored. [VERIFIED: `04-CONTEXT.md`] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Direct POST to exported Server Action with forged ID/payload | Tampering | Server-side Zod parse, ID schema, current-row lookup before mutation. [CITED: https://nextjs.org/docs/app/guides/data-security] |
| Mass assignment of password/token fields | Information Disclosure | Whitelist schema fields; no credential columns. [VERIFIED: `src/actions/spaces.ts`, `04-CONTEXT.md`] |
| Destructive delete by UI bypass | Tampering | Validate confirmation name server-side and delete inside transaction. [VERIFIED: codebase pattern; CITED: https://orm.drizzle.team/docs/transactions] |
| Broken FK enforcement in SQLite connection | Tampering | Keep `sqlite.pragma("foreign_keys = ON")` in runtime, migration, and tests. [VERIFIED: `src/db/index.ts`, `src/db/migrate.ts`, `src/test/db-harness.ts`] |

## Project Constraints

No `./AGENTS.md` file exists in the project root. [VERIFIED: local file check] The session-provided AGENTS instruction required checking for subagent tools before judging availability; `tool_search` for `spawn_agent`, `subagent`, and `multi-agent` found no such tools. [VERIFIED: tool_search]

## Sources

### Primary (HIGH confidence)
- `.planning/phases/04-child-accounts-cascade-delete/04-CONTEXT.md` — locked Phase 04 decisions and scope. [VERIFIED: codebase file read]
- `.planning/REQUIREMENTS.md` — ACCT-02, ACCT-03, SPACE-05. [VERIFIED: codebase file read]
- `src/db/schema.ts` — current tables and FK cascade on mother account. [VERIFIED: codebase file read]
- `src/db/spaces.ts` — explicit-db query/write helper pattern. [VERIFIED: codebase file read]
- `src/actions/spaces.ts` — validation, FX snapshot, revalidate pattern. [VERIFIED: codebase file read]
- `src/lib/money.ts`, `src/lib/currencies.ts`, `src/db/fxRates.ts` — money/FX helpers. [VERIFIED: codebase file read]
- `src/test/db-harness.ts` and existing tests — migration-backed in-memory test pattern. [VERIFIED: codebase file read]

### Secondary (MEDIUM confidence)
- Drizzle transactions docs: https://orm.drizzle.team/docs/transactions — transaction API and rollback model. [CITED: official docs]
- Drizzle indexes/constraints docs: https://orm.drizzle.team/docs/indexes-constraints — foreign key concepts. [CITED: official docs]
- Next.js data security guide: https://nextjs.org/docs/app/guides/data-security — Server Actions and input security. [CITED: official docs]
- Installed Drizzle sqlite-core type files under `node_modules/drizzle-orm/sqlite-core` — `references(..., { onDelete })` support. [VERIFIED: local package files]

### Tertiary (LOW confidence)
- Default values for existing mother seat metadata. [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified from `package.json`, local commands, npm metadata; no new installs.  
- Architecture: HIGH — based on existing source and locked Phase 04 decisions.  
- Pitfalls: HIGH for codebase/money/FK risks; MEDIUM for Drizzle docs because Context7 was unavailable.  

**Research date:** 2026-06-28  
**Valid until:** 2026-07-28 for codebase-specific guidance; 2026-07-05 for npm-current version claims.
