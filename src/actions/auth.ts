"use server";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  AUTH_COOKIE_NAME,
  createSessionToken,
  SESSION_MAX_AGE_SECONDS,
  shouldUseSecureSessionCookie,
  verifyLoginKey,
} from "@/lib/auth";
import {
  getLoginRateLimitStatus,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/login-rate-limit";
import { db } from "@/db";
import { verifyMfaLoginCode } from "@/db/mfa";

function loginRedirect(error: "config" | "invalid" | "locked"): never {
  redirect(`/login?error=${error}`);
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

export async function login(formData: FormData): Promise<void> {
  const clientId = clientIdentifier(await headers());
  if (!getLoginRateLimitStatus(clientId).ok) {
    loginRedirect("locked");
  }

  const key = formData.get("key");
  const mfaCode = formData.get("mfaCode");
  if (typeof key !== "string" || key.length === 0) {
    recordLoginFailure(clientId);
    loginRedirect("invalid");
  }

  let ok = false;
  try {
    ok =
      (await verifyLoginKey(key)) &&
      verifyMfaLoginCode(db, typeof mfaCode === "string" ? mfaCode : "");
  } catch {
    loginRedirect("config");
  }

  if (!ok) {
    const status = recordLoginFailure(clientId);
    await new Promise((resolve) => setTimeout(resolve, 450));
    if (!status.ok) loginRedirect("locked");
    loginRedirect("invalid");
  }

  recordLoginSuccess(clientId);

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, await createSessionToken(), {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(
      process.env.NODE_ENV,
      process.env.APP_ALLOW_INSECURE_COOKIES,
    ),
  });
  redirect("/");
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  redirect("/login");
}
