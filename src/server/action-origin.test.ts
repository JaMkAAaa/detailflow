import { expect, it } from "vitest";
import { sameOrigin } from "./action-origin";

it("accepts only the exact app origin", () => {
  expect(sameOrigin("http://localhost:3000", "http://localhost:3000")).toBe(true);
  expect(sameOrigin("http://localhost:3000", "http://localhost:3000/app")).toBe(true);
  expect(sameOrigin(null, "http://localhost:3000")).toBe(false);
  expect(sameOrigin("https://evil.example", "http://localhost:3000")).toBe(false);
  expect(sameOrigin("http://localhost:3000.evil.example", "http://localhost:3000")).toBe(false);
});
