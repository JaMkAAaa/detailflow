import { createTransport } from "nodemailer";
import { studioDb } from "../../../lib/db/tenant";

export type QuoteEmailJob = { studioId: string; emailId: string };

/** Ponowienie zakończonego joba jest no-op. SMTP może dostarczyć ponownie po awarii
 * między akceptacją wiadomości a commitem; stały Message-ID ułatwia deduplikację. */
export async function deliverQuoteEmail({ studioId, emailId }: QuoteEmailJob, send = smtpSend) {
  const db = studioDb(studioId);
  const email = await db.quoteEmail.findFirst({ where: { id: emailId } });
  if (!email || email.sentAt) return;
  await send({ to: email.recipient, subject: email.subject, text: email.text, messageId: `<quote-${email.id}@detailflow.local>` });
  const sentAt = new Date();
  await db.$transaction(async (tx) => {
    await tx.quoteEmail.updateMany({ where: { id: emailId, sentAt: null }, data: { sentAt } });
    await tx.quote.updateMany({ where: { id: email.quoteId, status: { in: ["draft", "sent"] } }, data: { status: "sent", sentAt, revision: { increment: 1 } } });
  });
}

type Mail = { to: string; subject: string; text: string; messageId: string };
let transport: ReturnType<typeof createTransport> | undefined;
async function smtpSend(mail: Mail) {
  if (!process.env.SMTP_URL) throw new Error("SMTP_URL is required for quote e-mail");
  transport ??= createTransport(process.env.SMTP_URL);
  const response = await transport.sendMail({ ...mail, from: process.env.EMAIL_FROM ?? "Detailflow <noreply@detailflow.local>" });
  if (!response.accepted?.length) throw new Error("SMTP did not accept the recipient");
}
