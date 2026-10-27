import { constants, createCipheriv, createHash, publicEncrypt, randomBytes, X509Certificate } from "node:crypto";
import { z } from "zod";
import { assertKsefTest, TEST_API } from "./config";

export class KsefError extends Error {
  constructor(message: string, public retryable = false, public ambiguous = false, public retryAfterMs?: number) { super(message); }
}
const status = z.object({ code: z.number(), description: z.string(), details: z.array(z.string()).optional() });
const reference = z.object({ referenceNumber: z.string().min(1) });
const certificate = z.object({ certificate: z.string(), publicKeyId: z.string(), validFrom: z.string(), validTo: z.string(), usage: z.array(z.string()) });
const invoiceStatus = z.object({ status, ksefNumber: z.string().optional().nullable(), acquisitionDate: z.string().optional().nullable() });
export type InvoiceStatus = z.infer<typeof invoiceStatus>;
export const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("base64");
const part = encodeURIComponent;

/** Official v2 TEST contract. No caller-supplied hosts and no redirects. */
export class KsefClient {
  constructor(private transport: typeof fetch = fetch, private pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))) { assertKsefTest(); }

  private async request(path: string, token?: string, body?: unknown, xml = false): Promise<unknown> {
    assertKsefTest();
    let response: Response;
    try {
      response = await this.transport(`${TEST_API}${path}`, {
        method: body === undefined ? "GET" : "POST", redirect: "error", signal: AbortSignal.timeout(20_000),
        headers: { Accept: xml ? "application/xml" : "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch { throw new KsefError("KSeF TEST: transport timeout or connection error", true, body !== undefined); }
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      const seconds = Number(response.headers.get("retry-after"));
      // Never include response bodies: MF errors may contain invoice data or credentials.
      throw new KsefError(`KSeF TEST: HTTP ${response.status}`, retryable, response.status >= 500 && body !== undefined, seconds > 0 ? seconds * 1000 : undefined);
    }
    if (response.status === 204) return undefined;
    try { return xml ? await response.text() : await response.json(); }
    catch { throw new KsefError("KSeF TEST: invalid response", true, body !== undefined); }
  }

  private async publicKey(usage: string) {
    const certificates = z.array(certificate).parse(await this.request("/security/public-key-certificates"));
    const now = Date.now();
    const cert = certificates.find(c => c.usage.includes(usage) && Date.parse(c.validFrom) <= now && Date.parse(c.validTo) > now);
    if (!cert) throw new KsefError("KSeF TEST: no valid encryption certificate");
    return { key: new X509Certificate(Buffer.from(cert.certificate, "base64")).publicKey, publicKeyId: cert.publicKeyId };
  }
  private encrypt(key: Awaited<ReturnType<KsefClient["publicKey"]>>, bytes: Buffer) {
    return publicEncrypt({ key: key.key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, bytes).toString("base64");
  }

  async authenticate(nip: string, token: string) {
    const challenge = z.object({ challenge: z.string(), timestampMs: z.number().int() }).parse(await this.request("/auth/challenge", undefined, {}));
    const key = await this.publicKey("KsefTokenEncryption");
    const auth = reference.extend({ authenticationToken: z.object({ token: z.string() }) }).parse(await this.request("/auth/ksef-token", undefined, {
      challenge: challenge.challenge, contextIdentifier: { type: "Nip", value: nip },
      encryptedToken: this.encrypt(key, Buffer.from(`${token}|${challenge.timestampMs}`)), publicKeyId: key.publicKeyId,
    }));
    for (let attempt = 0; attempt < 6; attempt++) {
      const result = z.object({ status }).parse(await this.request(`/auth/${part(auth.referenceNumber)}`, auth.authenticationToken.token));
      if (result.status.code === 200) {
        return z.object({ accessToken: z.object({ token: z.string() }) }).parse(await this.request("/auth/token/redeem", auth.authenticationToken.token, {})).accessToken.token;
      }
      if (result.status.code >= 400) throw new KsefError(`KSeF TEST: authentication status ${result.status.code}`, result.status.code >= 500);
      await this.pause(Math.min(1000 * 2 ** attempt, 8000));
    }
    throw new KsefError("KSeF TEST: authentication pending", true);
  }

  async openSession(token: string) {
    const key = await this.publicKey("SymmetricKeyEncryption");
    const symmetricKey = randomBytes(32), iv = randomBytes(16);
    const session = reference.parse(await this.request("/sessions/online", token, {
      formCode: { systemCode: "FA (3)", schemaVersion: "1-0E", value: "FA" },
      encryption: { encryptedSymmetricKey: this.encrypt(key, symmetricKey), initializationVector: iv.toString("base64"), publicKeyId: key.publicKeyId },
    }));
    return { reference: session.referenceNumber, key: symmetricKey, iv };
  }

  async submit(token: string, session: { reference: string; key: Buffer; iv: Buffer }, xml: string) {
    const bytes = Buffer.from(xml, "utf8");
    const cipher = createCipheriv("aes-256-cbc", session.key, session.iv);
    const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
    return reference.parse(await this.request(`/sessions/online/${part(session.reference)}/invoices`, token, {
      invoiceHash: hash(bytes), invoiceSize: bytes.length, encryptedInvoiceHash: hash(encrypted), encryptedInvoiceSize: encrypted.length,
      encryptedInvoiceContent: encrypted.toString("base64"), offlineMode: false,
    })).referenceNumber;
  }
  async status(token: string, session: string, invoice: string) {
    return invoiceStatus.parse(await this.request(`/sessions/${part(session)}/invoices/${part(invoice)}`, token));
  }
  /** Recover a submit whose response was lost; never blindly POST it again. */
  async findInvoice(token: string, session: string, invoiceHash: string) {
    const page = z.object({ continuationToken: z.string().nullish(), invoices: z.array(reference.extend({ invoiceHash: z.string() })) }).parse(
      await this.request(`/sessions/${part(session)}/invoices?pageSize=100`, token));
    const found = page.invoices.find(invoice => invoice.invoiceHash === invoiceHash);
    if (found) return found.referenceNumber;
    // This adapter opens one session per invoice. Absence is inconclusive.
    if (page.continuationToken) throw new KsefError("KSeF TEST: unexpected multi-page session; manual reconciliation required");
    return null;
  }
  async upo(token: string, session: string, invoice: string) {
    return z.string().min(1).parse(await this.request(`/sessions/${part(session)}/invoices/${part(invoice)}/upo`, token, undefined, true));
  }
  async close(token: string, session: string) { await this.request(`/sessions/online/${part(session)}/close`, token, {}); }
}
