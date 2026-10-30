import { createTransport } from "nodemailer";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";

const DAY = 86_400_000;
/** Codzienny sweep; retry po awarii SMTP i catch-up po przestoju workera. */
export async function sendTrialReminders(now = new Date()) {
  if (!process.env.SMTP_URL || !process.env.APP_URL) return;
  const transport = createTransport(process.env.SMTP_URL);
  // Discovery jest operacją platformy. Odczyt odbiorców odbywa się przez studioDb.
  const studios = await platformDb.studio.findMany({
    where: { status: "trial", trialReminderSentAt: null, trialEndsAt: { gt: now, lte: new Date(now.getTime() + 3 * DAY) } },
    select: { id: true },
  });
  let failed = false;
  for (const { id: studioId } of studios) {
    try {
      await platformDb.$transaction(async tx => {
        // Ten sam lock co webhook/Checkout: po aktywacji nie wysyłamy przypomnienia.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${studioId}, 50))::text`;
        const studio = await tx.studio.findUniqueOrThrow({ where: { id: studioId } });
        if (studio.status !== "trial" || studio.trialReminderSentAt || !studio.trialEndsAt || studio.trialEndsAt <= now || studio.trialEndsAt.getTime() > now.getTime() + 3 * DAY) return;
        const owners = await studioDb(studioId).membership.findMany({
          where: { role: "owner" }, select: { user: { select: { email: true, trialReminderEnabled: true } } },
        });
        if (!owners.length) throw new Error("Missing studio owner");
        const recipients = owners.filter(owner => owner.user.trialReminderEnabled);
        if (recipients.length) await transport.sendMail({
          from: process.env.EMAIL_FROM ?? "Detailflow <noreply@detailflow.local>",
          to: recipients.map(owner => owner.user.email),
          messageId: `<trial-${studioId}-${studio.trialEndsAt.getTime()}@detailflow.local>`,
          subject: "Detailflow — Twój okres próbny wkrótce się kończy",
          text: `Okres próbny studia ${studio.name} kończy się ${studio.trialEndsAt.toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })}.\n\nPo jego zakończeniu dane pozostaną dostępne tylko do odczytu. Aby dalej pracować, wybierz abonament po zakończeniu trialu: ${new URL("/billing", process.env.APP_URL).href}\n\nTrial nie wymaga karty i nie powoduje automatycznego obciążenia.`,
        });
        await tx.studio.update({ where: { id: studioId }, data: { trialReminderSentAt: now } });
      }, { timeout: 30_000 });
    } catch {
      failed = true;
      console.error("[billing] trial reminder failed", { studioId });
    }
  }
  if (failed) throw new Error("Nie wysłano części przypomnień trialu.");
}
