import { createTransport } from "nodemailer";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { generatePortalToken, hashPortalToken } from "@/lib/portal/token";
import { PORTAL_TTL_MS } from "../portal/ttl";

// Trwały outbox obsługiwany przez istniejący worker. Retry nie zapisuje URL/tokenu.
export async function deliverQuoteMails() {
  if (!process.env.SMTP_URL || !process.env.APP_URL) return;
  const origin = new URL(process.env.APP_URL).origin;
  const transport = createTransport(process.env.SMTP_URL);
  const studios = await platformDb.studio.findMany({ select: { id: true, name: true } });
  for (const studio of studios) {
    const db = studioDb(studio.id);
    const pending = await db.quoteSendMail.findMany({ where: { sentAt: null }, take: 50, orderBy: { createdAt: "asc" } });
    for (const mail of pending) {
      try {
        await db.$transaction(async (tx) => {
          // Kolejność blokad jak w sendQuote: wycena, potem job.
          await tx.quote.updateMany({ where: { id: mail.quoteId, status: "sent", decidedAt: null }, data: { status: "sent" },
            // Statusu zaakceptowanej/odrzuconej wyceny nie cofamy.
          });
          const claimed = await tx.quoteSendMail.updateMany({ where: { id: mail.id, sentAt: null }, data: { sentAt: new Date() } });
          if (!claimed.count) return;
          const quote = await tx.quote.findFirstOrThrow({ where: { id: mail.quoteId }, include: { client: true, vehicle: true, items: { orderBy: { sort: "asc" } } } });
          if (quote.decidedAt || quote.status !== "sent") return;
          if (!quote.client.email) throw new Error("Missing recipient");
          const token = generatePortalToken();
          await tx.portalLink.create({ data: { studioId: studio.id, quoteId: quote.id,
            tokenHash: hashPortalToken(token), expiresAt: new Date(Date.now() + PORTAL_TTL_MS) } });
          const url = `${origin}/p/${token}`;
          await transport.sendMail({
            from: process.env.EMAIL_FROM ?? "Detailflow <noreply@detailflow.local>",
            to: quote.client.email,
            messageId: `<quote-send-${mail.id}-${mail.createdAt.getTime()}@detailflow.local>`,
            subject: `Wycena — ${studio.name}`,
            text: `Dzień dobry ${quote.client.name},\n\nPrzesyłamy wycenę dla ${quote.vehicle.make} ${quote.vehicle.model} · ${quote.vehicle.plate}.\n\n${quote.items.map((item) => `• ${item.name}`).join("\n")}\n\nŁącznie brutto: ${quote.totalGross.toFixed(2)} PLN\nW tym VAT 23%: ${quote.vatAmount.toFixed(2)} PLN\n${quote.notes ? `\n${quote.notes}\n` : ""}\nSprawdź i zaakceptuj wycenę: ${url}\nLink jest ważny 14 dni.\n\n${studio.name}`,
          });
          await tx.quote.updateMany({ where: { id: quote.id }, data: { sentAt: new Date() } });
        }, { timeout: 30_000 });
      } catch {
        console.error("[quotes] e-mail failed", { studioId: studio.id, notificationId: mail.id });
      }
    }
  }
}
