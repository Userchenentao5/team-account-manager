import { afterEach, describe, expect, it } from "vitest";
import {
  buildAuthenticatorUri,
  decryptMfaSecret,
  encryptMfaSecret,
  findMatchingTotpCounter,
  generateMfaSecret,
  generateTotp,
} from "@/lib/mfa";

const originalEnv = { ...process.env };
const RFC_6238_SHA1_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("TOTP MFA", () => {
  it.each([
    [59, "94287082"],
    [1_111_111_109, "07081804"],
    [1_111_111_111, "14050471"],
    [1_234_567_890, "89005924"],
    [2_000_000_000, "69279037"],
    [20_000_000_000, "65353130"],
  ])("matches the RFC 6238 SHA-1 vector at %i seconds", (seconds, expected) => {
    expect(
      generateTotp(RFC_6238_SHA1_SECRET, {
        timestamp: seconds * 1000,
        digits: 8,
      }),
    ).toBe(expected);
  });

  it("accepts a short clock window and returns the matched counter", () => {
    const code = generateTotp(RFC_6238_SHA1_SECRET, { timestamp: 60_000 });

    expect(
      findMatchingTotpCounter(RFC_6238_SHA1_SECRET, code, {
        timestamp: 90_000,
      }),
    ).toBe(2);
    expect(
      findMatchingTotpCounter(RFC_6238_SHA1_SECRET, "12345", {
        timestamp: 90_000,
      }),
    ).toBeNull();
  });

  it("encrypts MFA secrets at rest and detects tampering", () => {
    process.env.APP_AUTH_SECRET = "test-auth-secret";
    const secret = generateMfaSecret();
    const encrypted = encryptMfaSecret(secret);

    expect(encrypted).not.toContain(secret);
    expect(decryptMfaSecret(encrypted)).toBe(secret);
    expect(() => decryptMfaSecret(`${encrypted}x`)).toThrow();
  });

  it("creates a standards-compatible authenticator URI", () => {
    const uri = buildAuthenticatorUri({
      secret: RFC_6238_SHA1_SECRET,
      issuer: "Team Account Manager",
      accountName: "admin@example.com",
    });

    expect(uri).toContain("otpauth://totp/Team%20Account%20Manager:admin%40example.com?");
    expect(uri).toContain(`secret=${RFC_6238_SHA1_SECRET}`);
    expect(uri).toContain("issuer=Team+Account+Manager");
    expect(uri).toContain("algorithm=SHA1");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });
});
