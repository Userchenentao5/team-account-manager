export const LOGIN_RATE_LIMIT_MAX_FAILURES = 5;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_RATE_LIMIT_LOCK_MS = 15 * 60 * 1000;

type AttemptState = {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
};

type RateLimitStatus =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

const attempts = new Map<string, AttemptState>();

function retryAfter(lockedUntil: number, now: number): RateLimitStatus {
  return {
    ok: false,
    retryAfterSeconds: Math.max(1, Math.ceil((lockedUntil - now) / 1000)),
  };
}

function currentState(identifier: string, now: number): AttemptState | null {
  const state = attempts.get(identifier);
  if (!state) return null;

  if (state.lockedUntil > now) return state;
  if (now - state.firstFailureAt <= LOGIN_RATE_LIMIT_WINDOW_MS) return state;

  attempts.delete(identifier);
  return null;
}

export function getLoginRateLimitStatus(
  identifier: string,
  now = Date.now(),
): RateLimitStatus {
  const state = currentState(identifier, now);
  if (!state || state.lockedUntil <= now) return { ok: true };

  return retryAfter(state.lockedUntil, now);
}

export function recordLoginFailure(
  identifier: string,
  now = Date.now(),
): RateLimitStatus {
  const state = currentState(identifier, now) ?? {
    failures: 0,
    firstFailureAt: now,
    lockedUntil: 0,
  };

  state.failures += 1;
  if (state.failures >= LOGIN_RATE_LIMIT_MAX_FAILURES) {
    state.lockedUntil = now + LOGIN_RATE_LIMIT_LOCK_MS;
  }

  attempts.set(identifier, state);
  return getLoginRateLimitStatus(identifier, now);
}

export function recordLoginSuccess(identifier: string): void {
  attempts.delete(identifier);
}

export function resetLoginRateLimitForTest(): void {
  attempts.clear();
}
