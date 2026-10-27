import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { STUDIO_COOKIE } from "@/src/server/studio/context";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { studioId } = z.object({ studioId: z.string().min(1) }).parse(await request.json());
    await apiStudio(request, studioId, "studio:select");
    const response = NextResponse.json({ studioId });
    response.cookies.set(STUDIO_COOKIE, studioId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 14 * 86400 });
    return response;
  } catch (error) { return apiError(error); }
}
