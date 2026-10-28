import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, decryptMfaSecret, encryptMfaSecret, hashBackupCode, matchTotpStep, totpCode } from "./totp";

describe("TOTP", () => {
  it("zgadza się z wektorem RFC 6238 dla T=59", () => {
    const secret = Buffer.from("12345678901234567890", "ascii");
    expect(totpCode(secret, new Date(59_000))).toBe("287082");
    expect(matchTotpStep(secret, "287082", 59_000, 0)).toBe(1);
    expect(matchTotpStep(secret, "287082", 59_000, 1)).toBeNull();
  });

  it("szyfruje sekret i koduje base32 w obie strony", () => {
    process.env.AUTH_SECRET ??= "test-secret-0123456789abcdef0123456789";
    const raw = Buffer.from("detailflow-mfa-secret!");
    const encoded = base32Encode(raw);
    expect(base32Decode(encoded).equals(raw)).toBe(true);
    const encrypted = encryptMfaSecret("operator-1", raw);
    expect(encrypted).not.toContain("detailflow-mfa-secret");
    expect(decryptMfaSecret("operator-1", encrypted).equals(raw)).toBe(true);
    expect(() => decryptMfaSecret("operator-2", encrypted)).toThrow();
    expect(hashBackupCode("ab cd-efgh")).toBe(hashBackupCode("ABCDEFGH"));
  });
});
