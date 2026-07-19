"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { getMfaStatus, verifyMfaLoginCode } from "@/db/mfa";
import {
  AUTH_COOKIE_NAME,
  createMfaChallengeToken,
  createSessionToken,
  MFA_CHALLENGE_COOKIE_NAME,
  MFA_CHALLENGE_MAX_AGE_SECONDS,
  SESSION_MAX_AGE_SECONDS,
  shouldUseSecureSessionCookie,
  verifyLoginKey,
  verifyMfaChallengeToken,
} from "@/lib/auth";
import {
  getLoginRateLimitStatus,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/login-rate-limit";

export type LoginResult =
  | { ok: true; mfaRequired: true }
  | { ok: false; error: "config" | "invalid" | "locked" | "expired" };

export async function login(formData: FormData): Promise<LoginResult> {
  const clientId = clientIdentifier(await headers());
  if (!getLoginRateLimitStatus(clientId).ok) return loginError("locked");

  const key = formData.get("key");
  if (typeof key !== "string" || key.length === 0) {
    return failedLogin(clientId);
  }

  try {
    if (!(await verifyLoginKey(key))) return failedLogin(clientId);

    if (getMfaStatus(db).enabled) {
      const cookieStore = await cookies();
      cookieStore.set(
        MFA_CHALLENGE_COOKIE_NAME,
        await createMfaChallengeToken(),
        cookieOptions(MFA_CHALLENGE_MAX_AGE_SECONDS),
      );
      return { ok: true, mfaRequired: true };
    }
  } catch {
    return loginError("config");
  }

  return finishLogin(clientId);
}

export async function loginWithMfa(code: string): Promise<LoginResult> {
  const clientId = clientIdentifier(await headers());
  if (!getLoginRateLimitStatus(clientId).ok) return loginError("locked");

  const cookieStore = await cookies();
  try {
    if (
      !(await verifyMfaChallengeToken(
        cookieStore.get(MFA_CHALLENGE_COOKIE_NAME)?.value,
      ))
    ) {
      return loginError("expired");
    }
    if (!verifyMfaLoginCode(db, code)) return failedLogin(clientId);
  } catch {
    return loginError("config");
  }

  cookieStore.delete(MFA_CHALLENGE_COOKIE_NAME);
  return finishLogin(clientId);
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  cookieStore.delete(MFA_CHALLENGE_COOKIE_NAME);
  redirect("/login");
}

function clientIdentifier(headerStore: { get(name: string): string | null }) {
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwardedFor ||
    headerStore.get("x-real-ip") ||
    headerStore.get("cf-connecting-ip") ||
    "local"
  );
}

async function failedLogin(clientId: string): Promise<LoginResult> {
  const status = recordLoginFailure(clientId);
  await new Promise((resolve) => setTimeout(resolve, 450));
  return loginError(status.ok ? "invalid" : "locked");
}

function loginError(
  error: Extract<LoginResult, { ok: false }>["error"],
): LoginResult {
  return { ok: false, error };
}

async function finishLogin(clientId: string): Promise<never> {
  recordLoginSuccess(clientId);
  const cookieStore = await cookies();
  cookieStore.set(
    AUTH_COOKIE_NAME,
    await createSessionToken(),
    cookieOptions(SESSION_MAX_AGE_SECONDS),
  );
  redirect("/");
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: shouldUseSecureSessionCookie(
      process.env.NODE_ENV,
      process.env.APP_ALLOW_INSECURE_COOKIES,
    ),
  };
}
