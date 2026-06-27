# Phase 1: Foundations, Schema & Reference Data - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the single Next.js + SQLite application shell and lock in the full, load-bearing data schema, then let the user maintain the reference data that spaces will later depend on.

**In scope:**
- App scaffold: Next.js 16 (App Router) + React 19 + TS, Tailwind v4 + shadcn/ui, navigation shell, SQLite via Drizzle + better-sqlite3 with a runnable migration.
- Locked schema: money as integer minor units (currency-aware exponent), FX-snapshot columns reserved on the space row (`rate_used`, `rate_as_of`, `rate_source`, `amount_usd`), structured subscription period (`{unit, count}`), FK-based references (payment channel, currency).
- Reference data: payment-channel maintenance (REF-01) and a viewable currency list for later selection (REF-02).

**Out of scope (later phases):** space CRUD, mother/child accounts, expiry computation, USD conversion logic and the FX cache itself, dashboard. Country lookup *values* are defined here as a static constant but spaces consuming them is Phase 3.
</domain>

<decisions>
## Implementation Decisions

### Currency reference data (REF-02)
- **D-01:** Currencies live in a **curated, seeded `currency` table** — not the full ISO-4217 set and not derived at runtime from the FX API.
- **D-02:** Seed exactly six majors at migration time: **USD, CNY, EUR, GBP, JPY, HKD**. All six are Frankfurter-supported so every stored currency is guaranteed convertible to USD.
- **D-03:** Each currency row stores its **ISO-4217 minor-unit exponent** (JPY = 0, all others here = 2). This exponent is the authority for integer-minor-unit money math everywhere downstream.
- **D-04:** The list is **manually extensible later** (more currencies can be added), but only currencies the FX layer can convert should be added. Phase 1 only needs to *display* the list for selection — no editing UI required for currencies in this phase.

### Payment-channel reference data (REF-01)
- **D-05:** Channels are referenced by **stable surrogate id + FK** (locked project decision — never name strings).
- **D-06:** Deletion is **uniform soft-delete** via an `is_active` flag. *All* deletes archive — there is no hard-delete path, even for channels never referenced by any space. Keeps one mental model and the simplest code.
- **D-07:** Archived channels **drop out of the new-space payment-channel picker** but any space already referencing them continues to display normally (FK integrity preserved).
- **D-08:** Provide a **"show archived" affordance** in the channel maintenance UI so archived channels can be viewed and reactivated.
- **D-09:** The payment-channel table **starts empty** — no seeded channels. The user adds their own on first use.

### Country handling (schema decision, consumed in Phase 3)
- **D-10:** Country is a **fixed ISO 3166 alpha-2 picker** backed by a static constant list in code — **not** a user-maintained reference table.
- **D-11:** The space row stores the **alpha-2 code** (e.g. `US`, `CN`). Consistent codes keep the later dashboard country grouping (DASH-03) clean and avoid free-text fragmentation. No maintenance UI for countries.

### Navigation shell (Claude's discretion — confirmed direction)
- **D-12:** Standard **left-sidebar layout** with top-level sections: **Dashboard**, **Spaces**, **Reference Data** (channels + currencies). Later phases fill these in; Phase 1 delivers the working shell + Reference Data screens.

### Claude's Discretion
- Exact shadcn/ui component selection, table/dialog styling, and form wiring for the reference-data screens.
- Drizzle schema file organization and migration tooling flow (`generate` + `migrate` vs `push`) — pick per the stack guidance in CLAUDE.md.
- Naming of columns/tables beyond the locked-name FX-snapshot and period fields.
- Whether the currency table's exponent column is named `exponent`/`decimal_digits` etc.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs & decisions
- `.claude/CLAUDE.md` — Prescriptive technology stack (Next.js 16, Drizzle + better-sqlite3, Tailwind v4 + shadcn/ui, Zod 4 + RHF, date-fns, Recharts), "What NOT to Use" guardrails, and version-compatibility notes. The stack is locked here.
- `.planning/PROJECT.md` — Core value, data hierarchy (space → one mother account → many child accounts), constraints (single-user, USD base currency, no credential storage), Key Decisions table.
- `.planning/REQUIREMENTS.md` §参考数据 (REF) — REF-01 (channel maintenance, id-based, protected delete) and REF-02 (currency list). This phase's requirements.
- `.planning/ROADMAP.md` §"Phase 1" — Goal + four success criteria (working shell on migrated SQLite; channel add/rename/remove with protected delete; viewable currency list; integer-minor-unit money + reserved FX/period columns verified by migration).
- `.planning/STATE.md` §Accumulated Context — Load-bearing locked decisions (integer minor units unrecoverable if retrofitted; channel surrogate-id + FK soft-delete/block; FX snapshot must precede USD-aware spaces).

### FX dependency (context for schema, implemented Phase 2)
- `.claude/CLAUDE.md` §"Exchange-Rate Strategy" — Frankfurter (frankfurter.dev): free, no key, ~daily ECB rates. Constrains which currencies are convertible (drives D-02 seed choice).

No separate ADR files exist yet — decisions are captured in the planning docs above and in this CONTEXT.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **None — greenfield.** No `package.json` or source exists yet; the repo currently holds only `.planning/`, `.claude/`, and `.git/`. Phase 1 creates the scaffold from scratch.

### Established Patterns
- No code patterns exist. The prescriptive stack in `.claude/CLAUDE.md` is the de-facto pattern source: Server Components for reads, Server Actions for CRUD, Drizzle schema as the single source of types, integer-minor-unit money.

### Integration Points
- This phase *establishes* the integration surface: the Drizzle schema (currency, payment_channel tables + the space table's reserved money/FX/period columns) is what Phases 2–5 build against. Getting the locked columns right here is the whole point — they are expensive/impossible to retrofit.

</code_context>

<specifics>
## Specific Ideas

- Currency seed set is explicit and small (USD, CNY, EUR, GBP, JPY, HKD) — chosen for FX convertibility, not comprehensiveness.
- "Soft-delete everything" for channels is a deliberate simplicity choice — the user explicitly preferred one uniform archive path over a delete-if-unused hybrid.
- Country as ISO codes (not free text, not a maintained table) is specifically to keep the future dashboard's by-country distribution clean.

</specifics>

<deferred>
## Deferred Ideas

- **Currency editing/maintenance UI** — Phase 1 only displays currencies for selection. A full add/edit currency screen, if ever needed, is a later concern; adding rows can be done via seed/migration for now.
- **Country as a maintained reference table** — considered and rejected for now (fixed ISO picker chosen). Revisit only if free-form/custom regions are ever needed.
- Everything beyond foundations stays in its mapped phase: FX cache (Phase 2), space CRUD + expiry + USD snapshot (Phase 3), child accounts + cascade delete (Phase 4), dashboard (Phase 5).

None of these are scope creep into Phase 1 — discussion stayed within the foundations boundary.

</deferred>

---

*Phase: 1-Foundations, Schema & Reference Data*
*Context gathered: 2026-06-27*
