import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import { PORTAL_TTL_MS } from "../portal/links";

export async function expireQuotes(now = new Date()) {
  const studios = await platformDb.studio.findMany({ select: { id: true } });
  const activeLink = { revokedAt: null, expiresAt: { gt: now } };
  let expired = 0;
  for (const { id } of studios) {
    // Po faktycznej wysyłce wycena wygasa po 14 dniach lub utracie wszystkich linków (także zlecenia), zależnie co nastąpi wcześniej.
    const result = await studioDb(id).quote.updateMany({
      where: {
        status: "sent", decidedAt: null, sentAt: { not: null },
        OR: [
          { sentAt: { lte: new Date(now.getTime() - PORTAL_TTL_MS) } },
          { NOT: [
            { portalLinks: { some: activeLink } },
            { order: { is: { portalLinks: { some: activeLink } } } },
          ] },
        ],
      },
      data: { status: "expired" },
    });
    expired += result.count;
  }
  return expired;
}
