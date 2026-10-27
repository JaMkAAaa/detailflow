import { z } from "zod";
import { Prisma } from "../../../lib/db/generated/client";
import { studioDb } from "../../../lib/db/tenant";
import { quoteSlots } from "../../domain/quote-options";
import { calculatePricing } from "../../domain/pricing";
import { AccessError } from "../acl";
import { money } from "./catalog";

const itemSchema = z.object({
  serviceId: z.string().min(1), name: z.string().trim().min(1).max(120),
  basePrice: money, durationMin: z.number().int().min(0).max(60000),
});
export const quoteSchema = z.object({
  id: z.string().min(1), revision: z.number().int().min(0),
  clientId: z.string().min(1), vehicleId: z.string().min(1),
  size: z.enum(["small", "medium", "suv"]), paint: z.enum(["standard", "worn", "heavy"]),
  interior: z.enum(["Lekkie", "Umiarkowane", "Silne"]),
  step: z.number().int().min(1).max(3), slotId: z.enum(["oct24", "oct26", "oct28"]).nullable(),
  notes: z.string().max(2000), items: z.array(itemSchema).max(50),
}).refine((data) => new Set(data.items.map((item) => item.serviceId)).size === data.items.length, "Powtórzona usługa");

export class QuoteConflict extends Error {
  constructor() { super("Wycena została zmieniona lub oczekuje na wysyłkę. Odśwież stronę."); }
}

/** Optymistyczna rewizja blokuje równoległe nadpisanie szkicu i wyścig z wysyłką. */
export async function saveQuote(studioId: string, authorId: string, input: unknown) {
  const data = quoteSchema.parse(input);
  const db = studioDb(studioId);
  return db.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.findFirst({ where: { id: data.vehicleId, clientId: data.clientId } });
    if (!vehicle) throw new AccessError(404, "Nie znaleziono klienta lub samochodu.");
    const services = await tx.service.count({ where: { id: { in: data.items.map((item) => item.serviceId) } } });
    if (services !== data.items.length) throw new AccessError(404, "Nie znaleziono usługi.");
    const paintMult = new Prisma.Decimal({ standard: "1.00", worn: "1.20", heavy: "1.40" }[data.paint]);
    const sizeMult = new Prisma.Decimal({ small: "1.00", medium: "1.20", suv: "1.35" }[data.size]);
    const totals = calculatePricing({ size: data.size, paintMult, services: data.items.map((item) => ({ ...item, basePrice: new Prisma.Decimal(item.basePrice) })) });
    if (totals.totalGross.gt("9999999999.99")) throw new RangeError("Kwota wyceny jest zbyt duża.");
    const existing = await tx.quote.findFirst({ where: { id: data.id } });
    const values = { clientId: data.clientId, vehicleId: data.vehicleId, size: data.size, sizeMult, paintMult, totalGross: totals.totalGross, vatAmount: totals.vatAmount, interior: data.interior, slotId: data.slotId, wizardStep: data.step, notes: data.notes };
    if (existing) {
      const pending = await tx.quoteEmail.count({ where: { quoteId: data.id, sentAt: null } });
      if (pending) throw new QuoteConflict();
      const updated = await tx.quote.updateMany({ where: { id: data.id, revision: data.revision, status: "draft" }, data: { ...values, revision: { increment: 1 } } });
      if (!updated.count) throw new QuoteConflict();
      await tx.quoteItem.deleteMany({ where: { quoteId: data.id } });
    } else {
      if (data.revision !== 0) throw new AccessError(404, "Nie znaleziono wyceny.");
      await tx.quote.create({ data: { ...values, id: data.id, studioId, authorId, status: "draft", revision: 1 } });
    }
    await tx.quoteItem.createMany({ data: data.items.map((item, sort) => ({ ...item, studioId, quoteId: data.id, sort })) });
    return { id: data.id, revision: data.revision + 1 };
  });
}

/** Nie zapisuje pozycji ponownie. Równoległe kliknięcia współdzielą pending outbox. */
export async function sendQuote(studioId: string, quoteId: string, appUrl: string) {
  const db = studioDb(studioId);
  return db.$transaction(async (tx) => {
    const quote = await tx.quote.findFirst({ where: { id: quoteId }, include: { studio: { select: { name: true, phone: true } }, client: true, vehicle: true, items: { orderBy: { sort: "asc" } } } });
    if (!quote) throw new AccessError(404, "Nie znaleziono wyceny.");
    if (!["draft", "sent"].includes(quote.status)) throw new QuoteConflict();
    // CAS na Quote serializuje zapis, wysyłkę i ponowną wysyłkę w studiu.
    const locked = await tx.quote.updateMany({ where: { id: quoteId, revision: quote.revision }, data: { revision: { increment: 1 } } });
    if (!locked.count) throw new QuoteConflict();
    const pending = await tx.quoteEmail.findFirst({ where: { quoteId, sentAt: null } });
    if (pending) return { emailId: pending.id };
    const recipient = z.email().safeParse(quote.client.email);
    if (!recipient.success) throw new Error("Uzupełnij poprawny adres e-mail klienta.");
    if (!quote.items.length) throw new Error("Dodaj co najmniej jedną usługę.");
    // Stub do E8.2: nie tworzy uprawnienia dostępu ani tokena portalu.
    const portalUrl = new URL("/p/quote-preview", appUrl).href;
    const slot = quoteSlots.find((slot) => slot.id === quote.slotId);
    const text = [
      `Dzień dobry ${quote.client.name},`,
      `przesyłamy wycenę dla ${quote.vehicle.make} ${quote.vehicle.model} · ${quote.vehicle.plate}.`,
      ...quote.items.map((item) => `• ${item.name}`),
      `Łącznie: ${quote.totalGross.toFixed(2)} PLN brutto (VAT 23%: ${quote.vatAmount.toFixed(2)} PLN).`,
      slot ? `Proponowane przyjęcie: ${slot.start}. Planowany odbiór: ${slot.pickup}. ${slot.bay}. Termin nie rezerwuje boksu.` : "",
      quote.notes ?? "",
      `Portal klienta (podgląd — dostęp zostanie uruchomiony wkrótce): ${portalUrl}`,
      `Zespół ${quote.studio.name}${quote.studio.phone ? ` · ${quote.studio.phone}` : ""}`,
    ].filter(Boolean).join("\n\n");
    const email = await tx.quoteEmail.create({ data: { studioId, quoteId, recipient: recipient.data, subject: `Wycena · ${quote.vehicle.make} ${quote.vehicle.model}`, text } });
    return { emailId: email.id };
  });
}
