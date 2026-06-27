# 团队空间管理系统 (team-account-manager)

## What This Is

一个**单人使用的网页应用**,用于内部记账与资产管理。系统集中管理一批 Codex / ChatGPT 的**团队订阅空间**:每个空间由一个母账号开通、归属某个国家、有自己的支付渠道与金额,空间下挂着多个 codex / chatgpt 子账号。它帮使用者一眼看清哪些空间快到期需要续费,以及全部开支的总成本概览。

## Core Value

**一眼看清哪些空间快到期需要续费,并掌握折算成统一本位币 (USD) 的总成本概览。** 如果其它都失败,这一点必须成立。

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. 全部为待验证假设。 -->

- [ ] 空间的增删改查:创建、查看、编辑、删除团队空间
- [ ] 空间字段:归属国家、支付渠道、原始金额+币种、开通时间(支付时间)、订阅周期
- [ ] 母账号:每个空间一对一记录一个母账号(开通者)
- [ ] 子账号管理:每个空间下挂多个 codex / chatgpt 子账号,记录类型(codex/chatgpt)与邮箱/登录名,可增删改查
- [ ] 支付渠道枚举:用户可手动维护支付渠道列表(增删)
- [ ] 到期自动计算:根据 开通时间 + 所选订阅周期(月/季/年等)自动算出到期日
- [ ] 多币种与汇率:记录原始金额+币种,系统自动抓取实时汇率,折算成本位币 USD
- [ ] 仪表盘 · 到期提醒:高亮显示即将到期 / 已过期的空间
- [ ] 仪表盘 · 总支出:按本位币 USD 折算的总支出
- [ ] 仪表盘 · 支出分布:按国家 / 币种 / 支付渠道的支出分布
- [ ] 仪表盘 · 数量统计:空间数、子账号数等数量概览

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- 多人登录与权限系统 — 明确为单人工具,无需账号体系与角色权限
- 邮件 / IM(微信、Telegram 等)续费推送 — v1 仅在仪表盘高亮提醒即可
- 对外客户/代理转售管理(客户归属、收益核算) — 定位为内部记账,非对外生意
- 子账号密码/凭据存储 — 仅记邮箱/登录名,避免明文存储凭据的安全风险
- 在线支付/自动扣费 — 仅记录已发生的支付信息,不做实际支付

## Context

- **定位**:内部记账 / 资产管理工具,使用者即维护者本人。
- **领域**:管理 AI 服务(Codex、ChatGPT)的团队订阅账号,跨多个国家、多种币种、多种支付渠道。
- **数据层级**:空间 (Space) → 一个母账号 (Mother Account) → 多个子账号 (Child Account,类型为 codex 或 chatgpt)。
- **参考数据手动维护偏好**:使用者倾向手动维护枚举类参考数据(如支付渠道),系统应提供便捷的维护入口。
- **外部依赖**:需要接入外部实时汇率 API 以将多币种金额折算成 USD。

## Constraints

- **Platform**: 网页应用,单人使用 — 无需复杂登录/权限,聚焦数据维护与概览。
- **Currency**: 本位币固定为 USD — 所有金额折算成美元做汇总统计。
- **Dependencies**: 依赖外部实时汇率 API — 需考虑 API 不可用时的降级(缓存上次汇率 / 手动兜底)。
- **Security**: 不存储子账号密码等敏感凭据 — 仅保留邮箱/登录名,降低泄露风险。

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 单人网页应用,不做多人/权限 | 定位为个人内部记账工具,降低复杂度 | — Pending |
| 数据层级:一空间→一母账号→多子账号 | 贴合真实开通结构,母账号是开通者 | — Pending |
| 子账号只记邮箱/登录名,不存凭据 | 规避明文凭据存储的安全风险 | — Pending |
| 支付渠道用可手动维护的枚举 | 渠道会变化,交由用户维护更灵活 | — Pending |
| 到期 = 开通时间 + 所选订阅周期(自动算) | 减少手填错误,周期可选 | — Pending |
| 本位币 USD + 自动抓取实时汇率折算 | 跨国多币种需统一口径做成本汇总 | — Pending |
| 续费提醒 v1 仅做仪表盘高亮 | 单人工具进入即看,无需邮件/IM 推送 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-27 after initialization*
