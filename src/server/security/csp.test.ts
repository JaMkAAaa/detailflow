import { expect, it } from "vitest";
import { contentSecurityPolicy } from "./csp";

it("blocks framing and keeps production scripts off eval", () => {
  const policy = contentSecurityPolicy("production");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("form-action 'self'");
  expect(policy).not.toContain("unsafe-eval");
  expect(policy).toContain("https://*.ingest.sentry.io");
});

it("allows the dev refresh runtime", () => {
  expect(contentSecurityPolicy("development")).toContain("'unsafe-eval'");
});
