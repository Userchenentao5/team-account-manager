# ECS layout migration summary

## Delivered

- `compose.yaml` accepts `APP_CONTEXT`, defaulting to the repository root for local Compose use.
- The deploy workflow synchronizes source to `/data/team-account-manager/app/`, preserves root `data/` and `.env.production`, and copies the root Compose file separately.
- ECS builds with `APP_CONTEXT=./app`; old root source is deleted only after Compose health and a `/login` probe succeed.
- Cleanup uses a fixed, guarded list and then asserts the deployment root contains only `app`, `data`, `compose.yaml`, and `.env.production`.

## Verification

- `npm ci`
- `npm run lint`
- `npm test` — 22 files, 134 tests passed
- `npm run build`
- `git diff --check`

Local Docker is unavailable, so `docker compose config` will run in GitHub Actions/ECS during the next deployment.
