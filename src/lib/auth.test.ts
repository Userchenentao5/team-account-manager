import { afterEach, describe, expect, it } from "vitest";
import {
  createSessionToken,
  hashLoginKey,
  shouldUseSecureSessionCookie,
  verifyLoginKey,
  verifySessionToken,
} from "@/lib/auth";
import {
  LOGIN_RATE_LIMIT_LOCK_MS,
  LOGIN_RATE_LIMIT_MAX_FAILURES,
  getLoginRateLimitStatus,
  recordLoginFailure,
  recordLoginSuccess,
  resetLoginRateLimitForTest,
} from "@/lib/login-rate-limit";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  resetLoginRateLimitForTest();
});

describe("auth", () => {
  it("uses Secure session cookies unless production explicitly opts out", () => {
    expect(shouldUseSecureSessionCookie("development", undefined)).toBe(false);
    expect(shouldUseSecureSessionCookie("production", undefined)).toBe(true);
    expect(shouldUseSecureSessionCookie("production", "true")).toBe(false);
  });

  it("verifies login keys by hash", async () => {
    process.env.APP_LOGIN_KEY_HASH = await hashLoginKey("local-secret");

    await expect(verifyLoginKey("local-secret")).resolves.toBe(true);
    await expect(verifyLoginKey("wrong-secret")).resolves.toBe(false);
  });

  it("rejects expired or tampered session tokens", async () => {
    process.env.APP_AUTH_SECRET = "test-signing-secret";

    const token = await createSessionToken(1_000);

    await expect(verifySessionToken(token, 2_000)).resolves.toBe(true);
    await expect(verifySessionToken(token, 60 * 60 * 24 * 8 * 1_000)).resolves.toBe(
      false,
    );
    await expect(verifySessionToken(`${token}x`, 2_000)).resolves.toBe(false);
  });

  it("locks repeated failed login attempts and clears them after success", () => {
    const client = "203.0.113.7";

    for (let index = 1; index < LOGIN_RATE_LIMIT_MAX_FAILURES; index += 1) {
      expect(recordLoginFailure(client, 1_000)).toEqual({ ok: true });
    }

    expect(recordLoginFailure(client, 1_000)).toEqual({
      ok: false,
      retryAfterSeconds: LOGIN_RATE_LIMIT_LOCK_MS / 1000,
    });
    expect(getLoginRateLimitStatus(client, 2_000).ok).toBe(false);

    recordLoginSuccess(client);
    expect(getLoginRateLimitStatus(client, 2_000)).toEqual({ ok: true });
  });
});
