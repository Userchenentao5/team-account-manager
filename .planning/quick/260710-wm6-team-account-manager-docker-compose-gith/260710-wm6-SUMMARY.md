---
quick: 260710-wm6
title: Docker Compose and GitHub Actions deployment to ECS
status: complete
---

## Delivered

- Added a Node 25.5.0 Docker build that runs committed Drizzle migrations before starting Next.js.
- Added Compose with persistent `./data:/app/data`, loopback-only port `127.0.0.1:3000`, and a `/login` healthcheck.
- Added main-branch CI and SSH deployment to `8.153.38.90:22` using `ECS_SSH_USER`, `ECS_SSH_PRIVATE_KEY`, and manually verified `ECS_SSH_KNOWN_HOSTS` secrets.

## Verification

- `npm run lint`
- `npm test`
- `npm run build`
- Docker validation not run locally because Docker is not installed.

## Required ECS setup

- Install Docker Compose v2 and rsync; create `/data/team-account-manager/data` and server-only `/data/team-account-manager/.env.production`.
- Set the three GitHub Actions secrets before pushing to `main`.
