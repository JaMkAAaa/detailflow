import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware";

const BASE = "http://localhost:3000";

function run(path: string, cookie?: string) {
  return middleware(new NextRequest(`${BASE}${path}`, { headers: cookie ? { cookie } : {} }));
}

describe("middleware", () => {
  it.each(["/orders", "/invoices?status=uwaga", "/admin", "/admin/studios"])("sends a guest from %s to /login with next", (path) => {
    const res = run(path);
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe(path);
  });

  it("sends a guest from the dashboard to a bare /login", () => {
    expect(run("/").headers.get("location")).toBe(`${BASE}/login`);
  });

  it.each(["/login", "/logout", "/forgot-password", "/reset-password", "/p/abc"])("lets a guest open %s", (path) => {
    expect(run(path).headers.get("location")).toBeNull();
  });

  it("does not treat lookalike paths as public", () => {
    expect(run("/login-x").status).toBe(307);
    expect(run("/portal").status).toBe(307);
  });

  it("lets a request with a session cookie through (validity is checked in the layout)", () => {
    expect(run("/orders", "df.session_token=abc.def").headers.get("location")).toBeNull();
    expect(run("/admin", "__Secure-df.session_token=abc.def").headers.get("location")).toBeNull();
  });

  it("ignores another app's cookie", () => {
    expect(run("/orders", "better-auth.session_token=abc").status).toBe(307);
  });
});
