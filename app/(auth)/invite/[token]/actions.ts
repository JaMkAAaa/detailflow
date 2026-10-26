"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { acceptInvitation } from "@/src/server/studio/invitations";
import { STUDIO_COOKIE } from "@/src/server/studio/context";
import { AccessError } from "@/src/server/acl";

export async function acceptInvite(token: string): Promise<void> {
  const { user } = await requireSession();
  let studioId: string;
  try { studioId = await acceptInvitation(user, token); }
  catch (error) {
    if (error instanceof AccessError) redirect(`/invite/${token}?error=${error.status}`);
    throw error;
  }
  (await cookies()).set(STUDIO_COOKIE, studioId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 14 * 86400 });
  redirect("/");
}
