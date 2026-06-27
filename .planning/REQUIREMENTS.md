# Requirements: 团队空间管理系统 (team-account-manager)

**Defined:** 2026-06-27
**Core Value:** 一眼看清哪些空间快到期需要续费,并掌握折算成统一本位币 (USD) 的总成本概览。

## v1 Requirements

初始版本需求,每条映射到路线图阶段。

### 空间管理 (SPACE)

- [ ] **SPACE-01**: 用户可以创建空间,填写归属国家、支付渠道、原始金额+币种、开通(支付)时间、订阅周期
- [ ] **SPACE-02**: 用户可以查看空间列表,支持按到期时间排序、按国家/支付渠道筛选
- [ ] **SPACE-03**: 用户可以查看单个空间详情(含母账号、子账号、到期日、USD 折算金额)
- [ ] **SPACE-04**: 用户可以编辑空间信息
- [ ] **SPACE-05**: 用户可以删除空间,并级联删除其下母账号与子账号

### 账号管理 (ACCT)

- [ ] **ACCT-01**: 每个空间一对一记录一个母账号(开通者邮箱/登录名)
- [ ] **ACCT-02**: 用户可以在空间下新增子账号,选择类型(codex / chatgpt)并填写邮箱/登录名
- [ ] **ACCT-03**: 用户可以编辑和删除子账号

### 参考数据 (REF)

- [x] **REF-01**: 用户可以手动维护支付渠道枚举(新增/编辑/删除),引用基于稳定 id;删除被占用的渠道时受保护(软删除或阻止)
- [x] **REF-02**: 系统提供币种列表供创建/编辑空间时选择

### 汇率折算 (FX)

- [ ] **FX-01**: 系统自动从外部汇率 API 抓取汇率并缓存到本地
- [ ] **FX-02**: 创建/记录支付时,按当时汇率快照折算成 USD,并将所用汇率与 USD 金额冻结保存在该空间记录上
- [ ] **FX-03**: 汇率 API 不可用时降级使用上次缓存汇率,并标记数据陈旧

### 到期计算 (EXP)

- [ ] **EXP-01**: 系统根据 开通时间 + 所选订阅周期 自动计算到期日(日历感知,正确处理月末/闰年)

### 仪表盘 (DASH)

- [ ] **DASH-01**: 仪表盘高亮显示即将到期 / 已过期的空间
- [ ] **DASH-02**: 仪表盘显示总支出(按 USD 折算)
- [ ] **DASH-03**: 仪表盘显示按国家 / 币种 / 支付渠道的支出分布
- [ ] **DASH-04**: 仪表盘显示空间数、子账号数等数量统计

## v2 Requirements

已认可但暂缓,不在当前路线图。

### 提醒 (NOTF)

- **NOTF-01**: 到期前通过邮件提醒续费
- **NOTF-02**: 到期前通过 IM(微信/企微/Telegram)推送提醒

### 协作 (COLLAB)

- **COLLAB-01**: 多人登录与角色权限

## Out of Scope

明确排除,记录以防范围蔓延。

| Feature | Reason |
|---------|--------|
| 多人登录与权限系统 | 明确为单人工具,无需账号体系 |
| 邮件/IM 续费推送 (v1) | v1 仅仪表盘高亮即可,推送归入 v2 |
| 对外客户/代理转售管理 | 定位内部记账,非对外生意 |
| 子账号密码/凭据存储 | 仅记邮箱/登录名,规避明文凭据风险 |
| 在线支付/自动扣费 | 仅记录已发生的支付,不做实际支付 |
| 实时汇率流/历史重算 | 用支付时快照汇率即可,不做实时流 |

## Traceability

各需求由哪个阶段覆盖,路线图创建时填充。

| Requirement | Phase | Status |
|-------------|-------|--------|
| SPACE-01 | Phase 3 | Pending |
| SPACE-02 | Phase 3 | Pending |
| SPACE-03 | Phase 3 | Pending |
| SPACE-04 | Phase 3 | Pending |
| SPACE-05 | Phase 4 | Pending |
| ACCT-01 | Phase 3 | Pending |
| ACCT-02 | Phase 4 | Pending |
| ACCT-03 | Phase 4 | Pending |
| REF-01 | Phase 1 | Complete |
| REF-02 | Phase 1 | Complete |
| FX-01 | Phase 2 | Pending |
| FX-02 | Phase 3 | Pending |
| FX-03 | Phase 2 | Pending |
| EXP-01 | Phase 3 | Pending |
| DASH-01 | Phase 5 | Pending |
| DASH-02 | Phase 5 | Pending |
| DASH-03 | Phase 5 | Pending |
| DASH-04 | Phase 5 | Pending |

**Coverage:**

- v1 requirements: 18 total
- Mapped to phases: 18 ✓
- Unmapped: 0

---
*Requirements defined: 2026-06-27*
*Last updated: 2026-06-27 after roadmap creation (traceability filled)*
