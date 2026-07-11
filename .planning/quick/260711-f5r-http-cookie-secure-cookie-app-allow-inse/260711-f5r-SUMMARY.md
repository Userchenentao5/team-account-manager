# HTTP Cookie Fallback Summary

## Completed

- Added `shouldUseSecureSessionCookie(nodeEnv, allowInsecureCookies)` as a pure auth helper.
- Kept production session cookies Secure unless `APP_ALLOW_INSECURE_COOKIES` is exactly `true`.
- Added focused coverage for development, standard production, and opted-in production.

## Verification

- `npm test -- src/lib/auth.test.ts` — 4 passed
- `npm run lint` — passed
- `npm test` — 22 files, 135 tests passed
- `npm run build` — passed
- `git diff --check` — passed

## Deployment Follow-up

Add `APP_ALLOW_INSECURE_COOKIES=true` to the ECS-only `.env.production` before deploying. Remove it when HTTPS is available.
