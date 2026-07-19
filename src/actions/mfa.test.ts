import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestDb } from "@/test/db-harness";

const dbHolder = vi.hoisted(() => ({ current: null as unknown as TestDb }));
const cookieHolder = vi.hoisted(() => ({ token: "" }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => ({ value: cookieHolder.token }),
  })),
}));
vi.mock("@/db", () => ({
  get db() {
    return dbHolder.current;
  },
}));

import { disableMfa } from "@/actions/mfa";
import {
  confirmMfaEnrollment,
  getMfaStatus,
  startMfaEnrollment,
} from "@/db/mfa";
import { createSessionToken, hashLoginKey } from "@/lib/auth";
import { generateTotp } from "@/lib/mfa";
import { createTestDb } from "@/test/db-harness";

const originalEnv = { ...process.env };

describe("MFA server actions", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(async () => {
    process.env.APP_AUTH_SECRET = "test-auth-secret";
    process.env.APP_LOGIN_KEY_HASH = await hashLoginKey("local-secret");
    ctx = createTestDb();
    dbHolder.current = ctx.db;
    cookieHolder.token = await createSessionToken();

    const enrollment = startMfaEnrollment(ctx.db, {
      issuer: "Team Account Manager",
      accountName: "admin",
      now: 59_000,
    });
    const code = generateTotp(enrollment.secret, { timestamp: 59_000 });
    confirmMfaEnrollment(ctx.db, code, 59_000);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    ctx.sqlite.close();
  });

  it("requires the login key before disabling MFA", async () => {
    await expect(disableMfa("wrong-secret")).resolves.toEqual({
      ok: false,
      error: "访问密钥不正确。",
    });
    expect(getMfaStatus(ctx.db)).toEqual({ enabled: true });

    await expect(disableMfa("local-secret")).resolves.toEqual({ ok: true });
    expect(getMfaStatus(ctx.db)).toEqual({ enabled: false });
  });
});
