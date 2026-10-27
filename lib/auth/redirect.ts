export const LOGIN_PATH = "/login";
export const AFTER_LOGIN_PATH = "/";
export const PLATFORM_LOGIN_PATH = "/admin/login";
export const AFTER_PLATFORM_LOGIN_PATH = "/admin";

/** Tylko ścieżki tej aplikacji: `/orders?x=1` tak, `//evil.pl` i `https://…` nie. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return AFTER_LOGIN_PATH;
  if (next === LOGIN_PATH || next.startsWith(`${LOGIN_PATH}?`)) return AFTER_LOGIN_PATH;
  return next;
}

/** Powrót po logowaniu operatora: wyłącznie `/admin` i jego podścieżki. */
export function safeAdminNext(next: string | null | undefined): string {
  if (!next || next.startsWith("//") || next.startsWith("/\\")) return AFTER_PLATFORM_LOGIN_PATH;
  if (next === "/admin") return next;
  if (next.startsWith("/admin/") && !next.startsWith("/admin/login")) return next;
  return AFTER_PLATFORM_LOGIN_PATH;
}
