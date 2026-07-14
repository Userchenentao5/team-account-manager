---
phase: 05
slug: dashboard-overview
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-14
---

# Phase 05 - Security

> Retroactive ASVS L1 verification of the Phase 05 dashboard threat register.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| SQLite to dashboard DTO | Stored space, account, cost, and expiry rows become read-only aggregates. | Operational financial and account metadata |
| Dashboard DTO to browser | Approved aggregates render in the authenticated dashboard. | Costs, receivables, counts, names, and risk status |
| Dashboard links to space routes | Read-only dashboard links enter existing protected detail routes. | Space identifiers |
| Package manager | Dashboard visuals reuse installed UI primitives. | Dependency graph |

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-01-TAMPER | Tampering | `getDashboardOverview` totals | medium | mitigate | Space payments and rented-account revenue are accumulated separately in `src/db/dashboard.ts`; query tests verify exact totals and ordering. | closed |
| T-05-01-INFO | Information Disclosure | Dashboard DTO fields | medium | mitigate | Dashboard DTOs expose approved operational fields only and contain no password, session, token, or secret fields. | closed |
| T-05-01-DOS | Denial of Service | Empty or partial data sets | low | mitigate | Aggregate helpers return stable zero totals and empty arrays; the empty-dashboard test verifies the contract. | closed |
| T-05-01-SC | Tampering | npm installs | low | accept | No dependency or lockfile changes were made for the dashboard work. | closed |
| T-05-02-INFO | Information Disclosure | Dashboard components | medium | mitigate | Components render approved names, costs, receivables, counts, statuses, and links only. | closed |
| T-05-02-TAMPER | Tampering | Root dashboard route | low | mitigate | The dashboard remains a read-only Server Component with links only and no forms, mutation actions, edit, or delete controls. | closed |
| T-05-02-DOS | Denial of Service | Responsive dashboard content | low | mitigate | The space performance list caps output at five rows and collapses amounts into a mobile three-column layout without horizontal overflow. | closed |
| T-05-02-SC | Tampering | npm installs | low | accept | Existing shadcn/Radix and Next.js primitives are reused; no chart or UI dependency was added. | closed |
| T-05-03-TAMPER | Tampering | Final dashboard totals and source gates | medium | mitigate | Full Vitest coverage, TypeScript, ESLint, and production build passed against the final implementation. | closed |
| T-05-03-INFO | Information Disclosure | Browser dashboard | medium | mitigate | Browser verification showed only approved operational and converted currency values; no credential or local-path fields render. | closed |
| T-05-03-DOS | Denial of Service | Dashboard responsive layout | low | mitigate | Browser checks at desktop and mobile sizes found no card or page horizontal overflow; production build passed. | closed |
| T-05-03-SC | Tampering | npm installs | low | accept | Final package diff is empty. | closed |

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-01-SC, T-05-02-SC, T-05-03-SC | The phase intentionally reuses the existing audited dependency set and introduces no package changes. | Phase 05 plan | 2026-07-14 |

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-14 | 12 | 12 | 0 | Codex security audit |

## Sign-Off

- [x] All threats have a disposition
- [x] Accepted risks documented
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-14
