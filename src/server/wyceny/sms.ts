import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { generatePortalToken, hashPortalToken } from "@/lib/portal/token";
import { PORTAL_TTL_MS } from "../portal/ttl";
import { normalizeSmsPhone, smsConfigured } from "./sms-config";

export async function deliverQuoteSms() {
  if (!smsConfigured() || !process.env.APP_URL) return;
  const origin = new URL(process.env.APP_URL).origin;
  const studios = await platformDb.studio.findMany({ select: { id: true, name: true } });
  for (const studio of studios) {
    const db = studioDb(studio.id);
    const pending = await db.quoteSendSms.findMany({ where: { status: "pending", nextAttemptAt: { lte: new Date() } }, take: 50, orderBy: { nextAttemptAt: "asc" } });
    for (const job of pending) {
      if (job.attempts >= 5 || (job.attempts > 0 && Date.now() - job.createdAt.getTime() > 23 * 60 * 60 * 1000)) {
        await db.quoteSendSms.updateMany({ where: { id: job.id, status: "pending" }, data: { status: "failed" } });
        continue;
      }
      try {
        const token = generatePortalToken();
        const claimed = await db.$transaction(async (tx) => {
          // Serializacja z wysyłką maila, ponowieniem i decyzją klienta.
          await tx.quote.updateMany({ where: { id: job.quoteId, status: "sent" }, data: { status: "sent" } });
          const quote = await tx.quote.findFirstOrThrow({ where: { id: job.quoteId }, include: { client: true, sendMail: true } });
          if (quote.status !== "sent" || quote.decidedAt || (quote.sentAt && Date.now() - quote.sentAt.getTime() >= PORTAL_TTL_MS) || normalizeSmsPhone(quote.client.phone) !== job.recipient) {
            await tx.quoteSendSms.updateMany({ where: { id: job.id, status: "pending" }, data: { status: "cancelled" } });
            return false;
          }
          // SMS nigdy nie zastępuje maila. Czekamy na skuteczne SMTP.
          if (!quote.sentAt || !quote.sendMail?.sentAt) return false;
          const claim = await tx.quoteSendSms.updateMany({ where: { id: job.id, status: "pending", attempts: job.attempts, nextAttemptAt: { lte: new Date() } },
            data: { attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + 60_000 * 2 ** job.attempts) } });
          if (!claim.count) return false;
          await tx.portalLink.create({ data: { studioId: studio.id, quoteId: job.quoteId, tokenHash: hashPortalToken(token), expiresAt: new Date(Date.now() + PORTAL_TTL_MS) } });
          return true;
        });
        if (!claimed) continue;
        // Link jest zatwierdzony PRZED HTTP: timeout/awaria po przyjęciu SMS nie unieważnia go.
        const response = await fetch("https://api.smsapi.pl/sms.do", {
          method: "POST", headers: { Authorization: `Bearer ${process.env.SMSAPI_TOKEN}` },
          body: new URLSearchParams({ to: job.recipient, from: process.env.SMSAPI_SENDER!,
            message: `${studio.name}: wycena do sprawdzenia i akceptacji: ${origin}/p/${token}`,
            format: "json", idx: job.id, check_idx: "1" }),
          signal: AbortSignal.timeout(10_000), redirect: "error",
        });
        const result = await response.json();
        // 53 = ten IDX został już przyjęty (np. timeout poprzedniej próby).
        if (!response.ok || (result.error !== 53 && !(result.count === 1 && result.list?.[0]?.id))) throw new Error("SMSAPI rejected");
        await db.quoteSendSms.updateMany({ where: { id: job.id, status: "pending" }, data: { status: "sent", sentAt: new Date() } });
      } catch {
        // Żaden URL, numer, treść odpowiedzi ani sekret dostawcy nie trafia do logów.
        console.error("[quotes] SMS failed", { studioId: studio.id, notificationId: job.id });
      }
      await db.quoteSendSms.updateMany({ where: { id: job.id, status: "pending", attempts: { gte: 5 } }, data: { status: "failed" } });
    }
  }
}
