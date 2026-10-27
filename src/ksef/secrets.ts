import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { assertKsefTest } from "./config";

function key() {
  assertKsefTest();
  const value = process.env.KSEF_TOKEN_ENCRYPTION_KEY ?? "";
  const bytes = Buffer.from(value, "base64");
  if (bytes.length !== 32 || bytes.toString("base64") !== value) throw new Error("KSeF: encryption key must be 32 bytes in canonical base64");
  return bytes;
}

export function encryptTestToken(studioId: string, token: string) {
  if (!studioId || !token.trim()) throw new Error("KSeF: studio and token required");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(`ksef:test:v1:${studioId}`));
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["test", "v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptTestToken(studioId: string, encrypted: string) {
  const encryptionKey = key();
  const [env, version, iv, tag, ciphertext, extra] = encrypted.split(":");
  if (!studioId || env !== "test" || version !== "v1" || !iv || !tag || !ciphertext || extra !== undefined) throw new Error("KSeF: invalid TEST secret");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(iv, "base64"));
  decipher.setAAD(Buffer.from(`ksef:test:v1:${studioId}`));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}
