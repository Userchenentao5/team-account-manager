export const AUTH_COOKIE_NAME = "tam_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export const MFA_CHALLENGE_COOKIE_NAME = "tam_mfa_challenge";
export const MFA_CHALLENGE_MAX_AGE_SECONDS = 5 * 60;

export function shouldUseSecureSessionCookie(
  nodeEnv: string | undefined,
  allowInsecureCookies: string | undefined,
): boolean {
  return nodeEnv === "production" && allowInsecureCookies !== "true";
}

const encoder = new TextEncoder();

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return diff === 0;
}

async function sha256(value: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function hmac(value: string): Promise<string> {
  const secret = process.env.APP_AUTH_SECRET;
  if (!secret) throw new Error("APP_AUTH_SECRET is not configured");

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function hashLoginKey(value: string): Promise<string> {
  return sha256(value);
}

export async function verifyLoginKey(value: string): Promise<boolean> {
  const expectedHash = process.env.APP_LOGIN_KEY_HASH?.trim().toLowerCase();
  if (!expectedHash) throw new Error("APP_LOGIN_KEY_HASH is not configured");

  return constantTimeEqual(await hashLoginKey(value), expectedHash);
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `v1.${expiresAt}.${crypto.randomUUID()}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return false;

  const expiresAt = Number(parts[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;

  const payload = parts.slice(0, 3).join(".");
  return constantTimeEqual(await hmac(payload), parts[3]);
}

export async function createMfaChallengeToken(now = Date.now()): Promise<string> {
  const expiresAt = now + MFA_CHALLENGE_MAX_AGE_SECONDS * 1000;
  const payload = `v1.mfa.${expiresAt}.${crypto.randomUUID()}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function verifyMfaChallengeToken(
  token: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== "v1" || parts[1] !== "mfa") {
    return false;
  }

  const expiresAt = Number(parts[2]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;

  const payload = parts.slice(0, 4).join(".");
  return constantTimeEqual(await hmac(payload), parts[4]);
}
