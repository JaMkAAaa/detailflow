import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_PREFIX } from "./lib/auth/cookie";
import { LOGIN_PATH } from "./lib/auth/redirect";

// Ścieżki bez sesji studia. Wszystko inne — panel (studio) i /admin — wymaga logowania.
const PUBLIC_PATHS = [LOGIN_PATH, "/start", "/logout", "/forgot-password", "/reset-password", "/p/"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`)));
}

// Szybki filtr na edge: tylko obecność cookie. Ważność sesji w bazie sprawdza
// layout (`requireSession`), bo wygasłe/odwołane cookie też tu przejdzie.
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();
  if (getSessionCookie(request, { cookiePrefix: AUTH_COOKIE_PREFIX })) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = LOGIN_PATH;
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // API (w tym /api/auth i /api/health) i statyczne pliki pilnują się same.
  matcher: ["/((?!api/|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|ttf|woff2?)$).*)"],
};
