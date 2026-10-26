import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("Argon2id", () => {
  it("hashes with Argon2id in PHC format and verifies", async () => {
    const hash = await hashPassword("obsidian-demo-2026");
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifyPassword({ hash, password: "obsidian-demo-2026" })).toBe(true);
    expect(await verifyPassword({ hash, password: "obsidian-demo-2027" })).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("treats a malformed hash as a wrong password", async () => {
    expect(await verifyPassword({ hash: "not-a-hash", password: "x" })).toBe(false);
  });
});
