# Phase 04: Child Accounts & Cascade Delete - Pattern Map

**Mapped:** 2026-06-28  
**Files analyzed:** 23  
**Analogs found:** 23 / 23

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/schema.ts` | model | CRUD | `src/db/schema.ts` | exact |
| `drizzle/0004_*.sql` | migration | CRUD | `drizzle/0003_dazzling_warhawk.sql` | role-match |
| `src/db/childAccounts.ts` | service | CRUD | `src/db/spaces.ts` | exact |
| `src/db/spaces.ts` | service | CRUD | `src/db/spaces.ts` | exact |
| `src/actions/childAccounts.ts` | controller | request-response | `src/actions/spaces.ts` | exact |
| `src/actions/spaces.ts` | controller | request-response | `src/actions/spaces.ts` | exact |
| `src/lib/validation/childAccount.ts` | utility | transform | `src/lib/validation/space.ts` | exact |
| `src/lib/validation/motherAccount.ts` | utility | transform | `src/lib/validation/space.ts` | role-match |
| `src/lib/money.ts` | utility | transform | `src/lib/money.ts` | exact |
| `src/app/spaces/[id]/page.tsx` | component | request-response | `src/app/spaces/[id]/page.tsx` | exact |
| `src/app/spaces/page.tsx` | component | request-response | `src/app/spaces/page.tsx` | exact |
| `src/components/spaces/child-account-table.tsx` | component | CRUD | `src/components/spaces/space-table.tsx` | exact |
| `src/components/spaces/child-account-form.tsx` | component | CRUD | `src/components/spaces/space-form.tsx` | exact |
| `src/components/spaces/child-account-delete-dialog.tsx` | component | CRUD | `src/components/channels/archive-dialog.tsx` | role-match |
| `src/components/spaces/mother-seat-card.tsx` | component | CRUD | `src/components/spaces/space-detail-actions.tsx` | role-match |
| `src/components/spaces/space-delete-dialog.tsx` | component | CRUD | `src/components/channels/archive-dialog.tsx` | role-match |
| `src/components/spaces/space-table.tsx` | component | request-response | `src/components/spaces/space-table.tsx` | exact |
| `src/components/spaces/space-detail-actions.tsx` | component | CRUD | `src/components/spaces/space-detail-actions.tsx` | exact |
| `src/db/childAccounts.query.test.ts` | test | CRUD | `src/db/spaces.query.test.ts` | exact |
| `src/db/spaces.query.test.ts` | test | CRUD | `src/db/spaces.query.test.ts` | exact |
| `src/actions/childAccounts.test.ts` | test | request-response | `src/actions/spaces.test.ts` | exact |
| `src/actions/spaces.test.ts` | test | request-response | `src/actions/spaces.test.ts` | exact |
| `src/lib/money.test.ts` | test | transform | `src/lib/money.test.ts` | exact |

## Pattern Assignments

### `src/db/schema.ts` (model, CRUD)

**Analog:** `src/db/schema.ts`

**Imports pattern** (lines 1-2):
```typescript
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
```

**FK + cascade pattern** (lines 81-88):
```typescript
export const motherAccount = sqliteTable("mother_account", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  spaceId: integer("space_id")
    .notNull()
    .unique()
    .references(() => space.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
});
```

**Money/FX snapshot column pattern** (lines 64-78):
```typescript
currencyCode: text("currency_code")
  .notNull()
  .references(() => currency.code),
amountMinor: integer("amount_minor").notNull(),
rateUsed: text("rate_used"),
rateAsOf: text("rate_as_of"),
rateSource: text("rate_source"),
amountUsd: integer("amount_usd"),
```

**Apply to:** add `seatType` and `canChangeSeatType` to `motherAccount`; add `childAccount` with `spaceId.references(() => space.id, { onDelete: "cascade" })`, `seatType`, identifier/label fields, monthly minor-unit fields, and frozen monthly USD snapshot fields.

---

### `drizzle/0004_*.sql` (migration, CRUD)

**Analog:** `drizzle/0003_dazzling_warhawk.sql`

**Add-column/backfill pattern** (lines 1-13):
```sql
ALTER TABLE `currency` ADD `symbol` text NOT NULL DEFAULT '';
--> statement-breakpoint
UPDATE `currency` SET `symbol` = '$' WHERE `code` = 'USD';
--> statement-breakpoint
UPDATE `currency` SET `symbol` = 'HK$' WHERE `code` = 'HKD';
```

**Apply to:** generate with `drizzle-kit`, then verify defaulted `mother_account` columns migrate existing rows safely and `child_account.space_id` has `ON DELETE cascade`.

---

### `src/db/childAccounts.ts` (service, CRUD)

**Analog:** `src/db/spaces.ts`

**Imports and explicit-db pattern** (lines 1-12):
```typescript
import { and, asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { currency, motherAccount, paymentChannel, space } from "./schema";

type Db = BetterSQLite3Database<Record<string, unknown>>;
```

**Insert transaction pattern** (lines 30-39):
```typescript
export function insertSpaceWithMother(
  db: Db,
  spaceValues: SpaceInsert,
  email: string,
): SpaceRow {
  return db.transaction((tx) => {
    const row = tx.insert(space).values(spaceValues).returning().get();
    tx.insert(motherAccount).values({ spaceId: row.id, email }).run();
    return row;
  });
}
```

**Joined list/detail pattern** (lines 61-85):
```typescript
return db
  .select({
    space,
    motherAccount,
    paymentChannel,
    currency,
  })
  .from(space)
  .innerJoin(motherAccount, eq(motherAccount.spaceId, space.id))
  .innerJoin(paymentChannel, eq(paymentChannel.id, space.paymentChannelId))
  .innerJoin(currency, eq(currency.code, space.currencyCode))
  .orderBy(asc(space.expiryDate))
  .all();
```

**Apply to:** create explicit-db child CRUD helpers: `listChildAccounts(db, spaceId)`, `getChildAccount(db, id)`, `insertChildAccount(db, values)`, `updateChildAccount(db, id, values)`, and `deleteChildAccount(db, id)`. Join monthly currency for display when needed.

---

### `src/db/spaces.ts` (service, CRUD)

**Analog:** `src/db/spaces.ts`

**Detail query pattern** (lines 88-101):
```typescript
export function getSpaceDetail(db: Db, id: number) {
  return db
    .select({
      space,
      motherAccount,
      paymentChannel,
      currency,
    })
    .from(space)
    .innerJoin(motherAccount, eq(motherAccount.spaceId, space.id))
    .innerJoin(paymentChannel, eq(paymentChannel.id, space.paymentChannelId))
    .innerJoin(currency, eq(currency.code, space.currencyCode))
    .where(eq(space.id, id))
    .get();
}
```

**Update helper pattern** (lines 104-120):
```typescript
export function updateSpaceRow(
  db: Db,
  id: number,
  values: SpaceUpdate,
): SpaceRow {
  return db.update(space).set(values).where(eq(space.id, id)).returning().get();
}

export function updateMotherAccountEmail(
  db: Db,
  spaceId: number,
  email: string,
): void {
  db.update(motherAccount)
    .set({ email })
    .where(eq(motherAccount.spaceId, spaceId))
    .run();
}
```

**Apply to:** extend detail/list result types with child-account rows and add `deleteSpaceCascade(db, id, expectedName)` as a transaction: read current `space.name`, reject mismatch, delete `space`, rely on FK cascade for `motherAccount` and `childAccount`.

---

### `src/actions/childAccounts.ts` (controller, request-response)

**Analog:** `src/actions/spaces.ts`

**Imports pattern** (lines 1-17):
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { getCurrencyMinorUnit } from "@/db/currencies";
import { getRate } from "@/db/fxRates";
import { ensureFreshRates } from "@/lib/fx/frankfurter";
import { freezeUsdMinor } from "@/lib/money";
import { spaceFormSchema, spaceIdSchema } from "@/lib/validation/space";
```

**Validation and no-rate pattern** (lines 34-56):
```typescript
export type SpaceActionResult = { ok: true } | { ok: false; error: string };

function validationError(message = "绌洪棿淇℃伅鏃犳晥銆?): SpaceActionResult {
  return { ok: false, error: message };
}

if (getCurrencyMinorUnit(db, currencyCode) === undefined) {
  return { ok: false, error: "璇烽€夋嫨鏈夋晥鐨勫竵绉嶃€? };
}
```

**FX snapshot pattern** (lines 58-90):
```typescript
async function computeSnapshot(input: {
  amountMinor: number;
  currencyCode: string;
}) {
  await ensureFreshRates();

  const rate = getRate(db, input.currencyCode);
  if (!rate) {
    return { ok: false, error: NO_RATE_ERROR };
  }

  const srcExp = getCurrencyMinorUnit(db, input.currencyCode);
  if (srcExp === undefined) {
    return { ok: false, error: "璇烽€夋嫨鏈夋晥鐨勫竵绉嶃€? };
  }

  return {
    ok: true,
    rateUsed: rate.rateToUsd,
    rateAsOf: rate.fetchedAt,
    rateSource: "frankfurter",
    amountUsd: freezeUsdMinor(input.amountMinor, srcExp, rate.rateToUsd),
  };
}
```

**Create/update action pattern** (lines 92-137, 139-203):
```typescript
const parsed = spaceFormSchema.safeParse(input);
if (!parsed.success) {
  return validationError(parsed.error.issues[0]?.message);
}

const snapshot = await computeSnapshot(data);
if (!snapshot.ok) return snapshot;

revalidatePath(SPACES_PATH);
return { ok: true };
```

**Snapshot preservation pattern** (lines 169-182):
```typescript
const shouldRefreeze =
  data.amountMinor !== existing.space.amountMinor ||
  data.currencyCode !== existing.space.currencyCode;

const snapshot = shouldRefreeze
  ? await computeSnapshot(data)
  : {
      ok: true as const,
      rateUsed: existing.space.rateUsed,
      rateAsOf: existing.space.rateAsOf,
      rateSource: existing.space.rateSource,
      amountUsd: existing.space.amountUsd,
    };
if (!snapshot.ok) return snapshot;
```

**Apply to:** child create/edit/delete and mother seat update. Re-parse all inputs, verify `spaceId`/child row exists, refreeze only when child monthly amount or currency changes, and revalidate both `/spaces` and `/spaces/${spaceId}`.

---

### `src/actions/spaces.ts` (controller, request-response)

**Analog:** `src/actions/spaces.ts`

**Existing update object pattern** (lines 184-202):
```typescript
updateSpaceRow(db, parsedId.data.id, {
  name: data.name,
  country: data.country,
  paymentChannelId: data.paymentChannelId,
  currencyCode: data.currencyCode,
  amountMinor: data.amountMinor,
  periodUnit: data.periodUnit,
  periodCount: data.periodCount,
  openingDate: data.openingDate,
  expiryDate,
  rateUsed: snapshot.rateUsed,
  rateAsOf: snapshot.rateAsOf,
  rateSource: snapshot.rateSource,
  amountUsd: snapshot.amountUsd,
});
updateMotherAccountEmail(db, parsedId.data.id, data.motherEmail);

revalidatePath(SPACES_PATH);
return { ok: true };
```

**Apply to:** add `deleteSpace` action that parses `{ id, confirmationName }`, delegates to `deleteSpaceCascade`, returns `{ ok: false; error }` on mismatch, then `revalidatePath("/spaces")`.

---

### `src/lib/validation/childAccount.ts` (utility, transform)

**Analog:** `src/lib/validation/space.ts`

**Schema pattern** (lines 1-21):
```typescript
import { z } from "zod";

export const spaceFormSchema = z.object({
  name: z.string().trim().min(1, "璇疯緭鍏ョ┖闂村悕绉般€?),
  country: z.string().length(2),
  paymentChannelId: z.number().int().positive(),
  currencyCode: z.string().length(3),
  amountMinor: z.number().int().positive(),
  openingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodUnit: z.enum(["month", "quarter", "year"]),
  periodCount: z.number().int().positive(),
  motherEmail: z.string().trim().min(1, "璇疯緭鍏ユ瘝璐﹀彿閭/鐧诲綍鍚嶃€?),
});

export type SpaceFormInput = z.infer<typeof spaceFormSchema>;
```

**ID schema pattern** (lines 25-28):
```typescript
export const spaceIdSchema = z.object({
  id: z.number().int().positive(),
});
```

**Apply to:** create `seatTypeSchema = z.enum(["codex", "chatgpt"])`, child form schema with whitelisted non-credential fields only, `childAccountIdSchema`, and `spaceIdSchema` reuse/import.

---

### `src/lib/validation/motherAccount.ts` (utility, transform)

**Analog:** `src/lib/validation/space.ts`

**Apply to:** mirror the simple Zod object pattern above for `{ seatType, canChangeSeatType }` or export these fields from `childAccount.ts` if the planner chooses one validation module. Keep the schema whitelist narrow to avoid credential fields.

---

### `src/lib/money.ts` (utility, transform)

**Analog:** `src/lib/money.ts`

**Imports:** none.

**Integer minor-unit parse/format pattern** (lines 11-47):
```typescript
export function formatMinor(amountMinor: number, exponent: number): string {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`amountMinor must be an integer, got: ${amountMinor}`);
  }
  const sign = amountMinor < 0 ? "-" : "";
  const abs = Math.abs(amountMinor);
  if (exponent === 0) return `${sign}${abs}`;
  const divisor = 10 ** exponent;
  const whole = Math.floor(abs / divisor);
  const frac = abs % divisor;
  return `${sign}${whole}.${String(frac).padStart(exponent, "0")}`;
}

export function parseToMinor(input: string, exponent: number): number {
  const trimmed = input.trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid money input: "${input}"`);
  }
  const [, sign, whole, fracRaw = ""] = match;
  const frac = fracRaw.padEnd(exponent, "0");
  const value = Number(`${whole}${frac}`);
  return sign === "-" ? -value : value;
}
```

**BigInt conversion pattern** (lines 55-100):
```typescript
export function freezeUsdMinor(
  amountMinor: number,
  srcExp: number,
  rateToUsd: string,
  usdExp = 2,
): number {
  const [, whole, frac = ""] = match;
  const rateInt = BigInt(`${whole}${frac}`);
  let num = BigInt(Math.abs(amountMinor)) * rateInt;
  let den = ten ** BigInt(frac.length);
  const exponentDelta = usdExp - srcExp;
  const quotient = num / den;
  const remainder = num % den;
  const rounded = remainder * two >= den ? quotient + one : quotient;
  return amountMinor < 0 ? -Number(rounded) : Number(rounded);
}
```

**Apply to:** add USD-to-CNY display conversion using the same decimal-string parsing and BigInt rounding. Because `fx_rate.rate_to_usd` is CNY-to-USD, current CNY display must invert that rate.

---

### `src/app/spaces/[id]/page.tsx` (component, request-response)

**Analog:** `src/app/spaces/[id]/page.tsx`

**RSC imports/runtime pattern** (lines 1-15):
```typescript
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { listChannels } from "@/db/channels";
import { listCurrencies } from "@/db/currencies";
import { getSpaceDetail } from "@/db/spaces";

export const dynamic = "force-dynamic";
```

**Route param validation and data reads** (lines 29-43):
```typescript
const { id } = await params;
const numericId = Number(id);
if (!Number.isInteger(numericId) || numericId <= 0) notFound();

const detail = getSpaceDetail(db, numericId);
if (!detail) notFound();

const channels = listChannels(db);
const currencies = listCurrencies(db);
const { space, motherAccount, paymentChannel, currency } = detail;
```

**Placeholder to replace** (lines 113-119):
```tsx
<Card>
  <CardHeader>
    <CardTitle>瀛愯处鍙?/CardTitle>
  </CardHeader>
  <CardContent className="text-sm text-muted-foreground">
    瀛愯处鍙风鐞嗗皢鍦ㄥ悗缁増鏈彁渚涖€?
  </CardContent>
</Card>
```

**Apply to:** load child accounts through detail/query helpers, pass rows/currencies to child table/form components, add mother seat editor, add cascade space delete action, and show CNY reference near existing frozen USD display.

---

### `src/app/spaces/page.tsx` (component, request-response)

**Analog:** `src/app/spaces/page.tsx`

**Server page to client table pattern** (lines 10-31):
```tsx
export default async function SpacesPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; channel?: string }>;
}) {
  const { country, channel } = await searchParams;
  const channelId = channel ? Number(channel) : undefined;
  const spaces = listSpaceDetails(db, {
    country: country || undefined,
    channelId: Number.isFinite(channelId) ? channelId : undefined,
  });
  const channels = listChannels(db);
  const currencies = listCurrencies(db);

  return (
    <SpaceTable
      spaces={spaces}
      channels={channels}
      currencies={currencies}
      selectedCountry={country || undefined}
      selectedChannel={Number.isFinite(channelId) ? channelId : undefined}
    />
  );
}
```

**Apply to:** fetch current `CNY` rate or a derived CNY reference field server-side and pass enough display data to `SpaceTable`.

---

### `src/components/spaces/child-account-table.tsx` (component, CRUD)

**Analog:** `src/components/spaces/space-table.tsx`

**Client state + action icons pattern** (lines 1-35, 69-80):
```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, Pencil, Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const [formState, setFormState] =
  useState<{ mode: "add" } | { mode: "edit"; space: SpaceFormValue } | null>(
    null,
  );
```

**Table row action pattern** (lines 156-248):
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead scope="col">鍚嶇О</TableHead>
      <TableHead scope="col" className="text-right">
        鎿嶄綔
      </TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {spaces.map((row) => (
      <TableRow key={space.id}>
        <TableCell className="font-medium">{space.name}</TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-11">
                  <Pencil className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>缂栬緫</TooltipContent>
            </Tooltip>
          </div>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

**Apply to:** use `Plus`, `Pencil`, and `Trash2` icon buttons with tooltips; keep child account management inside the space detail page only.

---

### `src/components/spaces/child-account-form.tsx` (component, CRUD)

**Analog:** `src/components/spaces/space-form.tsx`

**Imports pattern** (lines 1-41):
```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { formatMinor, parseToMinor } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
```

**Money input parse pattern** (lines 100-128):
```tsx
const selectedCurrency = useWatch({
  control: form.control,
  name: "currencyCode",
});
const selectedCurrencyMeta = useMemo(
  () => currencies.find((currency) => currency.code === selectedCurrency),
  [currencies, selectedCurrency],
);

let amountMinor: number;
try {
  amountMinor = parseToMinor(amountInput, currency.minorUnit);
  if (amountMinor <= 0) throw new Error("non-positive amount");
} catch {
  form.setError("amountMinor", { message: "璇疯緭鍏ユ湁鏁堥噾棰濄€? });
  return;
}
```

**Submit lifecycle pattern** (lines 129-147):
```tsx
startTransition(async () => {
  try {
    const res =
      mode === "add"
        ? await createSpace(values)
        : await updateSpace(space!.id!, values);

    if (res.ok) {
      toast.success(mode === "add" ? "宸插垱寤虹┖闂? : "宸蹭繚瀛樹慨鏀?);
      onOpenChange(false);
      router.refresh();
    } else {
      form.setError("root", { message: res.error });
      toast.error(res.error);
    }
  } catch {
    toast.error("淇濆瓨澶辫触,璇烽噸璇曘€?);
  }
});
```

**Apply to:** add/edit child form with seat type select, email/login input, label/note, joined date, monthly payment day, monthly amount input, and per-child currency select.

---

### `src/components/spaces/child-account-delete-dialog.tsx` (component, CRUD)

**Analog:** `src/components/channels/archive-dialog.tsx`

**Confirmation imports and state pattern** (lines 1-16, 24-31):
```tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const [isPending, startTransition] = useTransition();
```

**Confirm lifecycle pattern** (lines 27-41):
```tsx
function onConfirm() {
  if (!channel) return;
  startTransition(async () => {
    try {
      const res = await archiveChannel(channel.id);
      if (res.ok) {
        toast.success("宸插綊妗ｆ笭閬?);
        onOpenChange(false);
      } else {
        toast.error("淇濆瓨澶辫触,璇烽噸璇曘€?);
      }
    } catch {
      toast.error("淇濆瓨澶辫触,璇烽噸璇曘€?);
    }
  });
}
```

**Dialog shell pattern** (lines 44-60):
```tsx
<AlertDialog open={channel !== null} onOpenChange={onOpenChange}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>褰掓。姝ゆ笭閬?</AlertDialogTitle>
      <AlertDialogDescription>
        ...
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={isPending}>鍙栨秷</AlertDialogCancel>
      <Button variant="secondary" onClick={onConfirm} disabled={isPending}>
        {isPending ? "褰掓。涓€? : "褰掓。"}
      </Button>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Apply to:** use `variant="destructive"` for hard child-account delete and call the child delete Server Action. Child delete does not require typed-name confirmation; space delete does.

---

### `src/components/spaces/mother-seat-card.tsx` (component, CRUD)

**Analog:** `src/components/spaces/space-detail-actions.tsx`

**Detail action/dialog trigger pattern** (lines 16-39):
```tsx
export function SpaceDetailActions({
  space,
  channels,
  currencies,
}: SpaceDetailActionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Pencil className="size-4" />
        缂栬緫
      </Button>
      {open ? (
        <SpaceForm
          key={space.id}
          open
          mode="edit"
          space={space}
          channels={channels}
          currencies={currencies}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
}
```

**Apply to:** create a detail-page card/control to edit mother `seatType` and `canChangeSeatType`; use dialog or compact controls matching existing detail-page action style.

---

### `src/components/spaces/space-delete-dialog.tsx` (component, CRUD)

**Analog:** `src/components/channels/archive-dialog.tsx`

**Apply to:** copy AlertDialog shell and transition/toast lifecycle from `archive-dialog.tsx` lines 24-60, but add an `Input` for typed confirmation. Disable destructive button until the typed value exactly equals `space.name`; still rely on server validation.

---

### `src/components/spaces/space-table.tsx` (component, request-response)

**Analog:** `src/components/spaces/space-table.tsx`

**USD display pattern** (lines 189-196):
```tsx
<TableCell className="text-right font-mono">
  {formatCurrencyMinor(space.amountMinor, currency)}
</TableCell>
<TableCell className="text-right font-mono">
  {space.amountUsd === null
    ? "-"
    : `$${formatMinor(space.amountUsd, 2)} USD`}
</TableCell>
```

**Apply to:** add current estimated CNY display adjacent to the frozen USD amount, preserving USD as authoritative. Use graceful fallback when the CNY rate is missing.

---

### `src/components/spaces/space-detail-actions.tsx` (component, CRUD)

**Analog:** `src/components/spaces/space-detail-actions.tsx`

**Apply to:** keep existing edit button and optionally add a destructive delete dialog trigger beside it. Do not add a global child account sidebar/list entry.

---

### `src/db/childAccounts.query.test.ts` (test, CRUD)

**Analog:** `src/db/spaces.query.test.ts`

**Harness pattern** (lines 1-25):
```typescript
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { seedCurrencies } from "@/db/seed";
import { createTestDb } from "@/test/db-harness";

describe("space queries (SPACE-02 / SPACE-03 / ACCT-01)", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
    seedCurrencies(ctx.db);
  });

  afterEach(() => {
    ctx.sqlite.close();
  });
});
```

**Fixture pattern** (lines 27-53):
```typescript
function makeSpace(
  overrides: Partial<typeof space.$inferInsert> & { name: string },
  motherEmail = `${overrides.name}@example.com`,
) {
  const channelId =
    overrides.paymentChannelId ?? insertChannel(ctx.db, "Visa").id;

  return insertSpaceWithMother(ctx.db, { ... }, motherEmail);
}
```

**Apply to:** test child insert/list/update/delete, child currency joins, child FK cascade when deleting a space, and no orphan rows.

---

### `src/db/spaces.query.test.ts` (test, CRUD)

**Analog:** `src/db/spaces.query.test.ts`

**Existing cascade assertion** (lines 128-139):
```typescript
it("cascades mother account deletion when the owning space is deleted", () => {
  const row = makeSpace({ name: "Cascade Mother" });

  ctx.db.delete(space).where(eq(space.id, row.id)).run();

  const mothers = ctx.db
    .select()
    .from(motherAccount)
    .where(eq(motherAccount.spaceId, row.id))
    .all();
  expect(mothers).toHaveLength(0);
});
```

**Apply to:** extend with `deleteSpaceCascade` typed-name mismatch/success tests and assert both mother and child rows are gone after success.

---

### `src/actions/childAccounts.test.ts` (test, request-response)

**Analog:** `src/actions/spaces.test.ts`

**Mocking pattern** (lines 1-17):
```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestDb } from "@/test/db-harness";

const dbHolder = vi.hoisted(() => ({ current: null as unknown as TestDb }));
const fxMock = vi.hoisted(() => ({ ensureFreshRates: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", () => ({
  get db() {
    return dbHolder.current;
  },
}));
vi.mock("@/lib/fx/frankfurter", () => ({
  ensureFreshRates: fxMock.ensureFreshRates,
}));
```

**Setup pattern** (lines 25-43):
```typescript
beforeEach(() => {
  ctx = createTestDb();
  dbHolder.current = ctx.db;
  seedCurrencies(ctx.db);
  channelId = insertChannel(ctx.db, "Visa").id;
  fxMock.ensureFreshRates.mockResolvedValue({
    stale: false,
    fetchedAt: "2026-06-28T00:00:00.000Z",
  });
});

afterEach(() => {
  vi.clearAllMocks();
  ctx.sqlite.close();
});
```

**No-rate and snapshot tests pattern** (lines 61-88, 90-146):
```typescript
it("blocks create when the currency has no cached rate and writes no space", async () => {
  const res = await createSpace(validInput({ currencyCode: "EUR" }));

  expect(res.ok).toBe(false);
  expect(ctx.db.select().from(space).all()).toHaveLength(0);
});

it("preserves frozen snapshot on name-only update", async () => {
  fxMock.ensureFreshRates.mockClear();
  const res = await updateSpace(row.id, validInput({ name: "Team Pro Renamed" }));

  expect(res.ok).toBe(true);
  expect(fxMock.ensureFreshRates).not.toHaveBeenCalled();
});
```

**Apply to:** test child create no-rate block, snapshot creation, non-price edit preservation, amount/currency refreeze, delete child, invalid IDs, and mass-assignment ignoring credential-looking fields.

---

### `src/actions/spaces.test.ts` (test, request-response)

**Analog:** `src/actions/spaces.test.ts`

**Apply to:** import new `deleteSpace` action and extend the existing mocked-db harness. Add typed-name mismatch leaves all rows intact; exact match deletes the space and cascades mother/children.

---

### `src/lib/money.test.ts` (test, transform)

**Analog:** `src/lib/money.test.ts`

**Money helper test pattern** (lines 5-50):
```typescript
describe("money helpers (integer minor units, currency-aware exponent)", () => {
  it("parses a 2-decimal currency to integer minor units", () => {
    expect(parseToMinor("19.99", 2)).toBe(1999);
  });

  it("freezes JPY using exponent 0 without 100x corruption", () => {
    expect(freezeUsdMinor(1000, 0, "0.0064")).toBe(640);
  });
});
```

**Currency formatting pattern** (lines 52-66):
```typescript
describe("formatCurrencyMinor", () => {
  it("shows familiar symbols alongside currency codes", () => {
    expect(
      formatCurrencyMinor(1999, { code: "USD", minorUnit: 2, symbol: "$" }),
    ).toBe("$19.99 USD");
  });
});
```

**Apply to:** add tests for USD-to-CNY display conversion direction, missing/invalid CNY rate behavior if helper owns fallback, and BigInt rounding.

## Shared Patterns

### Authentication

**Source:** `.planning/REQUIREMENTS.md` and current source architecture  
**Apply to:** all Phase 04 controllers/components

No authentication/session layer exists in this single-user local app. Do not add auth middleware for Phase 04. Continue to validate object IDs and payloads server-side.

### Server Action Security

**Source:** `src/actions/spaces.ts` lines 19-28  
**Apply to:** `src/actions/childAccounts.ts`, `src/actions/spaces.ts`
```typescript
/**
 * Security (T-03-INPUT / T-03-MASS / T-03-REFDATA):
 * - Every action re-parses input with Zod server-side because Server Actions
 *   are public endpoints; client validation is only convenience.
 * - Parsed fields are whitelisted, blocking mass-assignment.
 * - Reference data is rechecked server-side; client select options are never
 *   trusted as authority.
 */
```

### Explicit-DB Data Helpers

**Source:** `src/db/spaces.ts` lines 5-12; `src/db/fxRates.ts` lines 5-16  
**Apply to:** all new DB helpers and DB tests
```typescript
/**
 * Helpers take an explicit `db` so the same code runs against production and
 * the in-memory test harness. All queries use Drizzle builders.
 */
type Db = BetterSQLite3Database<Record<string, unknown>>;
```

### Transactions

**Source:** `src/db/spaces.ts` lines 35-39; `src/db/fxRates.ts` lines 63-75  
**Apply to:** child creation if multiple rows are written; cascade space delete
```typescript
return db.transaction((tx) => {
  const row = tx.insert(space).values(spaceValues).returning().get();
  tx.insert(motherAccount).values({ spaceId: row.id, email }).run();
  return row;
});
```

```typescript
db.transaction((tx) => {
  for (const r of rows) {
    tx.insert(fxRate)
      .values(r)
      .onConflictDoUpdate({
        target: fxRate.currencyCode,
        set: { rateToUsd: r.rateToUsd, fetchedAt: r.fetchedAt },
      })
      .run();
  }
});
```

### FX Snapshot

**Source:** `src/actions/spaces.ts` lines 58-90 and 169-182  
**Apply to:** child create/update monthly price

Use `ensureFreshRates()`, `getRate(db, currencyCode)`, `getCurrencyMinorUnit(db, currencyCode)`, and `freezeUsdMinor(...)`. Preserve existing frozen values unless monthly amount or monthly currency changes.

### RSC Reads, Client Mutations

**Source:** `src/app/spaces/[id]/page.tsx` lines 29-43; `src/components/spaces/space-form.tsx` lines 129-147  
**Apply to:** detail page, child table/form, mother seat controls

Server Components read with the production `db` singleton; client components call Server Actions and `router.refresh()` after success.

### Dialog Forms

**Source:** `src/components/spaces/space-form.tsx` lines 151-370; `src/components/channels/channel-dialog.tsx` lines 80-130  
**Apply to:** child add/edit and mother seat edit

Use local shadcn `Dialog`, `Form`, `FormField`, `Input`, `Select`, `DialogFooter`, `useTransition`, `zodResolver`, and `toast`.

### Destructive Confirmations

**Source:** `src/components/channels/archive-dialog.tsx` lines 44-60  
**Apply to:** child delete and space cascade delete

Use `AlertDialog` for confirmations. For hard delete actions, use a destructive button variant and explicit copy. Space delete must also include typed-name confirmation and server-side name validation.

### Test Harness

**Source:** `src/test/db-harness.ts` lines 15-20  
**Apply to:** all new DB/action tests
```typescript
export function createTestDb(migrationsFolder = "./drizzle") {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder });
  return { db, sqlite };
}
```

## No Analog Found

All inferred Phase 04 files have a close role or exact analog in the current codebase.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| _None_ | - | - | - |

## Metadata

**Analog search scope:** `src/db`, `src/actions`, `src/lib`, `src/lib/validation`, `src/components/spaces`, `src/components/channels`, `src/components/currencies`, `src/app/spaces`, `src/test`, `drizzle`  
**Files scanned:** 36  
**Pattern extraction date:** 2026-06-28  
**Subagent availability check:** `tool_search` for `spawn_agent subagent multi-agent` returned no tools.  
**Write note:** no `Write` tool was exposed in this session, so this file was created with the patch tool; no source files were modified.
