import { createTransport } from "nodemailer";
import { z } from "zod";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { generateInvoicePdf } from "@/src/invoices/pdf";
import { AccessError } from "../access-error";
import { invoiceDocument } from "./document";

const input = z.object({ env: z.enum(["test", "production"]) }).strict();

export function invoiceMailText(number: string, env: "test" | "production") {
  return `${env === "test" ? "DOKUMENT TESTOWY — nie jest fakturą produkcyjną.\n\n" : ""}Dzień dobry,\n\nW załączniku przesyłamy fakturę ${number}.\n\nPozdrawiamy`;
}

export async function requestInvoiceMail(studioId: string, invoiceId: string, body: unknown) {
  const { env } = input.parse(body);
  return studioDb(studioId).$transaction(async tx => {
    // Blokada faktury serializuje kliknięcia i worker (zawsze invoice -> mail).
    const lock = await tx.invoice.updateMany({ where: { id: invoiceId, ksefEnv: env }, data: { updatedAt: new Date() } });
    if (!lock.count) throw new AccessError(404, "Nie znaleziono faktury.");
    await invoiceDocument(studioId, invoiceId, env, tx);
    const invoice = await tx.invoice.findFirstOrThrow({ where: { id: invoiceId }, include: { workOrder: { select: { client: { select: { email: true } } } } } });
    const recipient = invoice.workOrder.client.email?.trim();
    if (!recipient || !z.email().safeParse(recipient).success) throw new AccessError(400, "Uzupełnij poprawny adres e-mail nabywcy.");
    const pending = await tx.invoiceMail.findFirst({ where: { invoiceId, sentAt: null }, select: { id: true } });
    const mail = pending ?? await tx.invoiceMail.create({ data: { studioId, invoiceId, recipient }, select: { id: true } });
    return { id: mail.id, pending: true, emailedAt: invoice.emailedAt?.toISOString() ?? null };
  });
}

// SMTP ma semantykę at-least-once: awaria po przyjęciu wiadomości, przed commitem
// może spowodować powtórkę. Stały Message-ID pomaga odbiorcy ją rozpoznać.
export async function deliverInvoiceMails() {
  const smtpUrl = process.env.SMTP_URL ? new URL(process.env.SMTP_URL) : undefined;
  if (smtpUrl) for (const [key, value] of Object.entries({ connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000 })) smtpUrl.searchParams.set(key, String(value));
  const transport = smtpUrl ? createTransport(smtpUrl.toString()) : undefined;
  if (!transport && process.env.NODE_ENV === "production") return;
  const studios = await platformDb.studio.findMany({ select: { id: true } });
  for (const studio of studios) {
    const db = studioDb(studio.id);
    const pending = await db.invoiceMail.findMany({ where: { sentAt: null, nextAttemptAt: { lte: new Date() } }, take: 20, orderBy: { createdAt: "asc" } });
    for (const mail of pending) {
      try {
        await db.$transaction(async tx => {
          await tx.invoice.updateMany({ where: { id: mail.invoiceId }, data: { updatedAt: new Date() } });
          const claimed = await tx.invoiceMail.updateMany({ where: { id: mail.id, sentAt: null, nextAttemptAt: { lte: new Date() } }, data: { nextAttemptAt: new Date(Date.now() + 60_000) } });
          if (!claimed.count) return;
          const invoice = await tx.invoice.findFirstOrThrow({ where: { id: mail.invoiceId }, select: { number: true, ksefEnv: true } });
          const text = invoiceMailText(invoice.number, invoice.ksefEnv);
          if (!transport) {
            // Podgląd bez adresu, załącznika, XML ani tokenu. Nie jest dostarczeniem.
            console.info(`[invoices] podgląd e-maila (brak SMTP):\n${text}`);
            return;
          }
          const document = await invoiceDocument(studio.id, mail.invoiceId, invoice.ksefEnv, tx);
          const pdf = await generateInvoicePdf(document);
          const result = await transport.sendMail({
            from: process.env.EMAIL_FROM ?? "Detailflow <noreply@detailflow.local>",
            to: mail.recipient,
            messageId: `<invoice-mail-${mail.id}@detailflow.local>`,
            subject: `${invoice.ksefEnv === "test" ? "[TEST] " : ""}Faktura ${invoice.number}`,
            text,
            attachments: [{ filename: `${invoice.number.replace(/[^a-zA-Z0-9-]/g, "-")}-${invoice.ksefEnv}.pdf`, content: pdf, contentType: "application/pdf" }],
          });
          if (!result.accepted?.some((address: string) => address.toLowerCase() === mail.recipient.toLowerCase())) throw new Error("SMTP did not accept recipient");
          const sentAt = new Date();
          await tx.invoiceMail.updateMany({ where: { id: mail.id }, data: { sentAt, attempts: { increment: 1 } } });
          await tx.invoice.updateMany({ where: { id: mail.invoiceId }, data: { emailedAt: sentAt } });
        }, { timeout: 30_000 });
      } catch {
        // Nie zapisujemy surowych błędów SMTP (mogą zawierać dane lub hasło URL).
        await db.invoiceMail.updateMany({ where: { id: mail.id, sentAt: null }, data: {
          attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + Math.min(3_600_000, 30_000 * 2 ** Math.min(mail.attempts, 7))),
        } });
        console.error("[invoices] e-mail failed", { studioId: studio.id, notificationId: mail.id });
      }
    }
  }
}
