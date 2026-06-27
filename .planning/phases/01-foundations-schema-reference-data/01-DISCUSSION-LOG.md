# Phase 1: Foundations, Schema & Reference Data - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 1-Foundations, Schema & Reference Data
**Areas discussed:** Currency list source, Channel delete rule, Country & seeding

---

## Gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Currency list source | Where the supported-currency list comes from | ✓ |
| Channel delete rule | Soft-delete vs hard-block when referenced | ✓ |
| Navigation shell | Pages + layout of the app skeleton | |
| Country & seeding | Country storage + default seeding | ✓ |

**Notes:** Navigation shell left to Claude's discretion (left-sidebar with Dashboard / Spaces / Reference Data).

---

## Currency list source

| Option | Description | Selected |
|--------|-------------|----------|
| Curated seed list | Hand-picked majors seeded with ISO-4217 exponents; cleanest dropdown | ✓ |
| Full ISO-4217 | All ~150 currencies seeded; future-proof but long | |
| FX-API supported set | Only Frankfurter-convertible ~31 currencies | |

**User's choice:** Curated seed list.

### Currency seed set (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| 6 common majors | USD, CNY, EUR, GBP, JPY, HKD (all Frankfurter-supported) | ✓ |
| ~15 majors | Add CAD/AUD/SGD/KRW/INR etc. | |
| Let me list them | User dictates the set | |

**User's choice:** 6 common majors (USD, CNY, EUR, GBP, JPY, HKD).
**Notes:** All six are FX-convertible to USD. Exponents per ISO-4217 (JPY = 0, rest = 2). Manually extensible later.

---

## Channel delete rule

| Option | Description | Selected |
|--------|-------------|----------|
| Soft-delete / archive | Referenced channel archived (is_active=false), hidden from picker, history intact | ✓ |
| Hard-block delete | Refuse deletion while referenced; user must reassign first | |
| Delete-or-archive hybrid | Hard-delete if unused, archive if referenced | |

**User's choice:** Soft-delete / archive.

### Uniformity (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| All deletes archive | Every delete archives regardless of references; uniform model | ✓ |
| Hard-delete if unused | Truly remove unreferenced channels, archive referenced ones | |

**User's choice:** All deletes archive.
**Notes:** No hard-delete path at all. "Show archived" affordance for viewing/reactivating.

---

## Country & seeding

### Country storage

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed ISO country picker | Static ISO 3166 list, store alpha-2 code; no maintenance | ✓ |
| User-maintained list | Country as an editable reference table like channels | |
| Free text | Simplest, but inconsistent values | |

**User's choice:** Fixed ISO country picker (store alpha-2 code).
**Notes:** Chosen to keep the later DASH-03 by-country distribution clean. Not a maintained table.

### Payment-channel seeding

| Option | Description | Selected |
|--------|-------------|----------|
| Seed common channels | Pre-fill Alipay/WeChat Pay/Visa/Mastercard/PayPal | |
| Start empty | User adds their own channels | ✓ |
| Let me list them | User dictates the seed | |

**User's choice:** Start empty.
**Notes:** Currencies are seeded (6 majors); payment channels start empty.

---

## Claude's Discretion

- Navigation shell layout and pages (left-sidebar; Dashboard / Spaces / Reference Data).
- shadcn/ui component selection and form/table styling for reference-data screens.
- Drizzle schema file organization and migration flow (`generate`+`migrate` vs `push`).
- Column/table naming beyond the locked FX-snapshot and period field names.

## Deferred Ideas

- Currency editing/maintenance UI (Phase 1 only displays currencies for selection).
- Country as a maintained reference table (considered, rejected — fixed ISO picker chosen).
- FX cache, space CRUD, accounts, dashboard — all mapped to Phases 2–5.
