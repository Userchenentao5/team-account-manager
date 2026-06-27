# Pitfalls Research

**Domain:** Single-user multi-currency subscription / expense & asset-tracking web app (team AI-subscription "spaces"); base currency fixed to USD; live exchange-rate API; auto-computed expiry dates; user-maintained payment-channel enum.
**Researched:** 2026-06-27
**Confidence:** HIGH (money/date/enum pitfalls are well-established engineering knowledge; exchange-rate API specifics verified against provider docs — see Sources)

> Scope note: This is an **internal record-keeping / accounting tool**, not a billing engine. That framing decides several pitfalls below — most importantly, recorded payments are *historical facts* and must be stored as immutable snapshots, not recomputed against live data.

---

## Critical Pitfalls

### Pitfall 1: Using floating-point (`float`/`double`/JS `number`) for money

**What goes wrong:**
`0.1 + 0.2 !== 0.3`. Amounts drift by fractions of a cent, totals don't reconcile, and the same query returns `19.999999998` instead of `20.00`. Once stored as float, the error is baked into the data and is unrecoverable without the original input.

**Why it happens:**
JavaScript/JSON only has IEEE-754 doubles, so it's the path of least resistance. SQLite (a likely DB here) has no native decimal type and happily stores `REAL`. Developers assume "it's only a few subscriptions, precision won't matter" — then dashboard totals across dozens of spaces and currencies accumulate visible error.

**How to avoid:**
- Store money as **integer minor units** (cents) — e.g. `amount_minor INTEGER` plus `currency CHAR(3)`. `$19.99` → `1999`. This is the simplest robust choice and serializes cleanly to JSON.
- **Watch the minor-unit exponent per currency** — not every currency is 2 decimals. JPY/KRW are 0-decimal (no cents), BHD/KWD/JOD are 3-decimal. Hard-coding `× 100` corrupts these. Use ISO 4217 minor-unit data (or a money library) to know the exponent per currency.
- If you prefer human-readable storage, use a decimal type / arbitrary-precision decimal library (`decimal.js`, `dinero.js`, `big.js`) and never let a value pass through a native float.
- Keep the FX-conversion result in a defined precision and round **once, explicitly, at the boundary** (see Pitfall 7).

**Warning signs:**
Column types of `REAL`/`FLOAT`/`DOUBLE` for amounts; `parseFloat` on a price; `× 100` constants assuming 2 decimals; totals that end in long decimal tails; unit tests using `toBe(0.3)`.

**Phase to address:** Data-model / schema phase (foundational — extremely expensive to retrofit). Verify before any money is persisted.

---

### Pitfall 2: Recomputing historical payments against the *live* exchange rate (snapshot vs live) — **the key decision**

**What goes wrong:**
A space was paid in EUR last March; the app shows its USD cost by multiplying the EUR amount by *today's* rate every time the dashboard loads. The recorded "cost" of a past, already-settled payment silently changes day to day. Totals are non-reproducible, two screenshots taken a week apart disagree, and the number never matches what was actually paid.

**Why it happens:**
It's easier to store only `(amount, currency)` and convert on read using the one rate table you already fetch. The historical-accuracy requirement isn't obvious until someone asks "why did last month's total change?"

**How to avoid — DIRECT ANSWER to the gate question:**
**Past/recorded payments must use the rate snapshotted at payment time, NOT the current rate.** A payment is a historical fact; its USD value is fixed the moment it happened.

Concretely, at the time a payment/space is recorded, persist a **conversion snapshot**:
- `amount_minor` + `currency` (the original, authoritative input — never lose this)
- `fx_rate_used` (decimal, with enough precision, e.g. 6–8 dp)
- `fx_rate_base` (= `USD`) and `fx_rate_as_of` (timestamp/date of the rate)
- `fx_rate_source` (e.g. `openexchangerates`, or `manual` if hand-entered)
- `amount_usd_minor` (the computed converted value, stored)

Then dashboard totals just **sum the stored `amount_usd_minor`** — fast, reproducible, and immune to API drift or outages. The original amount + rate + timestamp lets you recompute or audit later.

Use **live/current rates only** for genuinely forward-looking, clearly-labeled views (e.g. "estimated cost to renew today at current rates"). Keep that visually distinct from the historical ledger so the two are never confused.

**Warning signs:**
Schema stores only `amount` + `currency` with no rate columns; conversion happens in a render/template helper; "total spend" changes when nothing was edited; no `fx_rate_as_of` anywhere.

**Phase to address:** Data-model phase (schema must include snapshot columns) + the payment/space create-edit flow. This is the single most important pitfall for an accounting tool — flag it explicitly in the roadmap.

---

### Pitfall 3: Treating the exchange-rate API as an always-available hard dependency

**What goes wrong:**
The API is rate-limited, down, slow, or the key expired. With no fallback, creating/editing a space throws, the dashboard won't render, or — worse — conversion silently writes `0` / `NULL` USD values that pollute totals. The Core Value ("USD total cost overview") breaks entirely on a third-party outage.

**Why it happens:**
Happy-path development against a live API; failure modes (429, 5xx, timeout, network error, malformed payload, missing currency code) aren't exercised. The PROJECT constraints explicitly call out degradation but it's easy to defer.

**How to avoid:**
- **Cache the last-known rate table** locally with its `as_of` timestamp; serve from cache when the API fails. (This is *separate* from the per-payment snapshot in Pitfall 2.)
- **Decouple fetching from rendering.** Refresh rates on a schedule/background or on explicit user action — never block a page render or a save on a live API call. exchangerate-api.com free tier updates only **once per day** and allows **~1,500 requests/month** — fetching per page view both wastes quota and risks hitting limits (see Sources).
- **Always provide a manual override / manual rate entry** so a payment can be recorded even with the API fully unavailable (set `fx_rate_source = manual`). PROJECT already lists "缓存上次汇率 / 手动兜底" — make it a first-class path, not an afterthought.
- Handle every failure explicitly: timeout, non-200, unknown currency, and **surface staleness in the UI** ("rates as of <date>") rather than silently using old numbers.
- Never write a `0`/`NULL` USD value on conversion failure — block the save with a clear message, or record the original amount and mark the conversion as pending.

**Warning signs:**
A `fetch` to the FX provider inside a request/render handler; no cache table; no "rates as of" label; no manual-rate input; conversion code with no catch branch; demo only ever tested online.

**Phase to address:** Currency/FX integration phase — design the cache + fallback + manual-override together with the first conversion, not later.

---

### Pitfall 4: Ignoring the free-tier base-currency restriction and update cadence

**What goes wrong:**
Code is written assuming you can request rates with an arbitrary base, then the chosen provider's free tier locks the base to USD — or the app fetches far more often than the free plan's daily update / monthly quota allows, getting throttled (429) in production.

**Why it happens:**
Provider tiers differ and the limits are in the fine print. openexchangerates.org **free plan locks the base currency to USD** (changing base is paid-only). exchangerate-api.com free allows a chosen base but **updates once/day, ~1,500 req/month**. (Both verified — see Sources.)

**How to avoid:**
- **Good news for this project:** the base currency is **fixed to USD**, which lines up perfectly with USD-locked free tiers (e.g. openexchangerates.org). You only ever need USD-based rates, so the common free-tier restriction is a non-issue *here* — pick a provider knowing this.
- Do conversion math as `usd_amount = foreign_amount / rate[foreign_currency]` when the table is USD-based (i.e. `rate[X]` = X per 1 USD). Get the direction right and unit-test it with a known pair (e.g. 100 EUR at 1 USD = 0.92 EUR → ~108.70 USD).
- Cache one daily fetch of the full USD rate table; never fetch per-currency-per-page.
- Abstract the provider behind a small interface so it can be swapped without touching call sites.

**Warning signs:**
Conversion direction untested; assumption that base can be any currency; per-currency API calls; request volume that scales with page views or number of spaces.

**Phase to address:** FX integration phase — provider selection + conversion-direction tests.

---

### Pitfall 5: Naive date math for expiry — month-end overflow and period arithmetic

**What goes wrong:**
"开通时间 + 周期" computed by adding 30 days for "1 month" or by naive month increment. A space activated **Jan 31 + 1 month** lands on an invalid Feb 31 → libraries variously clamp to Feb 28/29 or roll into March; "+30 days" drifts the renewal date earlier every month. Yearly subscriptions started Feb 29 (leap day) have no Feb 29 in non-leap years. Expiry dates end up wrong, so the core "is this expiring soon?" alert misfires.

**Why it happens:**
Developers reach for millisecond arithmetic (`date + n*86400000`) because it's easy, or assume month addition is unambiguous. It isn't — calendar arithmetic is genuinely subtle.

**How to avoid:**
- Use a real date library's **calendar-aware add** (`date-fns` `add({months})`, Luxon `plus({months})`, or `Temporal`), not millisecond math. These apply the standard end-of-month clamping rule (Jan 31 + 1mo → Feb 28/29).
- **Decide and document the clamping policy** for month-end and leap-day cases, and make it consistent (clamp-to-last-day is the conventional billing choice). Add explicit tests: Jan 31 +1mo, Feb 29 +1yr, Dec 31 +1mo (year rollover).
- Store the **subscription period as structured data** (unit + count, e.g. `{unit: 'month', count: 3}`), not as a free-typed day count, so expiry is always recomputable from `start + period`.
- Compute expiry deterministically and **store it**, but keep it derivable so editing the start date or period recomputes correctly.

**Warning signs:**
`* 86400000` / `* 30` in date code; expiry stored but not recomputed on edit; renewal dates that creep; no leap-year/month-end tests; "1 month" implemented as 30 days.

**Phase to address:** Space data-model + expiry-calculation phase.

---

### Pitfall 6: Timezone confusion in expiry / "expiring soon" comparisons

**What goes wrong:**
Expiry stored as a UTC timestamp but compared against local "today," or vice versa — so a space shows "expired" a day early/late, or the "expiring within 7 days" highlight flips around midnight depending on the server's vs the browser's timezone. For a single-user tool the bug is subtle but erodes trust in the one feature that matters most.

**Why it happens:**
Mixing `Date` objects (which carry time + zone) with what is conceptually a **calendar date** (the day a subscription lapses). Storing `new Date()` for an activation that's really "a day," and comparing instants instead of days.

**How to avoid:**
- Treat activation date and expiry as **plain calendar dates** (`YYYY-MM-DD`), not instants, since subscriptions lapse on a day, not a millisecond. Store and compare as dates.
- Pick **one timezone for "today"** and document it (single-user → the user's local zone is the natural choice). Compute "days until expiry" by comparing calendar dates in that zone, not by subtracting timestamps and dividing by 86,400,000 (which breaks across DST transitions — some days aren't 24h).
- Define the expiring-soon thresholds explicitly (e.g. expired = `expiry < today`; soon = `0 ≤ days_until ≤ N`) and unit-test the boundary days.

**Warning signs:**
`expiry` stored as full ISO timestamp with `Z`; "days left" via timestamp subtraction; off-by-one expiry reports; behavior that changes at midnight or across DST.

**Phase to address:** Expiry-calculation + dashboard alert phase.

---

### Pitfall 7: Rounding errors in cross-currency dashboard aggregation

**What goes wrong:**
Totals are computed by rounding each conversion to cents and summing — or by summing first and rounding once — and the two approaches disagree; sub-distributions (by country / currency / channel) don't add up to the grand total; percentages don't sum to 100%. The "总支出" headline number is subtly wrong or internally inconsistent.

**Why it happens:**
No defined rounding strategy. Rounding applied inconsistently between the detail view and the aggregate view. Floating-point creeping in (Pitfall 1) compounds across many rows.

**How to avoid:**
- With the **snapshot approach (Pitfall 2)**, each payment already has a stored `amount_usd_minor` (integer). Aggregation is then exact integer addition — no per-render rounding, and detail rows always reconcile to the total. This is the cleanest fix and another reason to snapshot.
- Define **one rounding rule** (round-half-up or banker's rounding) applied at exactly one boundary: when computing `amount_usd_minor` at payment time. Document it.
- For "% of spend" distributions, compute against the same stored integer totals; if displayed percentages must sum to 100, use a largest-remainder apportionment rather than independent rounding.
- Don't mix currencies in a sum without converting — a total is only meaningful in USD (the base).

**Warning signs:**
Conversion-and-rounding logic duplicated in multiple views; sub-totals that don't equal the total; percentages summing to 99% or 101%; rounding done in the UI layer.

**Phase to address:** Dashboard / aggregation phase (and depends on the Pitfall 2 snapshot decision).

---

### Pitfall 8: Editable payment-channel enum breaking referential integrity on delete/rename

**What goes wrong:**
The user deletes or renames a payment channel (e.g. "Visa ****1234") that existing spaces reference. Hard delete → spaces point to a now-missing channel: dashboard "spend by channel" shows blanks/crashes, or a foreign-key error blocks the delete confusingly. Rename done by deleting+recreating → historical spaces lose their channel attribution and the by-channel distribution silently shifts.

**Why it happens:**
Treating user-maintained reference data like free, disposable lookup rows. PROJECT explicitly wants the user to add/remove channels freely, which makes this *the* likely real-world failure. The integrity implications of deleting an in-use value are easy to overlook.

**How to avoid:**
- Store channels as **rows with a stable surrogate id**; spaces reference the **id**, never the display string. Renaming a channel then just updates its `name` and every historical space follows correctly — no re-attribution loss.
- On **delete**, don't hard-delete an in-use channel. Either:
  - **Block** with a clear message ("3 spaces use this channel — reassign them first"), and/or
  - **Soft-delete** (`is_active = false` / `archived_at`): the channel disappears from the "add new" picker but historical references and the by-channel breakdown stay intact.
- Enforce the reference with a real **foreign key** so orphaning is impossible at the DB level; pair it with the soft-delete UX so the FK never blocks the user mysteriously.
- Guard against **duplicate/whitespace-variant names** ("PayPal" vs "paypal " vs "Pay Pal") with normalization + a uniqueness rule, or the by-channel distribution fragments.

**Warning signs:**
Spaces store the channel as a text string; no FK between space and channel; a delete button that hard-deletes lookup rows; by-channel chart with empty/"undefined" buckets; duplicate-looking channels in the picker.

**Phase to address:** Reference-data (payment-channel) management phase + space schema. Decide soft-delete vs block-delete up front.

---

### Pitfall 9: Cascade behavior for Space → Mother account → Child accounts on delete

**What goes wrong:**
Deleting a space leaves orphaned child (codex/chatgpt) account rows and a dangling mother-account record, inflating counts ("子账号数") and breaking joins; or an unguarded cascade deletes more than the user expected with no confirmation.

**Why it happens:**
The 1-space → 1-mother → many-children hierarchy needs an explicit delete policy that's easy to skip in CRUD scaffolding.

**How to avoid:**
- Define and enforce cascade rules: deleting a space should cascade to its mother + child accounts (FK `ON DELETE CASCADE` or app-level transaction), inside **one transaction** so a partial failure doesn't orphan rows.
- Require an explicit **confirmation** that states what will be removed (e.g. "this deletes the space, its mother account, and 5 child accounts").
- Recompute count statistics from live joins, not a denormalized counter that can drift.

**Warning signs:**
Child/mother counts that don't match actual rows; orphan rows after deletes; delete without confirmation; counts stored as standalone columns.

**Phase to address:** Core CRUD / data-model phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store amount as float / SQLite REAL | Less type wrangling | Unrecoverable precision drift in every total | **Never** |
| Store only `(amount, currency)`, convert with live rate on read | Smaller schema, one rate source | Non-reproducible history, totals change daily, breaks on API outage | **Never** for recorded payments; OK only for explicitly-labeled "current estimate" views |
| Fetch FX rate inside page render / on save | Always "fresh" | Burns free-tier quota, 429s, page won't load when API is down | Never — refresh on schedule/cache |
| No manual rate fallback | Faster to ship FX | Can't record a payment during any API outage | Never (PROJECT requires fallback) |
| Add `n*30` days for "1 month" | Trivial date math | Renewal dates drift; month-end/leap bugs | Never — use calendar add |
| Hard-delete payment channels | Simple delete button | Orphaned references, broken by-channel chart, lost history | Only if zero spaces reference it (then it's effectively unused) |
| Reference channel by name string | Easy to display | Rename loses history; duplicates fragment reporting | Never — reference by id |
| Denormalized count columns for dashboard | Fast read | Drift vs reality | OK with a single source-of-truth recompute; prefer live joins at this scale |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Exchange-rate API (free tier) | Assuming arbitrary base currency / unlimited calls | USD base is fixed here — fits USD-locked free tiers (openexchangerates); cache one daily fetch; respect ~1.5k/mo + once-daily update limits |
| Exchange-rate API | Conversion direction wrong (multiply vs divide by USD-based rate) | Unit-test with a known pair; with USD-based table, `usd = foreign / rate[foreign]` |
| Exchange-rate API | No handling of unknown/unsupported currency code | Validate currency against the fetched table; block with clear error |
| Exchange-rate API | Silent `0`/`NULL` USD on fetch failure | Never write 0; use cached rate or manual override, label staleness |
| Date/period | Millisecond arithmetic across DST / month boundaries | Calendar-aware library add; compare calendar dates, not instants |

## Performance Traps

*(Single-user internal tool — true scale concerns are minimal; the "traps" here are about quota and correctness, not throughput.)*

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| FX fetch per page view / per space | Slow dashboard, 429 errors | Cache one daily USD rate table; convert from cache | As soon as page views × spaces exceed ~1.5k/month free quota |
| Recompute all conversions on every dashboard load | Dashboard slows as spaces grow; numbers shift | Store `amount_usd_minor` snapshot; sum stored integers | Tens of spaces with live reconversion |
| N+1 queries across space→mother→children for counts | Sluggish dashboard | Aggregate with grouped queries/joins | Dozens of spaces — minor at this scale but trivially avoidable |

## Security Mistakes

*(General web-app security still applies; these are the domain-specific ones. Note PROJECT deliberately excludes credential storage.)*

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing child-account passwords/credentials | Plaintext credential leak (explicitly out of scope) | Store only email/login name per PROJECT constraint; never add a password field |
| Hardcoding the FX API key in client-side code | Key theft, quota abuse | Keep the key server-side; proxy the FX request through the backend |
| Logging full account emails / financial data verbosely | Sensitive data in logs | Minimize logging of PII and amounts; scrub on error reporting |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing USD totals without indicating rate staleness | User trusts a number computed from week-old rates | Label "rates as of <date>"; flag stale rates |
| "Expiring soon" with no clear threshold / timezone | User misses a renewal or sees false alarms | Explicit, documented thresholds; compute in user's local day |
| Confusing historical cost with current-estimate cost | User can't tell what was actually paid vs today's value | Separate, clearly-labeled views; historical = snapshot, estimate = live |
| Deleting an in-use payment channel with no warning | Silent loss of by-channel attribution | Block or soft-delete with a "N spaces use this" message |
| Editing original amount without re-snapshotting rate | Stored USD value silently inconsistent with new amount | Re-run conversion (and re-snapshot rate or keep original `as_of`) on edit, with clear behavior |

## "Looks Done But Isn't" Checklist

- [ ] **Money storage:** Often missing non-2-decimal currency handling — verify JPY (0dp) and a 3dp currency round-trip correctly.
- [ ] **Conversion:** Often missing the snapshot — verify a past payment's USD value does **not** change after rates update.
- [ ] **FX API:** Often missing failure handling — verify create/save works with the API blocked (cache + manual override).
- [ ] **FX direction:** Often wrong — verify a known pair converts to the expected USD amount.
- [ ] **Expiry:** Often missing month-end/leap cases — verify Jan 31 +1mo and Feb 29 +1yr.
- [ ] **Expiry timezone:** Often off-by-one — verify "days until expiry" at the midnight boundary in the user's zone.
- [ ] **Channel delete:** Often missing integrity guard — verify deleting an in-use channel is blocked or soft-deleted, not orphaning.
- [ ] **Channel rename:** Verify historical spaces keep correct attribution after a rename (id-based reference).
- [ ] **Dashboard reconciliation:** Verify sub-totals (by country/currency/channel) sum exactly to the grand total.
- [ ] **Cascade delete:** Verify deleting a space removes its mother + child accounts with no orphans, in one transaction.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Money stored as float | HIGH | Migrate to integer minor units; original inputs may be unrecoverable if already corrupted — re-enter from source records |
| Only `(amount,currency)` stored, no rate snapshot | HIGH | Backfill `fx_rate_used`/`as_of` from historical rates where obtainable (paid API/history); otherwise approximate and flag uncertain rows |
| Hard-deleted in-use channels | MEDIUM | Restore from backup or re-create channels and manually reattach affected spaces |
| Channel referenced by string, rename lost history | MEDIUM | Introduce id-based reference; reconcile by matching old names; add soft-delete |
| Wrong conversion direction shipped | LOW | Fix formula, recompute snapshots from stored original amount + rate |
| Naive date math (drifted expiry) | LOW | Recompute expiry from stored start date + structured period using calendar add |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Float money math | Data-model / schema | Schema uses integer minor units; multi-decimal-currency round-trip test passes |
| Live-rate recompute of history (snapshot) | Data-model + payment flow | Past payment USD value unchanged after a rate refresh |
| FX API as hard dependency | FX integration | App records a payment with API blocked (cache + manual override) |
| Free-tier base/limit restriction | FX integration | One cached daily fetch; conversion-direction unit test green |
| Naive date/period math | Expiry-calculation | Jan 31 +1mo, Feb 29 +1yr, year-rollover tests pass |
| Expiry timezone off-by-one | Expiry + dashboard alerts | Boundary-day "days until" test in user's zone |
| Aggregation rounding | Dashboard / aggregation | Sub-totals reconcile to grand total; integer sums |
| Channel enum integrity | Reference-data management | In-use channel delete blocked/soft-deleted; rename preserves attribution |
| Cascade delete orphans | Core CRUD | No orphan child/mother rows after space delete; single transaction |

## Sources

- openexchangerates.org FAQ — **free plan locks base currency to USD** (base change is paid-only); confirmed historical data exists (paid). [HIGH — official provider docs] https://openexchangerates.org/faq
- exchangerate-api.com free docs — free tier **updates once per day, ~1,500 requests/month**, base currency selectable, API key required. [HIGH — official provider docs] https://www.exchangerate-api.com/docs/free
- Established engineering knowledge (Martin Fowler "Money" pattern; ISO 4217 minor-unit exponents incl. 0-decimal JPY/KRW and 3-decimal BHD/KWD; IEEE-754 float-for-money anti-pattern; calendar end-of-month clamping in date-fns/Luxon/Temporal; soft-delete vs FK referential-integrity patterns for editable lookup data). [HIGH — widely documented]

---
*Pitfalls research for: single-user multi-currency subscription / asset-tracking web app (USD base, live FX, auto expiry, editable payment-channel enum)*
*Researched: 2026-06-27*
