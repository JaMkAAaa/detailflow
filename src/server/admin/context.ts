import { redirect } from "next/navigation";
import { requirePlatformSession } from "../../../lib/auth/session";
import { PLATFORM_LOGIN_PATH } from "../../../lib/auth/redirect";
import { platformDb } from "../../../lib/db/client";

export async function requirePlatform() {
  const session = await requirePlatformSession();
  const operator = await platformDb.platformOperator.findUnique({
    where: { userId: session.user.id },
    select: { role: true },
  });
  if (!operator) redirect(PLATFORM_LOGIN_PATH);
  return { user: session.user, role: operator.role };
}
