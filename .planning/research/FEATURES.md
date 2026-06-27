# Feature Research

**Domain:** Single-user internal subscription / asset-tracking tool (AI-subscription "space" manager)
**Researched:** 2026-06-27
**Confidence:** MEDIUM (strong domain knowledge of subscription/expense/license trackers; no live source fetch available this session — web search + Brave seam unavailable, no API keys)

> Note on sourcing: Live web search was unavailable in this environment. Findings below are synthesized from well-established conventions across consumer subscription trackers (Subby, Bobby, TrackMySubs, Subscripto), expense trackers, and IT asset/license managers (Snipe-IT, AssetTiger), cross-checked against the scope in `PROJECT.md`. Treat the *categorization* as HIGH confidence (it is anchored to the documented requirements) and the *competitor specifics* as MEDIUM confidence.

## Feature Landscape

### Table Stakes (Users Expect These)

Features the tool must have or it fails its Core Value ("一眼看清哪些空间快到期需要续费 + USD 总成本概览"). Most map directly to `PROJECT.md` Active requirements; a few are implicit prerequisites not yet listed there.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Space CRUD | The central entity; without it there is nothing to track | LOW | Standard create/view/edit/delete. Maps to req "空间的增删改查" |
| Space core fields (country, payment channel, original amount + currency, opening/payment time, subscription period) | These are the accounting facts being recorded | LOW | Form + validation. Maps to req "空间字段" |
| Mother account record (1:1 per space) | Identifies who opened the space; structural to the domain | LOW | Single embedded record on the space. Maps to req "母账号" |
| Child account CRUD (type codex/chatgpt + email/login) | A space's value is the seats it holds | LOW–MEDIUM | One-to-many under space; type enum + email/login only (no credentials). Maps to req "子账号管理" |
| Payment-channel enum maintenance (add/remove) | Channels change; user wants to curate them | LOW | Reference-data CRUD screen. Maps to req "支付渠道枚举" |
| Auto expiry calculation (opening time + period) | Reduces manual error; core to renewal awareness | LOW | Pure date math (month/quarter/year). Maps to req "到期自动计算" |
| Multi-currency capture + USD conversion via auto-fetched rates | Cross-country spend must be normalized to one base (USD) | MEDIUM | External rate API + conversion logic. Maps to req "多币种与汇率" |
| Exchange-rate caching + manual fallback | Rate API will sometimes be down; data must still render | MEDIUM | Implicit from Constraints ("API 不可用时降级"). Cache last good rate; allow manual override. **Not yet an explicit req — recommend adding** |
| Dashboard · expiry reminders (highlight expiring / expired) | The #1 reason the user opens the app | LOW–MEDIUM | Color/badge highlight; depends on expiry calc. Maps to req "仪表盘·到期提醒" |
| Dashboard · total spend in USD | Half of the Core Value | LOW | Sum of converted amounts. Maps to req "仪表盘·总支出" |
| Dashboard · spend distribution (by country / currency / channel) | Standard "where does the money go" view | LOW–MEDIUM | Grouping + simple chart/table. Maps to req "仪表盘·支出分布" |
| Dashboard · counts (spaces, child accounts) | At-a-glance inventory | LOW | Simple aggregates. Maps to req "仪表盘·数量统计" |
| Data persistence | A tracker that loses data is useless | LOW | DB of choice; single-user means no concurrency concerns |
| Space list with sort + basic filter/search | Once there are >10 spaces, scanning becomes painful | LOW–MEDIUM | Sort by expiry is especially valuable. **Implicit prerequisite — recommend adding** |
| Basic input validation | Bad dates/amounts corrupt every downstream calc | LOW | Required-field + numeric/date validation |

### Differentiators (Competitive Advantage / Polish)

Not required to launch, but they make the tool genuinely pleasant and accounting-accurate. Prioritize ones that reinforce the Core Value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Rate snapshot at payment time | Accounting accuracy: lock the FX rate actually used when paid, not today's live rate | MEDIUM | Store the rate + converted amount at record time; live rate only for "current value" views. **Strong recommendation** — avoids totals silently shifting as FX moves |
| Tiered expiry status (e.g. expired / ≤7d / ≤30d / OK) | Sharper "what needs action now" signal than a single highlight | LOW | Pure derived state from expiry date |
| Monthly-equivalent (normalized) cost | Compare a yearly space vs a monthly one fairly; better spend insight | LOW–MEDIUM | Normalize period to monthly run-rate |
| Renew action + renewal history log | One click rolls opening date forward and records a payment event; builds a spend timeline | MEDIUM | Turns the tool into a light ledger; enables trend view |
| Spend trend over time | See cost growth month over month | MEDIUM | Depends on renewal/payment history |
| CSV / Excel export | Hand data to real accounting or back it up | LOW | Single export endpoint |
| Cost per child account / per-seat cost | "Am I getting value per seat?" insight | LOW | amount ÷ child-account count |
| Per-space notes / tags | Capture context (purpose, who uses it) | LOW | Free-text field |
| Dashboard quick-glance card layout + responsive UI | Single-user tool lives or dies on "open and instantly understand" | MEDIUM | Aligns with Core Value of one-glance clarity |
| Manual rate override per record | When the API rate is wrong or missing, user can still record reality | LOW | Pairs with rate fallback |
| Bulk renew / bulk edit | Less tedium when many spaces renew together | MEDIUM | Defer until scale demands it |

### Anti-Features (Deliberately Avoid)

These are commonly built into subscription/expense tools but are wrong for *this* single-user internal tool. The first five are already Out-of-Scope in `PROJECT.md` — re-listed here to prevent re-adding.

| Feature | Why It Gets Requested | Why Problematic Here | Alternative |
|---------|-----------------------|----------------------|-------------|
| Multi-user login / roles / permissions | "Maybe a teammate needs access later" | Explicitly single-user; auth adds large surface for zero current value | Keep it single-user; revisit only if a real second user appears (Out of Scope) |
| Email / IM (WeChat, Telegram) renewal push | "I might miss the dashboard" | Notification infra, scheduling, deliverability — heavy for v1 | v1 dashboard highlight only; user opens the app (Out of Scope) |
| Child-account password / credential storage | "Store everything in one place" | Plaintext-credential leak risk; explicitly forbidden | Store email/login only (Out of Scope, Security) |
| Online payment / auto-billing | "Renew straight from the app" | Payment-provider integration, PCI concerns; it only *records* paid facts | Record payments after the fact (Out of Scope) |
| Customer / reseller / revenue management | "Track who I resell to" | This is internal bookkeeping, not an external resale business | Stay internal-only (Out of Scope) |
| Auto-detection via bank/email parsing | Consumer apps (Rocket Money) do this | Privacy-invasive, fragile parsing, massive integration for a manual-entry tool | Manual entry — user already knows their spaces |
| Real-time / streaming FX rates | "Always perfectly current" | Sub-daily precision is meaningless for subscription accounting | Daily (or on-demand) fetch + cache; snapshot at payment time |
| Approval workflows / audit trails | Enterprise asset-manager habit | No second person to approve; pure overhead | Skip entirely for single user |
| Native mobile apps | "Use it on my phone" | Doubles platform cost | Responsive web is enough |
| Configurable custom fields / schema builder | "Future flexibility" | Over-engineering; the schema is well-known and stable | Fixed schema; extend with code if needed |

## Feature Dependencies

```
Space core fields
    └──requires──> Payment-channel enum (channel field references it)
    └──requires──> Currency list (amount has a currency)

Auto expiry calculation
    └──requires──> Space core fields (opening time + period)
        └──enables──> Dashboard · expiry reminders
        └──enables──> Tiered expiry status (differentiator)

Multi-currency → USD conversion
    └──requires──> External rate API + Rate caching/fallback
        └──enables──> Dashboard · total spend (USD)
        └──enables──> Dashboard · spend distribution
        └──enhanced-by──> Rate snapshot at payment time (differentiator)

Child account CRUD
    └──requires──> Space (parent must exist first)
        └──enables──> Dashboard · counts
        └──enables──> Cost per child account (differentiator)

Renew action + renewal history (differentiator)
    └──requires──> Auto expiry calculation
        └──enables──> Spend trend over time (differentiator)

Space list with sort/filter
    └──enhances──> Dashboard · expiry reminders (sort by expiry)
```

### Dependency Notes

- **Space core fields require Payment-channel enum:** the channel field is a foreign reference into user-maintained reference data, so the enum-maintenance screen (or at least a seed list) must exist before spaces can be created cleanly.
- **Dashboard widgets require expiry calc + currency conversion:** all four dashboard widgets are *derived* views — they cannot be built before their underlying calculations land. This forces dashboard into a later phase than data entry.
- **Rate caching/fallback is a hard prerequisite, not polish:** Constraints explicitly call out API-down degradation. If conversion has no fallback, the entire dashboard breaks whenever the API hiccups.
- **Rate snapshot at payment time enhances conversion:** without it, recalculating all historical totals with today's rate makes "total spend" drift over time — undesirable for accounting. Treat as a near-table-stakes differentiator.
- **Renewal history enables trend:** spend-over-time only exists if renewals are logged as events rather than overwriting the opening date.

## MVP Definition

### Launch With (v1) — equals the documented Active requirements

- [ ] Space CRUD — central entity, nothing works without it
- [ ] Space core fields (country, channel, amount+currency, opening time, period) — the recorded facts
- [ ] Mother account (1:1) — structural to the domain
- [ ] Child account CRUD (codex/chatgpt + email/login) — the seats being tracked
- [ ] Payment-channel enum maintenance — prerequisite reference data
- [ ] Auto expiry calculation — feeds the #1 use case
- [ ] Multi-currency capture + USD conversion (with caching + manual fallback) — feeds total/distribution
- [ ] Dashboard: expiry reminders, total spend, spend distribution, counts — the Core Value payoff
- [ ] Space list with sort-by-expiry + basic filter — needed once >10 spaces exist (recommend adding to scope)

### Add After Validation (v1.x)

- [ ] Rate snapshot at payment time — add as soon as FX drift on historical totals is noticed (strongly recommended early)
- [ ] Tiered expiry status (≤7d / ≤30d) — when single highlight feels too coarse
- [ ] Monthly-equivalent cost + CSV export — when user starts doing real spend analysis
- [ ] Renew action + renewal history — when manually editing opening dates each cycle becomes tedious
- [ ] Per-space notes/tags, cost-per-seat — when inventory grows and context is lost

### Future Consideration (v2+)

- [ ] Spend trend over time — defer until renewal history has accumulated enough data to be meaningful
- [ ] Bulk renew / bulk edit — defer until space count makes one-by-one painful
- [ ] (Reconsider only if scope changes) email/IM reminders — currently Out of Scope by decision

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Space CRUD + core fields | HIGH | LOW | P1 |
| Mother + child account CRUD | HIGH | LOW | P1 |
| Payment-channel enum maintenance | MEDIUM | LOW | P1 |
| Auto expiry calculation | HIGH | LOW | P1 |
| Multi-currency → USD + caching/fallback | HIGH | MEDIUM | P1 |
| Dashboard (4 widgets) | HIGH | MEDIUM | P1 |
| Space list sort/filter | MEDIUM | LOW | P1 |
| Rate snapshot at payment time | HIGH | MEDIUM | P2 |
| Tiered expiry status | MEDIUM | LOW | P2 |
| CSV export | MEDIUM | LOW | P2 |
| Renew action + history | MEDIUM | MEDIUM | P2 |
| Monthly-equivalent cost | MEDIUM | LOW | P2 |
| Spend trend over time | MEDIUM | MEDIUM | P3 |
| Bulk operations | LOW | MEDIUM | P3 |
| Notes / tags | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch (≈ Active requirements)
- P2: Should have, add soon after validation
- P3: Nice to have, future

## Competitor Feature Analysis

| Feature | Consumer subscription trackers (Subby/Bobby/TrackMySubs) | IT asset/license managers (Snipe-IT) | Our Approach |
|---------|----------------------------------------------------------|--------------------------------------|--------------|
| Renewal reminders | Push/email notifications + in-app badges | License-expiry alerts via email | Dashboard highlight only (v1); no push (Out of Scope) |
| Multi-currency | Common; convert to one home currency | Often single-currency or manual | Auto-fetch rates → USD, with caching + payment-time snapshot |
| Cost overview / analytics | Monthly/yearly spend, category breakdown | Spend by asset/category, depreciation | Total USD spend + distribution by country/currency/channel |
| Hierarchy / nesting | Flat list of subscriptions | Asset → license → seat assignment | Space → 1 mother → N child accounts |
| Credential storage | Usually none (or vault opt-in) | Sometimes stores access info | Explicitly none — email/login only |
| Auto-detection (bank/email) | Premium feature in some apps | N/A | Deliberately omitted — manual entry |
| Multi-user | Some team tiers | Yes, RBAC | Single-user only (Out of Scope) |

## Sources

- Domain conventions: consumer subscription trackers (Subby, Bobby, TrackMySubs, Subscripto) and IT asset/license managers (Snipe-IT, AssetTiger) — recalled, not freshly fetched this session (MEDIUM confidence on specifics).
- Primary anchor: `D:\projects\team-account-manager\.planning\PROJECT.md` (Active requirements, Out of Scope, Constraints, Key Decisions) — HIGH confidence.

---
*Feature research for: single-user internal AI-subscription space manager*
*Researched: 2026-06-27*
