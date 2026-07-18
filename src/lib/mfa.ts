import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_SECONDS = 30;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const MFA_CIPHER_CONTEXT = "team-account-manager:mfa:v1";

export function generateMfaSecret(): string {
  return base32Encode(randomBytes(20));
}

export function buildAuthenticatorUri(input: {
  secret: string;
  issuer: string;
  accountName: string;
}): string {
  const label = `${encodeURIComponent(input.issuer)}:${encodeURIComponent(input.accountName)}`;
  const params = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });

  return `otpauth://totp/${label}?${params.toString()}`;
}

export function generateTotp(
  secret: string,
  options: { timestamp?: number; digits?: number } = {},
): string {
  const timestamp = options.timestamp ?? Date.now();
  const digits = options.digits ?? TOTP_DIGITS;
  const counter = Math.floor(timestamp / 1000 / TOTP_PERIOD_SECONDS);
  return generateHotp(secret, counter, digits);
}

export function findMatchingTotpCounter(
  secret: string,
  code: string,
  options: { timestamp?: number; window?: number } = {},
): number | null {
  const normalized = code.trim();
  if (!/^\d{6}$/.test(normalized)) return null;

  const timestamp = options.timestamp ?? Date.now();
  const window = options.window ?? 1;
  const currentCounter = Math.floor(timestamp / 1000 / TOTP_PERIOD_SECONDS);

  for (let offset = -window; offset <= window; offset += 1) {
    const counter = currentCounter + offset;
    if (counter < 0) continue;
    const expected = generateHotp(secret, counter, TOTP_DIGITS);
    if (safeEqual(expected, normalized)) return counter;
  }

  return null;
}

export function encryptMfaSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", mfaEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return ["v1", iv, ciphertext, tag]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

export function decryptMfaSecret(value: string): string {
  const [version, encodedIv, encodedCiphertext, encodedTag] = value.split(".");
  if (
    version !== "v1" ||
    !encodedIv ||
    !encodedCiphertext ||
    !encodedTag
  ) {
    throw new Error("MFA secret is invalid");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    mfaEncryptionKey(),
    Buffer.from(encodedIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function generateHotp(secret: string, counter: number, digits: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret))
    .update(counterBuffer)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** digits).padStart(digits, "0");
}

function base32Encode(value: Buffer): string {
  let bits = 0;
  let buffer = 0;
  let output = "";

  for (const byte of value) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) output += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  return output;
}

function base32Decode(value: string): Buffer {
  const normalized = value.toUpperCase().replace(/=+$/u, "");
  let bits = 0;
  let buffer = 0;
  const output: number[] = [];

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) throw new Error("MFA secret is invalid");
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

function mfaEncryptionKey(): Buffer {
  const authSecret = process.env.APP_AUTH_SECRET;
  if (!authSecret) throw new Error("APP_AUTH_SECRET is not configured");

  return createHash("sha256")
    .update(MFA_CIPHER_CONTEXT)
    .update("\0")
    .update(authSecret)
    .digest();
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
