import { readFileSync } from "node:fs";
import { constants, createDecipheriv, privateDecrypt } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { KsefClient, KsefError, hash } from "./client";
import { decryptToken, encryptTestToken, encryptToken, decryptTestToken, tokenEnvironment } from "./secrets";

const cert = readFileSync(new URL("./fixtures/test-only-cert.pem", import.meta.url), "utf8").replace(/-----[^-]+-----|\s/g, "");
const privateKey = readFileSync(new URL("./fixtures/test-only-key.pem", import.meta.url), "utf8");
const decode = (value: string) => privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(value, "base64"));
afterEach(() => vi.unstubAllEnvs());

it("binds encrypted tokens to TEST and their studio, rejects tampering and production", () => {
  vi.stubEnv("KSEF_ENV", "test");
  vi.stubEnv("KSEF_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  const encrypted = encryptTestToken("a", "secret-token");
  expect(encrypted).not.toContain("secret-token");
  expect(decryptTestToken("a", encrypted)).toBe("secret-token");
  expect(() => decryptTestToken("b", encrypted)).toThrow();
  const parts = encrypted.split(":");
  parts[4] = Buffer.from("tampered").toString("base64");
  expect(() => decryptTestToken("a", parts.join(":"))).toThrow();
  for (const env of ["production", "prod"]) {
    vi.stubEnv("KSEF_ENV", env);
    expect(() => decryptTestToken("a", encrypted)).toThrow("only TEST");
    expect(() => new KsefClient()).toThrow("only TEST");
  }
});
it("refuses to open a TEST token as PROD and keeps the production host off the TEST API", async () => {
  vi.stubEnv("KSEF_ENV", "test");
  vi.stubEnv("KSEF_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("KSEF_PROD_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 9).toString("base64"));
  const testToken = encryptTestToken("studio", "secret-token");
  expect(tokenEnvironment(testToken)).toBe("test");
  expect(testToken).not.toContain("secret-token");
  expect(() => decryptToken("studio", "production", testToken)).toThrow();
  const prodToken = encryptToken("studio", "production", "prod-token");
  expect(prodToken).not.toContain("prod-token");
  expect(decryptToken("studio", "production", prodToken)).toBe("prod-token");
  expect(() => decryptToken("studio", "test", prodToken)).toThrow();
  const urls: string[] = [];
  const transport = vi.fn(async (url: string | URL | Request) => {
    urls.push(String(url));
    return Response.json({ challenge: "c", timestampMs: 1 });
  });
  const client = new KsefClient(transport as typeof fetch, async () => undefined, "production");
  await client.authenticate("1234567890", "prod-token").catch(() => undefined);
  expect(urls[0]).toBe("https://api.ksef.mf.gov.pl/v2/auth/challenge");
  expect(urls[0]).not.toContain("api-test");
  vi.stubEnv("KSEF_PROD_API_URL", "https://api-test.ksef.mf.gov.pl/v2");
  expect(() => new KsefClient(transport as typeof fetch, async () => undefined, "production")).toThrow("PROD API URL");
});
it("rejects a production or arbitrary API host before any network call", () => {
  vi.stubEnv("KSEF_API_URL", "https://api.ksef.mf.gov.pl/v2");
  expect(() => new KsefClient()).toThrow("TEST API URL");
});
it("performs challenge, encrypted auth, AES session, submit, status, UPO and close with the v2 contract", async () => {
  const calls: { path: string; init: RequestInit }[] = [];
  const transport = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    calls.push({ path, init: init! });
    let result: unknown;
    if (path === "/v2/auth/challenge") result = { challenge: "challenge", timestampMs: 123 };
    else if (path === "/v2/security/public-key-certificates") result = [{ certificate: cert, publicKeyId: "key", validFrom: "2020-01-01", validTo: "2200-01-01", usage: ["KsefTokenEncryption", "SymmetricKeyEncryption"] }];
    else if (path === "/v2/auth/ksef-token") {
      const body = JSON.parse(String(init?.body));
      expect(decode(body.encryptedToken).toString()).toBe("studio-token|123");
      expect(body.contextIdentifier).toEqual({ type: "Nip", value: "1234567890" });
      result = { referenceNumber: "auth", authenticationToken: { token: "auth-token" } };
    } else if (path === "/v2/auth/auth") result = { status: { code: 200, description: "OK" } };
    else if (path === "/v2/auth/token/redeem") result = { accessToken: { token: "access" } };
    else if (path === "/v2/sessions/online") result = { referenceNumber: "session" };
    else if (path === "/v2/sessions/online/session/invoices") result = { referenceNumber: "invoice" };
    else if (path === "/v2/sessions/session/invoices/invoice") result = { status: { code: 200, description: "OK" }, ksefNumber: "number", acquisitionDate: "2026-10-24T08:13:08Z" };
    else if (path.endsWith("/upo")) return new Response("<UPO/>", { headers: { "content-type": "application/xml" } });
    else if (path.endsWith("/close")) return new Response(null, { status: 204 });
    else throw new Error(`Unexpected ${path}`);
    return Response.json(result);
  });
  const client = new KsefClient(transport as typeof fetch);
  const token = await client.authenticate("1234567890", "studio-token");
  const session = await client.openSession(token);
  const xml = "<Faktura>Zażółć</Faktura>";
  expect(await client.submit(token, session, xml)).toBe("invoice");
  const open = JSON.parse(String(calls.find(c => c.path === "/v2/sessions/online")!.init.body));
  expect(open.formCode).toEqual({ systemCode: "FA (3)", schemaVersion: "1-0E", value: "FA" });
  const key = decode(open.encryption.encryptedSymmetricKey);
  const body = JSON.parse(String(calls.find(c => c.path.endsWith("session/invoices"))!.init.body));
  const encrypted = Buffer.from(body.encryptedInvoiceContent, "base64");
  const decipher = createDecipheriv("aes-256-cbc", key, Buffer.from(open.encryption.initializationVector, "base64"));
  expect(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString()).toBe(xml);
  expect(body.invoiceHash).toBe(hash(Buffer.from(xml)));
  expect(body.invoiceSize).toBe(Buffer.byteLength(xml));
  expect(body.encryptedInvoiceHash).toBe(hash(encrypted));
  expect(body.offlineMode).toBe(false);
  expect((await client.status(token, session.reference, "invoice")).ksefNumber).toBe("number");
  expect(await client.upo(token, session.reference, "invoice")).toBe("<UPO/>");
  await client.close(token, session.reference);
  expect(calls.every(c => c.init.redirect === "error")).toBe(true);
});
it("bounds auth polling with exponential backoff", async () => {
  const pause = vi.fn(async (ms: number) => { void ms; });
  const transport = vi.fn(async (url: string | URL | Request) => {
    const path = new URL(String(url)).pathname;
    if (path.endsWith("challenge")) return Response.json({ challenge: "x", timestampMs: 1 });
    if (path.endsWith("certificates")) return Response.json([{ certificate: cert, publicKeyId: "key", validFrom: "2020-01-01", validTo: "2200-01-01", usage: ["KsefTokenEncryption"] }]);
    if (path.endsWith("ksef-token")) return Response.json({ referenceNumber: "auth", authenticationToken: { token: "auth" } });
    return Response.json({ status: { code: 100, description: "Pending" } });
  });
  await expect(new KsefClient(transport as typeof fetch, pause).authenticate("nip", "token")).rejects.toMatchObject({ retryable: true });
  expect(pause.mock.calls.map(c => c[0])).toEqual([1000, 2000, 4000, 8000, 8000, 8000]);
});
it("distinguishes ambiguous submission timeouts, transient 429 and terminal 400 without leaking bodies", async () => {
  const session = { reference: "session", key: Buffer.alloc(32), iv: Buffer.alloc(16) };
  const timeout = new KsefClient(vi.fn().mockRejectedValue(new Error("secret")));
  await expect(timeout.submit("token", session, "xml")).rejects.toMatchObject({ retryable: true, ambiguous: true });
  const limited = new KsefClient(vi.fn().mockResolvedValue(new Response("secret", { status: 429, headers: { "retry-after": "30" } })));
  await expect(limited.status("token", "session", "invoice")).rejects.toMatchObject({ retryable: true, retryAfterMs: 30000 });
  const invalid = new KsefClient(vi.fn().mockResolvedValue(new Response("secret buyer NIP", { status: 400 })));
  await expect(invalid.submit("token", session, "xml")).rejects.toEqual(new KsefError("KSeF TEST: HTTP 400", false, false));
});
