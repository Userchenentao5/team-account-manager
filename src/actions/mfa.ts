"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { db } from "@/db";
import {
  confirmMfaEnrollment,
  disableMfa as disableStoredMfa,
  startMfaEnrollment,
} from "@/db/mfa";
import {
  AUTH_COOKIE_NAME,
  verifyLoginKey,
  verifySessionToken,
} from "@/lib/auth";

type MfaActionResult = { ok: true } | { ok: false; error: string };

export async function beginMfaEnrollment(): Promise<
  | {
      ok: true;
      enrollment: { qrCodeDataUrl: string; manualKey: string };
    }
  | { ok: false; error: string }
> {
  if (!(await hasAuthenticatedSession())) return unauthorized();

  try {
    const enrollment = startMfaEnrollment(db, {
      issuer: process.env.APP_MFA_ISSUER?.trim() || "Team Account Manager",
      accountName: process.env.APP_MFA_ACCOUNT_NAME?.trim() || "admin",
    });
    const qrCodeDataUrl = await QRCode.toDataURL(enrollment.uri, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 224,
    });

    return {
      ok: true,
      enrollment: { qrCodeDataUrl, manualKey: enrollment.secret },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.message.includes("already enabled")
          ? "MFA 已经启用。"
          : "无法创建 Authenticator 绑定，请检查安全密钥配置。",
    };
  }
}

export async function enableMfa(code: string): Promise<MfaActionResult> {
  if (!(await hasAuthenticatedSession())) return unauthorized();

  try {
    if (!confirmMfaEnrollment(db, code)) {
      return { ok: false, error: "安全码无效或绑定已过期，请重新扫码。" };
    }
    revalidatePath("/settings");
    return { ok: true };
  } catch {
    return { ok: false, error: "无法启用 MFA，请检查安全密钥配置。" };
  }
}

export async function disableMfa(loginKey: string): Promise<MfaActionResult> {
  if (!(await hasAuthenticatedSession())) return unauthorized();

  try {
    if (!(await verifyLoginKey(loginKey))) {
      return { ok: false, error: "访问密钥不正确。" };
    }
    disableStoredMfa(db);
    revalidatePath("/settings");
    return { ok: true };
  } catch {
    return { ok: false, error: "无法关闭 MFA，请检查登录密钥配置。" };
  }
}

async function hasAuthenticatedSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}

function unauthorized(): { ok: false; error: string } {
  return { ok: false, error: "登录状态已失效，请重新登录。" };
}
