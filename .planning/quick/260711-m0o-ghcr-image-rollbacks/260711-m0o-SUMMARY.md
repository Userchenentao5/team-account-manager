---
status: complete
quick_task: 260711-m0o
---

# GHCR image deployment and rollback

## Completed

- CI publishes a single immutable GHCR image tagged by commit SHA and deploys its digest.
- ECS receives only a candidate Compose file, pulls the digest with an ephemeral private-registry login, and never builds application source.
- The deployment script snapshots SQLite with `better-sqlite3`, restores the prior image and snapshot if candidate startup fails, and keeps five database snapshots.

## Verification

- Git Bash `bash -n scripts/deploy-production.sh`
- `git diff --check`
- `npm run lint`
- `npm test` — 22 files, 135 tests passed
- `npm run build`

## User setup required before push

Create the `production` Environment secret `GHCR_READ_TOKEN` using a classic GitHub PAT with only `read:packages`.
