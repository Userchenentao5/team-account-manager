# Phase 3 Discussion Log

**Date:** 2026-06-28
**Mode:** discuss (batched for context efficiency)

## Areas Discussed

User selected all 4 gray areas to discuss.

### Area 1: FX 快照取数逻辑
- **Options presented:** 缓存优先+缺失则阻止 / 保存时强制实时拉取 / 缓存现值缺失则允许空 USD
- **Selected:** 缓存优先+缺失则阻止(推荐)
- **Notes:** 保存时调 ensureFreshRates(),读 fx_rate 缓存现值冻结;无该币种汇率则阻止保存。→ D-01, D-02, D-03

### Area 2: 母账号建模
- **Options presented:** 独立 mother_account 表 / space 行上的列
- **Selected:** 独立 mother_account 表(推荐)
- **Notes:** 1:1 FK,仅 email/登录名,为 Phase 4 级联删除铺路。→ D-04, D-05

### Area 3: 到期状态与列表呈现
- **Options presented:** ≤30天 / ≤7天 / ≤14天 即将到期阈值
- **Selected:** ≤7天=即将到期
- **Notes:** 默认按到期日升序,三态颜色标记。→ D-06, D-07

### Area 4: 日历到期算法边界
- **Options presented:** date-fns 默认月末钳制 / 自定义规则
- **Selected:** date-fns 默认月末钳制(推荐)
- **Notes:** addMonths/addQuarters/addYears,周期单位限月/季/年。→ D-08, D-09

## Deferred Ideas
- 子账号 CRUD → Phase 4
- 空间级联删除 → Phase 4(建表时为 FK 级联预留)
- 仪表盘 → Phase 5

## Claude's Discretion
- 金额输入 UI、表单校验、详情/编辑页布局、分页、可选币种来源。
