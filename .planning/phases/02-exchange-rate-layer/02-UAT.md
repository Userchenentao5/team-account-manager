---
status: testing
phase: 02-exchange-rate-layer
source: [02-VERIFICATION.md]
started: 2026-06-28T01:35:00Z
updated: 2026-06-28T01:35:00Z
---

## Current Test

number: 1
name: 汇率屏幕展示 6 行汇率 + 汇率截至 label
expected: |
  6-row table with USD pinned to 1 (plus CNY/EUR/GBP/JPY/HKD as X→USD decimals) and a visible 汇率截至 <date> label.
awaiting: user response

## Tests

### 1. 汇率屏幕展示 6 行汇率 + 汇率截至 label
expected: npm run dev → open http://localhost:3000 → 参考数据 → 汇率. 6-row table with USD pinned to 1 and a visible 汇率截至 <date> label.
result: [pending]

### 2. 点击刷新汇率触发实时刷新
expected: Click 刷新汇率 → success toast 汇率已更新 and the 汇率截至 date refreshes to today (D-06).
result: [pending]

### 3. 重启后缓存数据持久化
expected: Stop and restart npm run dev, reopen the Rates screen → previously fetched rows are still present (on-disk cache persisted).
result: [pending]

### 4. API 不可用降级 + 陈旧横幅
expected: Block egress to api.frankfurter.dev (or point URL at an unreachable host) and click 刷新汇率 → page does NOT crash, cached rows remain, 汇率截至 label still shows, 汇率可能已过期 destructive stale banner appears; no row shows 0/NULL (FX-03).
result: [pending]

### 5. 空缓存 + 抓取失败的空状态
expected: With an empty cache and a failing fetch, open the Rates screen → distinct 暂无汇率数据 empty state shows instead of a zero-filled table (Pitfall 5).
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
