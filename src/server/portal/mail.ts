import { createTransport } from "nodemailer";
import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";

// Worker ma dostęp platformowy tylko do listy tenantów. Payload nie zawiera tokenu.
export async function deliverQuoteDecisionMails() {
  if (!process.env.SMTP_URL) return; // Outbox pozostaje oczekujący do konfiguracji SMTP.
  const transport = createTransport(process.env.SMTP_URL);
  const studios = await platformDb.studio.findMany({ select: { id: true } });
  for (const studio of studios) {
    const db = studioDb(studio.id);
    const pending = await db.quoteDecisionMail.findMany({ where: { sentAt: null }, take: 50, orderBy: { createdAt: "asc" } });
    for (const mail of pending) {
      try {
        await db.$transaction(async (tx) => {
          // Blokada uniemożliwia równoległą wysyłkę przez dwa workery.
          const claimed = await tx.quoteDecisionMail.updateMany({ where: { id: mail.id, sentAt: null }, data: { sentAt: new Date() } });
          if (!claimed.count) return;
          const quote = await tx.quote.findFirstOrThrow({ where: { id: mail.quoteId }, include: { client: true } });
          const owners = await tx.membership.findMany({ where: { role: "owner" }, select: { user: { select: { email: true } } } });
          if (!owners.length) throw new Error("Studio has no owner");
          const decision = quote.status === "accepted" ? "zaakceptowana" : "odrzucona";
          await transport.sendMail({
            from: process.env.EMAIL_FROM ?? "Detailflow <noreply@detailflow.local>",
            to: owners.map(({ user }) => user.email),
            messageId: `<quote-decision-${mail.id}@detailflow.local>`,
            subject: `Wycena ${decision} — ${quote.client.name}`,
            text: `Klient: ${quote.client.name}\nWycena: ${quote.id}\nDecyzja: ${decision}\nKwota brutto: ${quote.totalGross.toFixed(2)} PLN`,
          });
        }, { timeout: 30_000 });
      } catch {
        // Nie logujemy obiektów transportera/żądań ani payloadu.
        console.error("[portal] decision e-mail failed", { studioId: studio.id, notificationId: mail.id });
      }
    }
  }
}
