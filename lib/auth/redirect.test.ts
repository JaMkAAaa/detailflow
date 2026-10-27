import { describe, expect, it } from "vitest";
import { safeAdminNext, safeNext } from "./redirect";

describe("safeNext", () => {
  it.each([
    ["/orders?status=w-trakcie", "/orders?status=w-trakcie"],
    ["/admin", "/admin"],
    [undefined, "/"],
    ["", "/"],
    ["https://evil.example/", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["orders", "/"],
    ["/login", "/"],
    ["/login?next=/x", "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});

describe("safeAdminNext", () => {
  it("pozwala tylko na ścieżki /admin", () => {
    expect(safeAdminNext("/admin")).toBe("/admin");
    expect(safeAdminNext("/admin/studios")).toBe("/admin/studios");
    expect(safeAdminNext("/orders")).toBe("/admin");
    expect(safeAdminNext("/admin/login")).toBe("/admin");
    expect(safeAdminNext("//evil.pl")).toBe("/admin");
    expect(safeAdminNext("/adminer")).toBe("/admin");
  });
});
