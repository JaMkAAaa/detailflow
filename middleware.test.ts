import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware";

const BASE = "http://localhost:3000";

function run(path: string, cookie?: string) {
  return middleware(new NextRequest(`${BASE}${path}`, { headers: cookie ? { cookie } : {} }));
}

describe("middleware", () => {
  it.each(["/orders", "/invoices?status=uwaga"])("sends a guest from %s to /login with next", (path) => {
    const res = run(path);
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe(path);
  });

  it.each(["/admin", "/admin/studios"])("sends a guest from %s to /admin/login, not studio login", (path) => {
    const res = run(path);
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/admin/login");
    expect(location.searchParams.get("next")).toBe(path);
  });

  it("shows the landing to a guest at / without redirecting", () => {
    const res = run("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-rewrite")).toBe(`${BASE}/landing`);
  });

  it("keeps the dashboard at / for a signed-in studio", () => {
    const res = run("/", "df.session_token=abc.def");
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.headers.get("location")).toBeNull();
  });

  it.each(["/login", "/landing", "/logout", "/forgot-password", "/reset-password", "/p/abc", "/admin/login"])("lets a guest open %s", (path) => {
    expect(run(path).headers.get("location")).toBeNull();
  });

  it("does not treat lookalike paths as public", () => {
    expect(run("/login-x").status).toBe(307);
    expect(run("/portal").status).toBe(307);
    expect(run("/adminer").status).toBe(307);
  });

  it("prevents portal secrets from leaking through referrers, caches or indexing", () => {
    const headers = run("/p/example-token").headers;
    expect(headers.get("referrer-policy")).toBe("no-referrer");
    expect(headers.get("cache-control")).toBe("private, no-store");
    expect(headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("lets a request with a session cookie through (validity is checked in the layout)", () => {
    expect(run("/orders", "df.session_token=abc.def").headers.get("location")).toBeNull();
    expect(run("/admin", "df-plat.session_token=abc.def").headers.get("location")).toBeNull();
    expect(run("/admin", "__Secure-df-plat.session_token=abc.def").headers.get("location")).toBeNull();
  });

  it("does not treat a studio session as a platform session", () => {
    expect(run("/admin", "df.session_token=abc.def").status).toBe(307);
    expect(run("/admin", "__Secure-df.session_token=abc.def").status).toBe(307);
    const location = new URL(run("/admin", "df.session_token=abc.def").headers.get("location")!);
    expect(location.pathname).toBe("/admin/login");
  });

  it("does not treat a platform session as a studio session", () => {
    expect(run("/orders", "df-plat.session_token=abc.def").status).toBe(307);
    const location = new URL(run("/orders", "df-plat.session_token=abc.def").headers.get("location")!);
    expect(location.pathname).toBe("/login");
  });

  it("ignores another app's cookie", () => {
    expect(run("/orders", "better-auth.session_token=abc").status).toBe(307);
  });
});
