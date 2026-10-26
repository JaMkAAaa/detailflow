import { createHash, randomBytes } from "node:crypto";

// Surowy token trafia wyłącznie do URL `/p/[token]`; w bazie jest tylko hash.
export function generatePortalToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPortalToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
