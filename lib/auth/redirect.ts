export const LOGIN_PATH = "/logowanie";
export const AFTER_LOGIN_PATH = "/";

/** Tylko ścieżki tej aplikacji: `/zlecenia?x=1` tak, `//evil.pl` i `https://…` nie. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return AFTER_LOGIN_PATH;
  if (next === LOGIN_PATH || next.startsWith(`${LOGIN_PATH}?`)) return AFTER_LOGIN_PATH;
  return next;
}
