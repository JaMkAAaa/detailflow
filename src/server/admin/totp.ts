import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function mfaKey() {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32) throw new Error("AUTH_SECRET required for MFA");
  return createHash("sha256").update(`detailflow:operator-mfa:v1:${secret}`).digest();
}

export function encryptMfaSecret(operatorId: string, secret: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", mfaKey(), iv);
  cipher.setAAD(Buffer.from(`mfa:v1:${operatorId}`));
  const ciphertext = Buffer.concat([cipher.update(secret), cipher.final()]);
  return ["mfa", "v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptMfaSecret(operatorId: string, encrypted: string) {
  const [prefix, version, iv, tag, ciphertext, extra] = encrypted.split(":");
  if (!operatorId || prefix !== "mfa" || version !== "v1" || !iv || !tag || !ciphertext || extra !== undefined) {
    throw new Error("Nieprawidłowy sekret MFA.");
  }
  const decipher = createDecipheriv("aes-256-gcm", mfaKey(), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(`mfa:v1:${operatorId}`));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]);
}

export function base32Encode(data: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string) {
  const clean = input.replace(/=+$/g, "").replace(/\s/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Nieprawidłowy sekret MFA.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: Buffer, counter: number) {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const binary = ((hmac[offset]! & 0x7f) << 24) | (hmac[offset + 1]! << 16) | (hmac[offset + 2]! << 8) | hmac[offset + 3]!;
  return String(binary % 1_000_000).padStart(6, "0");
}

export function totpCode(secret: Buffer, at: Date) {
  return hotp(secret, Math.floor(at.getTime() / 1000 / 30));
}

/** Krok TOTP albo null. Okno ±30 s. Ten sam krok nie może być użyty drugi raz. */
export function matchTotpStep(secret: Buffer, token: string, nowMs: number, lastAcceptedStep: number) {
  const normalized = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return null;
  const counter = Math.floor(nowMs / 1000 / 30);
  for (const delta of [0, -1, 1]) {
    const step = counter + delta;
    if (step <= lastAcceptedStep) continue;
    const expected = hotp(secret, step);
    const left = Buffer.from(expected);
    const right = Buffer.from(normalized);
    if (left.length === right.length && timingSafeEqual(left, right)) return step;
  }
  return null;
}

export function otpauthUrl(email: string, secret: string) {
  const label = encodeURIComponent(`Detailflow:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("Detailflow")}&algorithm=SHA1&digits=6&period=30`;
}

export function createBackupCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(8);
    let raw = "";
    for (const byte of bytes) raw += BACKUP_ALPHABET[byte % BACKUP_ALPHABET.length];
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  });
}

export function hashBackupCode(code: string) {
  const normalized = code.replace(/[-\s]/g, "").toUpperCase();
  return createHash("sha256").update(`detailflow:mfa-backup:v1:${normalized}`).digest("hex");
}
