# Phase 3: Spaces (Expiry + USD Snapshot) - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning
**Source:** /gsd-discuss-phase

<domain>
## Phase Boundary

让用户完整管理订阅空间(创建/列表/详情/编辑)及每个空间唯一的母账号,保存时**自动计算到期日**(日历感知)并**冻结 USD 快照**(用付款当时的汇率)。需求已锁定:SPACE-01~04、ACCT-01、EXP-01、FX-02。

**本阶段只决定"怎么实现",不扩范围。** 子账号增删(ACCT-02/03)、空间级联删除(SPACE-05)、仪表盘(DASH-*)分别属于 Phase 4 / Phase 5,不在此实现。

</domain>

<decisions>
## Implementation Decisions

### FX 快照取数(FX-02)
- **D-01**: 保存空间时调用 `ensureFreshRates()` 确保汇率新鲜,然后从 `fx_rate` 缓存读取该币种现值:`rate_to_usd` → `rate_used`,缓存的 `fetched_at` → `rate_as_of`,`rate_source = 'frankfurter'`。
- **D-02**: 若该币种在缓存中**没有汇率**(空缓存且刷新失败),**阻止保存**并提示用户先去"汇率"页刷新汇率 —— 绝不写入 `0`/`NULL` 的 `amount_usd`。USD 本位币始终视为 1。
- **D-03**: `amount_usd` 在保存时一次性计算并冻结(`amount_minor × rate_used`,按 USD minor units 取整存整数)。编辑空间时,除非用户改了金额/币种,否则不重算历史快照(冻结语义)。

### 母账号建模(ACCT-01)
- **D-04**: 新建独立 `mother_account` 表,与 `space` 建立 **1:1** 关系(FK `space_id`),为 Phase 4 的子账号建模与 SPACE-05 级联删除统一铺路 —— 不把母账号做成 `space` 行上的列。
- **D-05**: 母账号字段仅 email / 登录名(沿用项目约束:不存储密码等敏感凭据)。

### 到期状态与列表呈现(SPACE-02, EXP-01)
- **D-06**: 列表默认按**到期日升序**排序(最快到期在最前),支持按国家、支付渠道筛选。
- **D-07**: 到期状态三态用颜色标记:**已过期** / **即将到期(≤7 天)** / **正常**。"即将到期"阈值 = 7 天。

### 日历到期算法(EXP-01)
- **D-08**: 用 date-fns `addMonths`/`addQuarters`/`addYears` 计算到期日,采用其**默认月末钳制**行为(如 1/31 + 1 月 = 2/28,闰年得 2/29),正确处理月末与闰年。
- **D-09**: 订阅周期单位限定为 **月 / 季 / 年**(对应 `period_unit` ∈ {month, quarter, year}),结构化存 `{unit, count}`。

### Claude's Discretion
- 金额输入 UI(用户填主单位如 19.99 → 转 minor units 存储)、表单校验(Zod + RHF)、空间详情/编辑页布局、列表分页与否等实现细节,按现有 shadcn/ui + Server Actions 模式自行决定。
- 可选币种来自 Phase 1 已 seed 的币种列表。
- 详情页中"子账号"区块此阶段可显示为空占位(子账号 CRUD 属 Phase 4)。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema(已锁定,直接复用)
- `src/db/schema.ts` — `space` 表已预留所有 FX 快照/周期/到期列(nullable);本阶段新增 `mother_account` 表。`currency` / `payment_channel` 为引用数据。

### FX 服务(Phase 2 交付,本阶段消费)
- `src/lib/fx/frankfurter.ts` — `ensureFreshRates()`(保存前确保新鲜)、`refreshFromApi()`、`invertToUsd()`。
- `src/db/fxRates.ts` — fx_rate 缓存查询模块(读该币种 `rate_to_usd` + `fetched_at`)。
- `src/actions/fx.ts` — refreshRates Server Action 范式参考。

### 引用数据
- `src/lib/countries.ts` — 国家 alpha-2 代码(space 存 `country`)。
- `src/db/channels.ts` — 支付渠道查询(space 存 `payment_channel_id` FK)。

### 项目规范
- `.claude/CLAUDE.md` — 货币用整数 minor units、汇率用 decimal string、Server Actions + RSC、Zod 校验等约束。

</canonical_refs>

<specifics>
## Specific Ideas

- 保存流程:校验 → `ensureFreshRates()` → 读缓存汇率(缺失则阻止)→ 计算 `expiry_date`(date-fns)→ 计算并冻结 `amount_usd` → 写 `space` + `mother_account`(同一事务)。
- 与 Phase 2 的 stale 语义一致:`ensureFreshRates()` 失败但缓存有该币种汇率时,仍可保存(用最后已知汇率),阶段实现可决定是否给出 stale 提示;但**完全无该币种汇率**必须阻止。

</specifics>

<deferred>
## Deferred Ideas

- 子账号(codex/chatgpt)增删改 —— Phase 4(ACCT-02/03)。
- 空间删除 + 级联删除母账号/子账号 —— Phase 4(SPACE-05);`mother_account` 表的 FK 设计需为此预留(本阶段建表时考虑 onDelete 级联)。
- 汇总/分布/到期提醒仪表盘 —— Phase 5(DASH-*)。

</deferred>

---

*Phase: 03-spaces-expiry-usd-snapshot*
*Context gathered: 2026-06-28 via /gsd-discuss-phase*
