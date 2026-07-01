# Phase 05: Dashboard & Overview - Pattern Map

**Mapped:** 2026-06-30
**Files analyzed:** 6
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/page.tsx` | route / server component | request-response | `src/app/spaces/page.tsx` | exact |
| `src/db/dashboard.ts` | service / DB query facade | batch aggregate + transform | `src/db/spaces.ts` + `src/db/childAccounts.ts` | role-match |
| `src/db/dashboard.query.test.ts` | test | batch aggregate + transform | `src/db/spaces.query.test.ts` | exact |
| `src/components/dashboard/metric-card.tsx` | component | request-response render | `src/components/spaces/mother-seat-card.tsx` | role-match |
| `src/components/dashboard/expiring-space-table.tsx` | component | request-response render | `src/components/spaces/space-table.tsx` | exact |
| `src/components/dashboard/distribution-list.tsx` | component | transform | `src/components/spaces/mother-seat-card.tsx` + `src/components/ui/card.tsx` | partial |

## Pattern Assignments

### `src/app/page.tsx` (route / server component, request-response)

**Analog:** `src/app/spaces/page.tsx`

**Current file to replace** (`src/app/page.tsx` lines 1-17):
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold leading-tight">仪表盘</h1>
      <Card>
        <CardHeader>
          <CardTitle>仪表盘</CardTitle>
        </CardHeader>
        <CardContent className="text-base text-muted-foreground">
          仪表盘将在后续阶段实现。
        </CardContent>
      </Card>
    </div>
  );
}
```

**Imports + Node-backed dynamic route pattern** (`src/app/spaces/page.tsx` lines 1-12):
```tsx
import { db } from "@/db";
import { listChannels } from "@/db/channels";
import { listCurrencies } from "@/db/currencies";
import { getRate } from "@/db/fxRates";
import { listSpaceDetails } from "@/db/spaces";
import { formatCurrencyMinor } from "@/lib/currencies";
import { convertUsdMinorToCurrencyMinor } from "@/lib/money";
import { SpaceTable } from "@/components/spaces/space-table";

// better-sqlite3 is a native module — keep this RSC on the Node runtime.
export const dynamic = "force-dynamic";
```

**Server data-read pattern** (`src/app/spaces/page.tsx` lines 13-27):
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
  const cnyCurrency = currencies.find((item) => item.code === "CNY");
  const cnyRate = getRate(db, "CNY");
```

**Render DTO through a component pattern** (`src/app/spaces/page.tsx` lines 42-50):
```tsx
return (
  <SpaceTable
    spaces={spaces}
    channels={channels}
    currencies={currencies}
    cnyReferences={cnyReferences}
    selectedCountry={country || undefined}
    selectedChannel={Number.isFinite(channelId) ? channelId : undefined}
  />
);
```

**Apply to dashboard:** import `db`, import `getDashboardOverview` from `@/db/dashboard`, export `dynamic = "force-dynamic"`, call the query facade server-side, then render compact dashboard components. Do not add route handlers, client fetch, or dashboard mutations.

---

### `src/db/dashboard.ts` (service / DB query facade, batch aggregate + transform)

**Analogs:** `src/db/spaces.ts`, `src/db/childAccounts.ts`, `src/db/schema.ts`

**Imports + explicit DB handle pattern** (`src/db/spaces.ts` lines 1-12):
```ts
import { and, asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { currency, motherAccount, paymentChannel, space } from "./schema";

/**
 * SPACE-02/03 — parameterized space data access.
 *
 * Helpers take an explicit `db` so the same code runs against production and
 * the in-memory test harness. All queries use Drizzle builders; the space +
 * mother account write is one synchronous SQLite transaction.
 */
type Db = BetterSQLite3Database<Record<string, unknown>>;
```

**Joined list query pattern** (`src/db/spaces.ts` lines 65-89):
```ts
export function listSpaceDetails(
  db: Db,
  filters: SpaceListFilters = {},
): SpaceListRow[] {
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
    .where(
      and(
        filters.country ? eq(space.country, filters.country) : undefined,
        filters.channelId
          ? eq(space.paymentChannelId, filters.channelId)
          : undefined,
      ),
    )
    .orderBy(asc(space.expiryDate))
    .all();
}
```

**Child cost source query pattern** (`src/db/childAccounts.ts` lines 26-39):
```ts
export function listChildAccounts(
  db: Db,
  spaceId: number,
): ChildAccountListRow[] {
  return db
    .select({
      childAccount,
      currency,
    })
    .from(childAccount)
    .innerJoin(currency, eq(currency.code, childAccount.monthlyCurrencyCode))
    .where(eq(childAccount.spaceId, spaceId))
    .orderBy(asc(childAccount.id))
    .all();
}
```

**Authoritative dashboard source fields** (`src/db/schema.ts` lines 57-79):
```ts
export const space = sqliteTable("space", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  country: text("country").notNull(), // ISO-3166 alpha-2 (D-11)
  paymentChannelId: integer("payment_channel_id")
    .notNull()
    .references(() => paymentChannel.id), // FK preserves integrity (D-07)
  currencyCode: text("currency_code")
    .notNull()
    .references(() => currency.code),
  // money as integer minor units (Pattern 3)
  amountMinor: integer("amount_minor").notNull(),
  // structured subscription period {unit, count} (locked names)
  periodUnit: text("period_unit"), // 'month' | 'quarter' | 'year'
  periodCount: integer("period_count"),
  // FX-snapshot reserved columns (locked names; nullable until Phase 3)
  rateUsed: text("rate_used"), // decimal string, not float
  rateAsOf: text("rate_as_of"),
  rateSource: text("rate_source"),
  amountUsd: integer("amount_usd"), // USD minor units, frozen at payment
  openingDate: text("opening_date"), // YYYY-MM-DD
  expiryDate: text("expiry_date"), // derived + stored Phase 3
});
```

**Authoritative child monthly cost fields** (`src/db/schema.ts` lines 95-112):
```ts
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
```

**Apply to dashboard:** define exported DTO types near the query function, accept `db: Db` and optional `today = new Date()`, aggregate `space.amountUsd` separately from `childAccount.monthlyAmountUsd`, then merge integer USD minor-unit bucket maps in TypeScript. Do not join children while summing `space.amountUsd`, because that multiplies parent payments by child count.

---

### `src/db/dashboard.query.test.ts` (test, batch aggregate + transform)

**Analog:** `src/db/spaces.query.test.ts`

**Imports + harness pattern** (`src/db/spaces.query.test.ts` lines 1-15):
```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getCurrencyMinorUnit } from "@/db/currencies";
import { getRate, upsertRates } from "@/db/fxRates";
import { insertChannel } from "@/db/channels";
import { seedCurrencies } from "@/db/seed";
import { childAccount, motherAccount, space } from "@/db/schema";
import {
  deleteSpaceCascade,
  getSpaceDetail,
  insertSpaceWithMother,
  listSpaces,
} from "@/db/spaces";
import { createTestDb } from "@/test/db-harness";
```

**Test lifecycle pattern** (`src/db/spaces.query.test.ts` lines 16-26):
```ts
describe("space queries (SPACE-02 / SPACE-03 / ACCT-01)", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
    seedCurrencies(ctx.db);
  });

  afterEach(() => {
    ctx.sqlite.close();
  });
```

**Space fixture pattern** (`src/db/spaces.query.test.ts` lines 28-54):
```ts
function makeSpace(
  overrides: Partial<typeof space.$inferInsert> & { name: string },
  motherEmail = `${overrides.name}@example.com`,
) {
  const channelId =
    overrides.paymentChannelId ?? insertChannel(ctx.db, "Visa").id;

  return insertSpaceWithMother(
    ctx.db,
    {
      name: overrides.name,
      country: overrides.country ?? "US",
      paymentChannelId: channelId,
      currencyCode: overrides.currencyCode ?? "USD",
      amountMinor: overrides.amountMinor ?? 1000,
      periodUnit: overrides.periodUnit ?? "month",
      periodCount: overrides.periodCount ?? 1,
      rateUsed: overrides.rateUsed ?? "1",
      rateAsOf: overrides.rateAsOf ?? "2026-06-28T00:00:00.000Z",
      rateSource: overrides.rateSource ?? "frankfurter",
      amountUsd: overrides.amountUsd ?? 1000,
      openingDate: overrides.openingDate ?? "2026-01-01",
      expiryDate: overrides.expiryDate ?? "2026-02-01",
    },
    motherEmail,
  );
}
```

**Child fixture pattern** (`src/db/childAccounts.query.test.ts` lines 53-67):
```ts
function makeChild(spaceId: number, email = "child@example.com") {
  return insertChildAccount(ctx.db, {
    spaceId,
    seatType: "codex",
    email,
    label: "Seat",
    joinedDate: "2026-01-15",
    monthlyAmountMinor: 2000,
    monthlyCurrencyCode: "USD",
    monthlyRateUsed: "1",
    monthlyRateAsOf: "2026-06-28T00:00:00.000Z",
    monthlyRateSource: "frankfurter",
    monthlyAmountUsd: 2000,
    monthlyPaymentDay: 15,
  });
}
```

**Assertion pattern for ordering and filters** (`src/db/spaces.query.test.ts` lines 56-96):
```ts
it("lists spaces by expiry date ascending and applies country/channel filters", () => {
  const visa = insertChannel(ctx.db, "Visa");
  const alipay = insertChannel(ctx.db, "Alipay");

  const later = makeSpace({
    name: "Later US Visa",
    country: "US",
    paymentChannelId: visa.id,
    expiryDate: "2026-09-01",
  });
  const sooner = makeSpace({
    name: "Sooner CN Alipay",
    country: "CN",
    paymentChannelId: alipay.id,
    expiryDate: "2026-07-01",
  });
  const middle = makeSpace({
    name: "Middle US Alipay",
    country: "US",
    paymentChannelId: alipay.id,
    expiryDate: "2026-08-01",
  });

  expect(listSpaces(ctx.db).map((row) => row.id)).toEqual([
    sooner.id,
    middle.id,
    later.id,
  ]);
```

**Apply to dashboard tests:** cover expired/soon list ordering, integer reconciliation of `space.amountUsd + childAccount.monthlyAmountUsd`, country/currency/payment-channel bucket totals, counts by space/child/status/seat type, and an explicit double-counting guard where one space has multiple children.

---

### `src/components/dashboard/metric-card.tsx` (component, request-response render)

**Analog:** `src/components/spaces/mother-seat-card.tsx`

**Imports pattern** (`src/components/spaces/mother-seat-card.tsx` lines 15-17):
```tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
```

**Compact card layout pattern** (`src/components/spaces/mother-seat-card.tsx` lines 79-114):
```tsx
<Card>
  <CardHeader className="flex flex-row items-start justify-between gap-4">
    <div>
      <CardTitle>母账号席位</CardTitle>
      <p className="mt-2 text-sm text-muted-foreground">
        母账号也作为一个席位记录。只能编辑席位类型和是否可变更席位类型。
      </p>
    </div>
    <Button variant="outline" onClick={() => setOpen(true)}>
      <Pencil className="size-4" />
      编辑
    </Button>
  </CardHeader>
  <CardContent className="grid gap-4 md:grid-cols-3">
    <div>
      <p className="text-sm text-muted-foreground">邮箱/登录名</p>
      <p className="font-mono">{motherAccount.email}</p>
    </div>
    <div>
      <p className="text-sm text-muted-foreground">席位类型</p>
      <Badge
        variant={
          motherAccount.seatType === "codex" ? "secondary" : "outline"
        }
      >
        {motherAccount.seatType}
      </Badge>
    </div>
    <div>
      <p className="text-sm text-muted-foreground">可变更席位类型</p>
      <p className="font-medium">
        {motherAccount.canChangeSeatType ? "是" : "否"}
      </p>
    </div>
  </CardContent>
</Card>
```

**Card primitive sizing behavior** (`src/components/ui/card.tsx` lines 5-20):
```tsx
function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        className
      )}
      {...props}
    />
  )
}
```

**Apply to dashboard:** make a small presentational component with `label`, `value`, optional `description`, and optional `tone` / badge. Use `Card size="sm"` for dense top metrics and keep values in `font-mono` where they are counts or money.

---

### `src/components/dashboard/expiring-space-table.tsx` (component, request-response render)

**Analog:** `src/components/spaces/space-table.tsx`

**Imports pattern** (`src/components/spaces/space-table.tsx` lines 3-34):
```tsx
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Plus } from "lucide-react";
import type { ChannelRow } from "@/db/channels";
import type { CurrencyRow } from "@/db/currencies";
import type { SpaceListRow } from "@/db/spaces";
import { COUNTRIES } from "@/lib/countries";
import { formatCurrencyMinor } from "@/lib/currencies";
import { formatMinor } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExpiryBadge } from "./expiry-badge";
```

**Empty-state pattern** (`src/components/spaces/space-table.tsx` lines 139-158):
```tsx
{spaces.length === 0 ? (
  hasFilters ? (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-12 text-center">
      <h2 className="text-lg font-semibold">没有符合条件的空间</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        调整或清除筛选条件后再试。
      </p>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-12 text-center">
      <h2 className="text-lg font-semibold">还没有空间</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        创建你的第一个空间,记录归属国家、支付渠道、金额与订阅周期,系统会自动算出到期日并冻结 USD 金额。
      </p>
      <Button onClick={() => setFormState({ mode: "add" })}>
        <Plus className="size-4" />
        新增空间
      </Button>
    </div>
  )
```

**Compact table + expiry badge pattern** (`src/components/spaces/space-table.tsx` lines 160-215):
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead scope="col">名称</TableHead>
      <TableHead scope="col">国家/地区</TableHead>
      <TableHead scope="col">支付渠道</TableHead>
      <TableHead scope="col" className="text-right">
        原始金额
      </TableHead>
      <TableHead scope="col" className="text-right">
        USD
      </TableHead>
      <TableHead scope="col">到期日</TableHead>
      <TableHead scope="col" className="text-right">
        操作
      </TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {spaces.map((row) => {
      const { space, paymentChannel, currency } = row;
      return (
        <TableRow key={space.id}>
          <TableCell className="font-medium">
            <Link
              href={`/spaces/${space.id}`}
              className="hover:underline"
            >
              {space.name}
            </Link>
          </TableCell>
          <TableCell className="font-mono">{space.country}</TableCell>
          <TableCell>{paymentChannel.name}</TableCell>
          <TableCell className="text-right font-mono">
            {formatCurrencyMinor(space.amountMinor, currency)}
          </TableCell>
          <TableCell className="text-right font-mono">
            <div className="flex flex-col items-end gap-1">
              <span>
                {space.amountUsd === null
                  ? "-"
                  : `$${formatMinor(space.amountUsd, 2)} USD`}
              </span>
              <span className="text-xs text-muted-foreground">
                当前 CNY 参考：{cnyReferences[space.id] ?? "暂无 CNY 参考"}
              </span>
            </div>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <span className="font-mono">
                {space.expiryDate ?? "-"}
              </span>
              <ExpiryBadge expiryDate={space.expiryDate} />
            </div>
          </TableCell>
```

**Icon link + tooltip action pattern** (`src/components/spaces/space-table.tsx` lines 217-233):
```tsx
<div className="flex justify-end gap-1">
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="size-11"
        aria-label={`查看 ${space.name}`}
      >
        <Link href={`/spaces/${space.id}`}>
          <Eye className="size-4" />
        </Link>
      </Button>
    </TooltipTrigger>
    <TooltipContent>详情</TooltipContent>
  </Tooltip>
```

**Apply to dashboard:** make this read-only; include no `useState`, forms, edit buttons, or delete buttons. Keep the detail link to `/spaces/[id]`, reuse `ExpiryBadge`, and use `formatMinor(amountUsd, 2)` for frozen USD.

---

### `src/components/dashboard/distribution-list.tsx` (component, transform)

**Analogs:** `src/components/spaces/mother-seat-card.tsx`, `src/components/ui/card.tsx`, `src/components/spaces/child-account-table.tsx`

**Card header/content composition** (`src/components/ui/card.tsx` lines 23-44, 72-79):
```tsx
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}
```

```tsx
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}
```

**Dense grid detail pattern** (`src/components/spaces/mother-seat-card.tsx` lines 92-113):
```tsx
<CardContent className="grid gap-4 md:grid-cols-3">
  <div>
    <p className="text-sm text-muted-foreground">邮箱/登录名</p>
    <p className="font-mono">{motherAccount.email}</p>
  </div>
  <div>
    <p className="text-sm text-muted-foreground">席位类型</p>
    <Badge
      variant={
        motherAccount.seatType === "codex" ? "secondary" : "outline"
      }
    >
      {motherAccount.seatType}
    </Badge>
  </div>
  <div>
    <p className="text-sm text-muted-foreground">可变更席位类型</p>
    <p className="font-medium">
      {motherAccount.canChangeSeatType ? "是" : "否"}
    </p>
  </div>
</CardContent>
```

**Money display pattern** (`src/components/spaces/child-account-table.tsx` lines 126-131):
```tsx
<TableCell className="text-right font-mono">
  {formatCurrencyMinor(child.monthlyAmountMinor, row.currency)}
</TableCell>
<TableCell className="text-right font-mono">
  ${formatMinor(child.monthlyAmountUsd, 2)} USD
</TableCell>
```

**Apply to dashboard:** render bucket rows as label + monospaced USD + percent + CSS bar. Keep the bar as CSS using width from precomputed percentage. Do not add a chart dependency.

## Shared Patterns

### Dynamic Server Components For DB Reads

**Source:** `src/app/spaces/page.tsx`
**Apply to:** `src/app/page.tsx`

```tsx
// better-sqlite3 is a native module — keep this RSC on the Node runtime.
export const dynamic = "force-dynamic";
```

Use this once root dashboard imports `@/db`.

### Explicit DB Parameter In Query Helpers

**Source:** `src/db/spaces.ts` lines 5-12 and `src/db/childAccounts.ts` lines 5-11
**Apply to:** `src/db/dashboard.ts`

```ts
/**
 * Helpers take an explicit `db` so the same code runs against production and
 * the in-memory test harness. All queries use Drizzle builders; the space +
 * mother account write is one synchronous SQLite transaction.
 */
type Db = BetterSQLite3Database<Record<string, unknown>>;
```

```ts
/**
 * ACCT-02/03 — child-account data access.
 *
 * Helpers take an explicit `db` so production code and the migration-backed
 * in-memory test harness exercise the same Drizzle builders.
 */
type Db = BetterSQLite3Database<Record<string, unknown>>;
```

### Expiry Status

**Source:** `src/lib/expiry.ts` lines 39-47 and `src/components/spaces/expiry-badge.tsx` lines 13-24
**Apply to:** dashboard risk count, expiring list, and badge display

```ts
export function expiryStatus(
  expiry: string,
  today = new Date(),
): "expired" | "soon" | "normal" {
  const days = differenceInCalendarDays(localDateFromIsoDate(expiry), today);
  if (days < 0) return "expired";
  if (days <= 7) return "soon";
  return "normal";
}
```

```tsx
const status = expiryStatus(expiryDate);
if (status === "expired") {
  return <Badge variant="destructive">已过期</Badge>;
}
if (status === "soon") {
  return (
    <Badge className="border-transparent bg-[oklch(0.769_0.15_70)] text-black hover:bg-[oklch(0.769_0.15_70)] dark:bg-[oklch(0.79_0.14_70)] dark:text-black">
      即将到期
    </Badge>
  );
}
return <Badge variant="outline">正常</Badge>;
```

### Frozen USD Money Semantics

**Source:** `src/lib/money.ts` lines 11-26 and `src/lib/currencies.ts` lines 21-27
**Apply to:** totals, bucket values, table cells, metric cards

```ts
export function formatMinor(amountMinor: number, exponent: number): string {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`amountMinor must be an integer, got: ${amountMinor}`);
  }
  if (!Number.isInteger(exponent) || exponent < 0) {
    throw new Error(`exponent must be a non-negative integer, got: ${exponent}`);
  }
  const sign = amountMinor < 0 ? "-" : "";
  const abs = Math.abs(amountMinor);
  if (exponent === 0) return `${sign}${abs}`;
  const divisor = 10 ** exponent;
  const whole = Math.floor(abs / divisor);
  const frac = abs % divisor;
  return `${sign}${whole}.${String(frac).padStart(exponent, "0")}`;
}
```

```ts
export function formatCurrencyMinor(
  amountMinor: number,
  currency: CurrencyDisplayMeta,
): string {
  const amount = formatMinor(amountMinor, currency.minorUnit);
  return `${currency.symbol}${amount} ${currency.code}`;
}
```

### Test Database Harness

**Source:** `src/test/db-harness.ts` lines 15-20
**Apply to:** `src/db/dashboard.query.test.ts`

```ts
export function createTestDb(migrationsFolder = "./drizzle") {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder });
  return { db, sqlite };
}
```

### No Dashboard Auth Or Mutation Surface

**Source:** Phase 05 context and project constraints
**Apply to:** all dashboard files

Phase 05 is a single-user, view-first dashboard. Do not add authentication, roles, route handlers, Server Actions, edit dialogs, delete controls, online payment flows, or notification side effects. The dashboard may link to existing `/spaces/[id]` detail flows.

## No Analog Found

No planned file is completely without a local analog.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/db/dashboard.ts` aggregate internals | service / DB query facade | batch aggregate + transform | Role analogs exist, but no existing source file uses Drizzle `sum` / `groupBy`; planner should use the research aggregate examples plus the explicit-db patterns above. |
| `src/components/dashboard/distribution-list.tsx` bar visualization | component | transform | Card/list analogs exist, but no existing CSS bar-list component exists; planner should keep it as simple CSS inside existing Card primitives. |

## Metadata

**Analog search scope:** `src/app`, `src/db`, `src/components`, `src/lib`, `src/test`
**Files scanned:** 84 source files
**Pattern extraction date:** 2026-06-30
