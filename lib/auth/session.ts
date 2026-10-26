import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "../auth";
import { LOGIN_PATH } from "./redirect";

/** Pełna weryfikacja sesji w bazie (middleware sprawdza tylko obecność cookie). */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect(LOGIN_PATH);
  return session;
}
