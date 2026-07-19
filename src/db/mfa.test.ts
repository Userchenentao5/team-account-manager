import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  confirmMfaEnrollment,
  disableMfa,
  getMfaStatus,
  startMfaEnrollment,
  verifyMfaLoginCode,
} from "@/db/mfa";
import { generateTotp } from "@/lib/mfa";
import { createTestDb } from "@/test/db-harness";

const originalEnv = { ...process.env };

describe("MFA settings", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    process.env.APP_AUTH_SECRET = "test-auth-secret";
    ctx = createTestDb();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    ctx.sqlite.close();
  });

  it("requires a valid enrollment code before enabling MFA", () => {
    const enrollment = startMfaEnrollment(ctx.db, {
      issuer: "Team Account Manager",
      accountName: "admin",
      now: 59_000,
    });

    expect(getMfaStatus(ctx.db)).toEqual({ enabled: false });
    expect(confirmMfaEnrollment(ctx.db, "000000", 59_000)).toBe(false);

    const code = generateTotp(enrollment.secret, { timestamp: 59_000 });
    expect(confirmMfaEnrollment(ctx.db, code, 59_000)).toBe(true);
    expect(getMfaStatus(ctx.db)).toEqual({ enabled: true });
  });

  it("rejects replayed login codes and accepts the next time step", () => {
    const enrollment = startMfaEnrollment(ctx.db, {
      issuer: "Team Account Manager",
      accountName: "admin",
      now: 59_000,
    });
    const enrollmentCode = generateTotp(enrollment.secret, { timestamp: 59_000 });
    expect(confirmMfaEnrollment(ctx.db, enrollmentCode, 59_000)).toBe(true);

    expect(verifyMfaLoginCode(ctx.db, enrollmentCode, 59_000)).toBe(false);
    const nextCode = generateTotp(enrollment.secret, { timestamp: 90_000 });
    expect(verifyMfaLoginCode(ctx.db, nextCode, 90_000)).toBe(true);
    expect(verifyMfaLoginCode(ctx.db, nextCode, 90_000)).toBe(false);
  });

  it("removes stored MFA settings when disabled", () => {
    const enrollment = startMfaEnrollment(ctx.db, {
      issuer: "Team Account Manager",
      accountName: "admin",
      now: 59_000,
    });
    const enrollmentCode = generateTotp(enrollment.secret, { timestamp: 59_000 });
    expect(confirmMfaEnrollment(ctx.db, enrollmentCode, 59_000)).toBe(true);

    disableMfa(ctx.db);
    expect(getMfaStatus(ctx.db)).toEqual({ enabled: false });
    expect(verifyMfaLoginCode(ctx.db, "", 90_000)).toBe(true);
  });

  it("expires an unconfirmed enrollment", () => {
    const enrollment = startMfaEnrollment(ctx.db, {
      issuer: "Team Account Manager",
      accountName: "admin",
      now: 0,
    });
    const code = generateTotp(enrollment.secret, { timestamp: 11 * 60 * 1000 });

    expect(confirmMfaEnrollment(ctx.db, code, 11 * 60 * 1000)).toBe(false);
    expect(getMfaStatus(ctx.db)).toEqual({ enabled: false });
  });
});
