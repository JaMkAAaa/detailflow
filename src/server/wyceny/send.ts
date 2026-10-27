import { z } from "zod";
import { Prisma } from "@/lib/db/generated/client";
import { studioDb } from "@/lib/db/tenant";
import { AccessError } from "../acl";
import { calculatePricing } from "@/src/domain/pricing";

const money = z.string().regex(/^\d{1,8}(\.\d{1,2})?$/);
export const quoteInput = z.object({
  clientId: z.string().min(1), vehicleId: z.string().min(1),
  size: z.enum(["small", "medium", "suv"]),
  paintMult: z.enum(["1.00", "1.20", "1.40"]),
  notes: z.string().max(2000),
  items: z.array(z.object({
    name: z.string().trim().min(1).max(120), basePrice: money,
    durationMin: z.number().int().min(0).max(100000).nullable(),
  }).strict()).min(1).max(50),
}).strict();

// ID tworzy klient przed pierwszym zapisem: retry PUT nie tworzy drugiej wyceny.
export async function saveQuote(studioId: string, id: string, input: unknown) {
  z.uuid().parse(id);
  const data = quoteInput.parse(input);
  const items = data.items.map((item, sort) => ({ ...item, basePrice: new Prisma.Decimal(item.basePrice), studioId, sort }));
  const totals = calculatePricing({ services: items, size: data.size, paintMult: new Prisma.Decimal(data.paintMult) });
  if (totals.totalGross.gt("9999999999.99")) throw new AccessError(400, "Kwota wyceny jest zbyt duża.");
  const db = studioDb(studioId);
  return db.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.findFirst({ where: { id: data.vehicleId, clientId: data.clientId } });
    if (!vehicle) throw new AccessError(404, "Nie znaleziono klienta lub samochodu.");
    const existing = await tx.quote.findFirst({ where: { id } });
    const values = { clientId: data.clientId, vehicleId: data.vehicleId, notes: data.notes,
      sizeMult: { small: "1.00", medium: "1.20", suv: "1.35" }[data.size], paintMult: data.paintMult,
      totalGross: totals.totalGross, vatAmount: totals.vatAmount };
    if (existing) {
      // Blokada serializuje zapis pozycji z wysyłką/decyzją portalu.
      const locked = await tx.quote.updateMany({ where: { id, status: "draft" }, data: values });
      if (!locked.count) throw new AccessError(403, "Wysłanej wyceny nie można edytować.");
      await tx.quoteItem.deleteMany({ where: { quoteId: id } });
    } else {
      await tx.quote.create({ data: { id, studioId, status: "draft", ...values } });
    }
    await tx.quoteItem.createMany({ data: items.map((item) => ({ ...item, quoteId: id })) });
    return tx.quote.findFirstOrThrow({ where: { id }, include: { items: { orderBy: { sort: "asc" } } } });
  }, { isolationLevel: "Serializable" });
}

export async function sendQuote(studioId: string, id: string) {
  const db = studioDb(studioId);
  return db.$transaction(async (tx) => {
    const changed = await tx.quote.updateMany({ where: { id, status: { in: ["draft", "sent"] }, decidedAt: null }, data: { status: "sent" } });
    if (!changed.count) throw new AccessError(404, "Nie znaleziono wyceny gotowej do wysłania.");
    const quote = await tx.quote.findFirstOrThrow({ where: { id }, include: { client: true, items: true } });
    if (!quote.client.email || !z.email().safeParse(quote.client.email).success) throw new AccessError(403, "Uzupełnij poprawny e-mail klienta przed wysyłką.");
    if (!quote.items.length) throw new AccessError(403, "Dodaj pozycje wyceny.");
    // Powtórne kliknięcie, gdy job oczekuje, scala się z oczekującą wysyłką.
    await tx.quoteSendMail.upsert({ where: { quoteId: id },
      create: { studioId, quoteId: id }, update: { sentAt: null, createdAt: new Date() } });
    return { id, status: "sent", queued: true };
  });
}
