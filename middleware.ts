import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_PREFIX, PLATFORM_COOKIE_PREFIX } from "./lib/auth/cookie";
import { LOGIN_PATH, PLATFORM_LOGIN_PATH } from "./lib/auth/redirect";

// Ścieżki bez sesji studia. /admin wymaga osobnego cookie operatora.
const PUBLIC_PATHS = [LOGIN_PATH, PLATFORM_LOGIN_PATH, "/landing", "/start", "/logout", "/forgot-password", "/reset-password", "/invite", "/p/"];

function isPublicPortfolio(pathname: string) {
  return pathname === "/realizacje" || pathname.startsWith("/realizacje/");
}

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`)));
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function redirectTo(request: NextRequest, loginPath: string, pathname: string, search: string) {
  const url = request.nextUrl.clone();
  url.pathname = loginPath;
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

// Szybki filtr na edge: tylko obecność cookie. Ważność sesji w bazie sprawdza
// layout (`requireSession` / `requirePlatform`), bo wygasłe cookie też tu przejdzie.
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/p/")) {
    const response = NextResponse.next();
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  if (isPublicPortfolio(pathname)) {
    const response = NextResponse.next();
    response.headers.set("Referrer-Policy", "no-referrer");
    // Lista realizacji nie zostaje w cache. Cache pochodnej ustawia route mediów.
    if (!pathname.includes("/media/")) response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  if (isPublic(pathname)) return NextResponse.next();

  if (isAdminPath(pathname)) {
    if (getSessionCookie(request, { cookiePrefix: PLATFORM_COOKIE_PREFIX })) return NextResponse.next();
    return redirectTo(request, PLATFORM_LOGIN_PATH, pathname, search);
  }

  if (getSessionCookie(request, { cookiePrefix: AUTH_COOKIE_PREFIX })) return NextResponse.next();

  // `/` to pulpit studia dla zalogowanych, a landing (app/(marketing)/landing) dla gości.
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/landing";
    return NextResponse.rewrite(url);
  }

  return redirectTo(request, LOGIN_PATH, pathname, search);
}

export const config = {
  // API (w tym /api/auth i /api/health) i statyczne pliki pilnują się same.
  matcher: ["/((?!api/|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|ttf|woff2?)$).*)"],
};
