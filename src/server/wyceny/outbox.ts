import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import type { QuoteEmailJob } from "./email";

/** Odkrywanie tenantów na granicy platformy; operacyjne odczyty są scope'owane. */
export async function relayQuoteEmails(enqueue: (data: QuoteEmailJob) => Promise<unknown>) {
  const studios = await platformDb.studio.findMany({ select: { id: true } });
  for (const { id: studioId } of studios) {
    const pending = await studioDb(studioId).quoteEmail.findMany({ where: { sentAt: null }, orderBy: { createdAt: "asc" }, take: 100, select: { id: true } });
    for (const { id: emailId } of pending) await enqueue({ studioId, emailId });
  }
}
