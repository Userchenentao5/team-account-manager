import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestDb } from "@/test/db-harness";

const dbHolder = vi.hoisted(() => ({ current: null as unknown as TestDb }));
const cookieHolder = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const value = cookieHolder.get(name);
      return value ? { value } : undefined;
    },
    set: (name: string, value: string) => cookieHolder.set(name, value),
    delete: (name: string) => cookieHolder.delete(name),
  })),
  headers: vi.fn(async () => ({ get: () => "203.0.113.10" })),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));
vi.mock("@/db", () => ({
  get db() {
    return dbHolder.current;
  },
}));

import { login, loginWithMfa } from "@/actions/auth";
import { confirmMfaEnrollment, startMfaEnrollment } from "@/db/mfa";
import {
  AUTH_COOKIE_NAME,
  MFA_CHALLENGE_COOKIE_NAME,
  hashLoginKey,
} from "@/lib/auth";
import { resetLoginRateLimitForTest } from "@/lib/login-rate-limit";
import { generateTotp } from "@/lib/mfa";
import { createTestDb } from "@/test/db-harness";

const originalEnv = { ...process.env };

describe("login MFA flow", () => {
  let ctx: ReturnType<typeof createTestDb>;
  let loginCode: string;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(59_000);
    process.env.APP_AUTH_SECRET = "test-auth-secret";
    process.env.APP_LOGIN_KEY_HASH = await hashLoginKey("local-secret");
    ctx = createTestDb();
    dbHolder.current = ctx.db;
    cookieHolder.clear();
    resetLoginRateLimitForTest();

    const enrollment = startMfaEnrollment(ctx.db, {
      issuer: "Team Account Manager",
      accountName: "admin",
      now: 59_000,
    });
    confirmMfaEnrollment(
      ctx.db,
      generateTotp(enrollment.secret, { timestamp: 59_000 }),
      59_000,
    );
    vi.setSystemTime(90_000);
    loginCode = generateTotp(enrollment.secret, { timestamp: 90_000 });
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...originalEnv };
    resetLoginRateLimitForTest();
    ctx.sqlite.close();
  });

  it("opens an MFA challenge after the key and creates a session after the code", async () => {
    const formData = new FormData();
    formData.set("key", "local-secret");

    await expect(login(formData)).resolves.toEqual({
      ok: true,
      mfaRequired: true,
    });
    expect(cookieHolder.has(MFA_CHALLENGE_COOKIE_NAME)).toBe(true);
    expect(cookieHolder.has(AUTH_COOKIE_NAME)).toBe(false);

    await expect(loginWithMfa(loginCode)).rejects.toThrow("NEXT_REDIRECT:/");
    expect(cookieHolder.has(MFA_CHALLENGE_COOKIE_NAME)).toBe(false);
    expect(cookieHolder.has(AUTH_COOKIE_NAME)).toBe(true);
  });
});
