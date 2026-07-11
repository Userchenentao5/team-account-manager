---
status: complete
quick_task: 260711-jr0
---

# ECS deployment hardening

## Completed

- Added PR validation, deploy serialization, job timeouts, production Environment tracking, and a reusable strict SSH configuration.
- Made remote validation and deployment fail-fast with Bash, secure `.env.production` mode checks, Compose validation, delayed rsync updates, and deployed-revision recording.
- Added an unauthenticated `/api/health` endpoint for container and public deployment checks.
- Moved CI and Docker to Node 24.18.0, the current LTS release.

## Verification

- `npm run lint`
- `npm test` — 22 files, 135 tests passed
- `npm run build`
- Local `next start` health probe returned HTTP 200

## Deferred

Atomic releases with automatic rollback and a build-once image registry need a separate deployment architecture and database-migration rollback policy.
