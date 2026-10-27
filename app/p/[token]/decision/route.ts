import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { decideQuote, PortalLinkError } from "@/src/server/portal/links";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  if (request.headers.get("origin") !== new URL(env.APP_URL).origin) return new Response(null, { status: 403 });
  const { token } = await context.params;
  const destination = new URL(`/p/${encodeURIComponent(token)}`, env.APP_URL);
  const decision = (await request.formData()).get("decision");
  try {
    if (decision !== "accepted" && decision !== "rejected") throw new PortalLinkError();
    await decideQuote(token, decision);
  } catch (error) {
    if (!(error instanceof PortalLinkError)) throw error;
    destination.searchParams.set("unavailable", "1");
  }
  return NextResponse.redirect(destination, { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
