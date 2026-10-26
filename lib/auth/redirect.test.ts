import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";

describe("safeNext", () => {
  it.each([
    ["/zlecenia?status=w-trakcie", "/zlecenia?status=w-trakcie"],
    ["/admin", "/admin"],
    [undefined, "/"],
    ["", "/"],
    ["https://evil.example/", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["zlecenia", "/"],
    ["/logowanie", "/"],
    ["/logowanie?next=/x", "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});
