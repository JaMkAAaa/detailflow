import { createTransport, type Transporter } from "nodemailer";

// Maile auth (magiczny link, reset hasła). Lokalnie SMTP_URL = Mailpit.
// Szablony React Email dojdą z issue e-maili transakcyjnych; tu wystarczy tekst.

type AuthMail = { to: string; subject: string; text: string };

let transport: Transporter | undefined;

function getTransport(): Transporter | undefined {
  const url = process.env.SMTP_URL;
  if (!url) return undefined;
  transport ??= createTransport(url);
  return transport;
}

export async function sendAuthMail(mail: AuthMail): Promise<void> {
  const t = getTransport();
  if (!t) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP_URL is not set; cannot send auth e-mail");
    console.info(`[auth] e-mail do ${mail.to}: ${mail.subject}\n${mail.text}`);
    return;
  }
  await t.sendMail({ from: process.env.EMAIL_FROM ?? "Detailflow <noreply@detailflow.local>", ...mail });
}

/**
 * Wysyłka bez czekania na SMTP. Odpowiedź endpointu (i jej czas) nie może
 * zależeć od tego, czy konto istnieje — inaczej da się zgadywać e-maile.
 */
export function sendAuthMailInBackground(mail: AuthMail): void {
  sendAuthMail(mail).catch((error: unknown) => console.error("[auth] e-mail failed", error));
}
