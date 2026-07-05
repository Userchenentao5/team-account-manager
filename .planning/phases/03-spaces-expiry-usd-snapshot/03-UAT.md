---
status: complete
phase: 03-spaces-expiry-usd-snapshot
source: [03-05-PLAN.md]
started: 2026-06-28T04:50:00Z
updated: 2026-06-28T17:34:34+08:00
---

## Current Test

[testing complete]

## Tests

### 1. Open space list
expected: `/spaces` renders the space list with `新增空间`, country/channel filters, and expiry-sorted rows.
result: pass
previously_reported: "货币增加€，￥， $等单位显示， UI的空间列表只有编辑，没有单独的详情按钮，汇率币种没有新增编辑移除的选项，币种的最小单位位数是什么意思？冻结USD又是做什么的"
resolved: 2026-06-28T13:26:04+08:00

### 2. Create space
expected: User can create a space and see `已创建空间`; row includes computed expiry, expiry badge, original amount, and USD amount.
result: pass

### 3. No-rate block
expected: Saving a currency without cached rate is blocked with `该币种暂无汇率,无法折算 USD。请先到「汇率」页刷新汇率后重试。`, and no row is created.
result: pass
previously_reported: "币种中暂时还没有新建入口"
resolved: 2026-06-28T17:28:24+08:00

### 4. Filters
expected: Country/channel filters update the URL query and narrow the table; filtered-empty differs from true-empty.
result: pass

### 5. Detail page
expected: Detail page shows mother account, expiry + badge, original amount, frozen USD amount, `汇率截至 ...（已冻结）`, and the child-account placeholder.
result: pass

### 6. Edit freeze semantics
expected: Name-only edit preserves frozen USD snapshot; amount/currency edit refreshes it.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "`/spaces` renders the space list with clear money display, a discoverable detail action, and understandable reference-data concepts."
  status: resolved
  reason: "User reported: 货币增加€，￥， $等单位显示， UI的空间列表只有编辑，没有单独的详情按钮，汇率币种没有新增编辑移除的选项，币种的最小单位位数是什么意思？冻结USD又是做什么的"
  severity: major
  test: 1
  artifacts:
    - src/components/spaces/space-table.tsx
    - src/components/spaces/space-form.tsx
    - src/app/spaces/[id]/page.tsx
    - src/app/reference-data/currencies/page.tsx
    - src/app/reference-data/rates/page.tsx
  missing:
    - "Money amounts should show familiar currency symbols alongside currency codes."
    - "Space list should expose a dedicated detail action, not only a linked name."
    - "Reference-data screens should explain fixed currencies/minor units and frozen USD snapshot semantics clearly."
  root_cause:
    - "Currency metadata only carried code/name/minorUnit in the database, so symbols were initially display-only code metadata instead of maintainable reference data."
    - "Space list relied on linked names for navigation and only showed edit in the action column."
    - "Reference-data pages exposed implementation terms without enough product copy explaining read-only currencies, minor units, or frozen USD snapshots."
  fix:
    - "Added currency.symbol to the database schema, migration, seed data, and reference-data UI."
    - "Space list, space detail, currency table, and rate table now display symbols from database-backed currency metadata."
    - "Added a dedicated detail action button on the space list while keeping the edit button."
    - "Clarified that currencies are curated read-only reference data in this phase."
    - "Added UI copy explaining minor-unit decimal places and frozen USD historical cost behavior."
  verification:
    - "npx tsc --noEmit"
    - "npm test"
    - "npm run build"
    - "npm run lint"
    - "npm run db:migrate"
    - "npm run db:seed"
    - "Queried currency table and confirmed USD/CNY/EUR/GBP/JPY/HKD symbols are stored."

- truth: "User can create or select a currency with no cached FX rate, then the space save path blocks with the no-rate message and creates no row."
  status: resolved
  reason: "User reported: 币种中暂时还没有新建入口"
  severity: major
  test: 3
  artifacts:
    - src/app/reference-data/currencies/page.tsx
    - src/components/spaces/space-form.tsx
    - src/app/spaces/page.tsx
    - src/app/spaces/[id]/page.tsx
    - src/db/currencies.ts
    - src/actions/currencies.ts
  missing:
    - "Currency reference-data page needs an add-currency entry."
    - "Space create/edit dialogs need to receive DB-backed currency options so newly added currencies are selectable."
  root_cause:
    - "Currency symbols were moved into DB metadata, but currency CRUD was still not exposed in the UI."
    - "Space dialogs still depended on the default currency option list instead of receiving the current DB currency rows."
  fix:
    - "Added currency validation, DB insert/list helpers, and addCurrency server action."
    - "Added a currency dialog and currency table with a visible 新增币种 button."
    - "Clarified that adding a currency stores metadata only and does not create an FX rate; no-rate blocking happens when saving a space with that currency."
    - "Updated space list/detail pages to pass DB-backed currency options into create/edit dialogs."
    - "Newly added currencies are selectable in space creation, allowing the no-rate block to be tested."
  verification:
    - "npx tsc --noEmit"
    - "npm test"
    - "npm run lint"
    - "npm run build"
