# Quick Task 260708-x2b: Child Account Email Reminders

Date: 2026-07-08

## Goal

Add same-day reminder emails for non-self child accounts using `nextPaymentDate`.

## Scope

- Add child account reminder settings on `/settings`.
- Require the user's own recipient email when child-account reminders are enabled.
- Allow one optional subscription reminder email per child account.
- Send due-day reminders to the user's own recipient and, when configured, to the matching child account subscription recipient.
- Keep reminder sending idempotent per child account, due date, and recipient email.

## Verification

- `npx tsc --noEmit`
- `npx vitest run src/lib/reminders/child-account-payment-reminder-job.test.ts`
- `npm run lint`
- Browser check on `http://localhost:3000/settings`
- `npm test`
- `npm run build`
- `graphify update .`
