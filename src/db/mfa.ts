import { eq, inArray } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { appSetting } from "./schema";
import {
  buildAuthenticatorUri,
  decryptMfaSecret,
  encryptMfaSecret,
  findMatchingTotpCounter,
  generateMfaSecret,
} from "@/lib/mfa";

type Db = BetterSQLite3Database<Record<string, unknown>>;

const MFA_ENABLED_KEY = "auth.mfa.enabled";
const MFA_SECRET_KEY = "auth.mfa.secret";
const MFA_LAST_COUNTER_KEY = "auth.mfa.lastCounter";
const MFA_PENDING_SECRET_KEY = "auth.mfa.pendingSecret";
const MFA_PENDING_EXPIRES_AT_KEY = "auth.mfa.pendingExpiresAt";
const MFA_ENROLLMENT_TTL_MS = 10 * 60 * 1000;

export type MfaStatus = { enabled: boolean };

export function getMfaStatus(db: Db): MfaStatus {
  return { enabled: getSetting(db, MFA_ENABLED_KEY) === "true" };
}

export function startMfaEnrollment(
  db: Db,
  options: { issuer: string; accountName: string; now?: number },
): { secret: string; uri: string } {
  if (getMfaStatus(db).enabled) throw new Error("MFA is already enabled");

  const secret = generateMfaSecret();
  const now = options.now ?? Date.now();
  setSetting(db, MFA_PENDING_SECRET_KEY, encryptMfaSecret(secret));
  setSetting(db, MFA_PENDING_EXPIRES_AT_KEY, String(now + MFA_ENROLLMENT_TTL_MS));

  return {
    secret,
    uri: buildAuthenticatorUri({
      secret,
      issuer: options.issuer,
      accountName: options.accountName,
    }),
  };
}

export function confirmMfaEnrollment(
  db: Db,
  code: string,
  now = Date.now(),
): boolean {
  const encryptedSecret = getSetting(db, MFA_PENDING_SECRET_KEY);
  const expiresAt = Number(getSetting(db, MFA_PENDING_EXPIRES_AT_KEY));
  if (!encryptedSecret || !Number.isSafeInteger(expiresAt) || expiresAt <= now) {
    clearPendingEnrollment(db);
    return false;
  }

  const secret = decryptMfaSecret(encryptedSecret);
  const counter = findMatchingTotpCounter(secret, code, { timestamp: now });
  if (counter === null) return false;

  db.transaction((tx) => {
    setSetting(tx, MFA_SECRET_KEY, encryptedSecret);
    setSetting(tx, MFA_LAST_COUNTER_KEY, String(counter));
    setSetting(tx, MFA_ENABLED_KEY, "true");
    tx.delete(appSetting)
      .where(inArray(appSetting.key, pendingKeys))
      .run();
  });
  return true;
}

export function verifyMfaLoginCode(
  db: Db,
  code: string,
  now = Date.now(),
): boolean {
  if (!getMfaStatus(db).enabled) return true;

  const encryptedSecret = getSetting(db, MFA_SECRET_KEY);
  if (!encryptedSecret) throw new Error("MFA secret is not configured");
  const secret = decryptMfaSecret(encryptedSecret);
  const counter = findMatchingTotpCounter(secret, code, { timestamp: now });
  if (counter === null) return false;

  return db.transaction((tx) => {
    const lastCounter = Number(getSetting(tx, MFA_LAST_COUNTER_KEY) ?? "-1");
    if (!Number.isSafeInteger(lastCounter) || counter <= lastCounter) return false;
    setSetting(tx, MFA_LAST_COUNTER_KEY, String(counter));
    return true;
  });
}

export function disableMfa(db: Db): void {
  db.delete(appSetting)
    .where(
      inArray(appSetting.key, [
        MFA_ENABLED_KEY,
        MFA_SECRET_KEY,
        MFA_LAST_COUNTER_KEY,
        ...pendingKeys,
      ]),
    )
    .run();
}

function clearPendingEnrollment(db: Db): void {
  db.delete(appSetting).where(inArray(appSetting.key, pendingKeys)).run();
}

const pendingKeys = [
  MFA_PENDING_SECRET_KEY,
  MFA_PENDING_EXPIRES_AT_KEY,
] as const;

function getSetting(db: Db, key: string): string | undefined {
  return db
    .select({ value: appSetting.value })
    .from(appSetting)
    .where(eq(appSetting.key, key))
    .get()?.value;
}

function setSetting(db: Db, key: string, value: string): void {
  db.insert(appSetting)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSetting.key, set: { value } })
    .run();
}
