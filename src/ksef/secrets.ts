import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { assertKsefProduction, assertKsefTest, type KsefEnvironment } from "./config";

function keyFor(env: KsefEnvironment) {
  if (env === "test") assertKsefTest();
  else assertKsefProduction();
  const value = (env === "test" ? process.env.KSEF_TOKEN_ENCRYPTION_KEY : process.env.KSEF_PROD_TOKEN_ENCRYPTION_KEY) ?? "";
  const bytes = Buffer.from(value, "base64");
  if (bytes.length !== 32 || bytes.toString("base64") !== value) {
    throw new Error(env === "test" ? "KSeF: encryption key must be 32 bytes in canonical base64" : "KSeF: PROD encryption key must be 32 bytes in canonical base64");
  }
  return bytes;
}

export function tokenEnvironment(encrypted: string): KsefEnvironment | null {
  const prefix = encrypted.split(":")[0];
  return prefix === "test" || prefix === "production" ? prefix : null;
}

export function encryptToken(studioId: string, env: KsefEnvironment, token: string) {
  if (!studioId || !token.trim()) throw new Error("KSeF: studio and token required");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(env), iv);
  cipher.setAAD(Buffer.from(`ksef:${env}:v1:${studioId}`));
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [env, "v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptToken(studioId: string, env: KsefEnvironment, encrypted: string) {
  const encryptionKey = keyFor(env);
  const [prefix, version, iv, tag, ciphertext, extra] = encrypted.split(":");
  if (!studioId || prefix !== env || version !== "v1" || !iv || !tag || !ciphertext || extra !== undefined) throw new Error("KSeF: invalid secret");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(iv, "base64"));
  decipher.setAAD(Buffer.from(`ksef:${env}:v1:${studioId}`));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}

export function encryptTestToken(studioId: string, token: string) {
  return encryptToken(studioId, "test", token);
}

export function decryptTestToken(studioId: string, encrypted: string) {
  return decryptToken(studioId, "test", encrypted);
}
