import Decimal from "decimal.js";
import { z } from "zod";
import { Prisma, type InvoiceKind, type KsefEnv } from "@/lib/db/generated/client";
import { studioDb, type StudioDb } from "@/lib/db/tenant";
import { totals, validNip } from "@/components/faktury/model";
import { plDate } from "@/src/invoices/document";
import { AccessError } from "../acl";

const quantity = z.string().regex(/^\d{1,7}(\.\d{1,3})?$/);
const unitNet = z.string().regex(/^\d{1,9}(\.\d{1,2})?$/);
const nip = z.string().transform((value) => value.replace(/[ -]/g, "")).refine((value) => value === "" || validNip(value));

export const issueInput = z.object({
  workOrderId: z.string().min(1),
  buyer: z.object({
    name: z.string().trim().min(1).max(200), nip: nip.optional(),
    street: z.string().trim().min(1).max(200), postal: z.string().regex(/^\d{2}-\d{3}$/), city: z.string().trim().min(1).max(100),
  }).strict(),
  items: z.array(z.object({
    name: z.string().trim().min(1).max(200), quantity: quantity.refine((value) => new Decimal(value).gt(0)), unitNet,
    vatRate: z.union([z.literal(23), z.literal(8), z.literal(5), z.literal(0)]),
  }).strict()).min(1).max(50),
  dueDays: z.number().int().min(0).max(90).default(7),
}).strict();

export const correctionInput = z.object({
  reason: z.string().trim().min(1).max(1000),
  // Stan pozycji po korekcie; pominięte pozycje zostają bez zmian. Ilość 0 = pozycja usunięta.
  items: z.array(z.object({ lp: z.number().int().min(1), quantity, unitNet }).strict()).min(1).max(50),
}).strict();

export const paidInput = z.object({ paidAt: z.iso.datetime().optional() }).strict();

const PREFIX = { invoice: "FV", correction: "KFV" } as const satisfies Record<InvoiceKind, string>;

const lineAmounts = (qty: Decimal.Value, price: Decimal.Value, vatRate: number) => {
  const net = new Decimal(price).times(qty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return { net, vat: net.times(vatRate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) };
};

async function inTransaction<T>(studioId: string, run: (tx: StudioDb) => Promise<T>): Promise<T> {
  try {
    return await studioDb(studioId).$transaction((tx) => run(tx as unknown as StudioDb), { isolationLevel: "Serializable" });
  } catch (error) {
    // Równoległe wystawienie tego samego dokumentu albo numeru kończy się konfliktem, nie duplikatem.
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2002")) {
      throw new AccessError(409, "Dokument jest właśnie wystawiany lub zmieniany. Odśwież stronę i spróbuj ponownie.");
    }
    throw error;
  }
}

/**
 * Następny numer FV/n/MM/RRRR (korekta: KFV/…). Licznik jest osobny dla studia, środowiska,
 * rodzaju i roku, więc TEST i PROD nie dzielą numeracji. Brakujący licznik startuje od
 * najwyższego istniejącego numeru (np. FV/41 z seeda).
 */
export async function allocateInvoiceNumber(db: Pick<StudioDb, "invoiceCounter" | "invoice">, studioId: string, ksefEnv: KsefEnv, kind: InvoiceKind, at: Date) {
  const [year, month] = plDate(at).split("-").map(Number) as [number, number];
  const key = { studioId_ksefEnv_kind_year: { studioId, ksefEnv, kind, year } };
  if (!await db.invoiceCounter.findUnique({ where: key })) {
    const pattern = new RegExp(`^${PREFIX[kind]}/(\\d+)/\\d{2}/${year}$`);
    const rows = await db.invoice.findMany({ where: { ksefEnv, kind, number: { endsWith: `/${year}` } }, select: { number: true } });
    const highest = rows.reduce((max, { number }) => Math.max(max, Number(pattern.exec(number)?.[1] ?? 0)), 0);
    await db.invoiceCounter.createMany({ data: [{ studioId, ksefEnv, kind, year, last: highest }], skipDuplicates: true });
  }
  const { last } = await db.invoiceCounter.update({ where: key, data: { last: { increment: 1 } }, select: { last: true } });
  return `${PREFIX[kind]}/${last}/${String(month).padStart(2, "0")}/${year}`;
}

/** Faktura powstaje wyłącznie ze zleceniem zakończonym (`completed` z datą zakończenia). */
export async function issueInvoice(studioId: string, ksefEnv: KsefEnv, input: unknown) {
  const data = issueInput.parse(input);
  const { lines, net, vat, gross } = totals(data.items.map((item) => ({ ...item, discount: "0" })));
  return inTransaction(studioId, async (tx) => {
    const order = await tx.workOrder.findFirst({ where: { id: data.workOrderId } });
    if (!order) throw new AccessError(404, "Nie znaleziono zlecenia.");
    if (order.status !== "completed" || !order.completedAt) {
      throw new AccessError(409, `Zlecenie #${order.number} nie jest zakończone. Fakturę wystawia się dopiero po jego zakończeniu.`);
    }
    if (!gross.eq(order.totalGross)) throw new AccessError(400, "Suma brutto faktury musi być równa kwocie zlecenia.");
    if (await tx.invoice.findFirst({ where: { workOrderId: order.id, ksefEnv, kind: "invoice", status: { not: "canceled" } }, select: { id: true } })) {
      throw new AccessError(409, `Zlecenie #${order.number} ma już fakturę. Zmiany wprowadź korektą.`);
    }
    const issuedAt = new Date();
    const number = await allocateInvoiceNumber(tx, studioId, ksefEnv, "invoice", issuedAt);
    const invoice = await tx.invoice.create({ data: {
      studioId, number, workOrderId: order.id, status: "issued", kind: "invoice", ksefEnv,
      buyerName: data.buyer.name, buyerNip: data.buyer.nip || null, buyerStreet: data.buyer.street, buyerPostal: data.buyer.postal, buyerCity: data.buyer.city,
      issuedAt, saleAt: order.completedAt, dueAt: new Date(issuedAt.getTime() + data.dueDays * 86_400_000),
      totalNet: net.toFixed(2), totalVat: vat.toFixed(2), totalGross: gross.toFixed(2),
      items: { create: lines.map((line, index) => ({ lp: index + 1, name: line.name, quantity: line.quantity, unit: "usł.", unitNet: line.unitNet, vatRate: line.vatRate,
        net: line.net.toFixed(2), vat: line.vat.toFixed(2), gross: line.gross.toFixed(2) })) },
      events: { create: [{ kind: "issued", at: issuedAt, message: `Wystawiono, numer ${number}` }] },
    }, select: { id: true, number: true, ksefEnv: true, totalGross: true } });
    return { ...invoice, totalGross: invoice.totalGross.toFixed(2) };
  });
}

/**
 * Korekta: osobny dokument powiązany z fakturą źródłową. Kwoty dokumentu to różnica
 * względem stanu przed korektą (kolejna korekta liczy od poprzedniej), ilość i cena
 * pozycji to stan po korekcie.
 */
export async function correctInvoice(studioId: string, invoiceId: string, input: unknown) {
  const data = correctionInput.parse(input);
  return inTransaction(studioId, async (tx) => {
    const source = await tx.invoice.findFirst({ where: { id: invoiceId }, include: {
      items: { where: { studioId }, orderBy: { lp: "asc" } },
      corrections: { where: { studioId }, orderBy: { createdAt: "desc" }, take: 1, include: { items: { where: { studioId }, orderBy: { lp: "asc" } } } },
    } });
    if (!source) throw new AccessError(404, "Nie znaleziono faktury.");
    if (source.kind !== "invoice") throw new AccessError(409, "Korektę wystawia się do faktury, nie do innej korekty.");
    if (source.status !== "issued") throw new AccessError(409, "Korektę można wystawić tylko do wystawionej faktury.");
    if (source.ksefStatus !== "accepted") throw new AccessError(409, "Korektę można wystawić po przyjęciu faktury w KSeF.");
    const previous = source.corrections[0];
    const before = (previous?.items ?? source.items).map((line) => ({
      line, ...(previous ? lineAmounts(line.quantity, line.unitNet, line.vatRate) : { net: line.net, vat: line.vat }),
    }));
    const requested = new Map<number, (typeof data.items)[number]>();
    for (const item of data.items) {
      if (requested.has(item.lp) || !before.some(({ line }) => line.lp === item.lp)) throw new AccessError(400, "Nieprawidłowe pozycje korekty.");
      requested.set(item.lp, item);
    }
    let changed = false;
    const rows = before.map(({ line, net: netBefore, vat: vatBefore }) => {
      const after = requested.get(line.lp);
      const qty = new Decimal(after?.quantity ?? line.quantity), price = new Decimal(after?.unitNet ?? line.unitNet);
      if (!qty.eq(line.quantity) || !price.eq(line.unitNet)) changed = true;
      const next = lineAmounts(qty, price, line.vatRate);
      const net = next.net.minus(netBefore), vat = next.vat.minus(vatBefore);
      return { lp: line.lp, name: line.name, unit: line.unit, vatRate: line.vatRate, quantity: qty.toFixed(3), unitNet: price.toFixed(2), net, vat, gross: net.plus(vat) };
    });
    if (!changed) throw new AccessError(400, "Korekta nie zmienia żadnej pozycji.");
    const sum = (field: "net" | "vat" | "gross") => Decimal.sum(0, ...rows.map((row) => row[field]));
    const issuedAt = new Date();
    const number = await allocateInvoiceNumber(tx, studioId, source.ksefEnv, "correction", issuedAt);
    const correction = await tx.invoice.create({ data: {
      studioId, number, workOrderId: source.workOrderId, status: "issued", kind: "correction", ksefEnv: source.ksefEnv,
      correctsInvoiceId: source.id, correctionReason: data.reason,
      buyerName: source.buyerName, buyerNip: source.buyerNip, buyerStreet: source.buyerStreet, buyerPostal: source.buyerPostal, buyerCity: source.buyerCity,
      issuedAt, saleAt: source.saleAt,
      totalNet: sum("net").toFixed(2), totalVat: sum("vat").toFixed(2), totalGross: sum("gross").toFixed(2),
      items: { create: rows.map((row) => ({ ...row, net: row.net.toFixed(2), vat: row.vat.toFixed(2), gross: row.gross.toFixed(2) })) },
      events: { create: [{ kind: "issued", at: issuedAt, message: `Wystawiono korektę ${number} do ${source.number}` }] },
    }, select: { id: true, number: true, ksefEnv: true, totalGross: true } });
    return { ...correction, correctsNumber: source.number, totalGross: correction.totalGross.toFixed(2) };
  });
}

/** Płatność ręczna (przelew). Stripe Checkout klienta jest poza v1. */
export async function markInvoicePaid(studioId: string, invoiceId: string, input: unknown) {
  const data = paidInput.parse(input ?? {});
  const now = new Date();
  const paidAt = data.paidAt ? new Date(data.paidAt) : now;
  if (paidAt.getTime() > now.getTime() + 5 * 60_000) throw new AccessError(400, "Data płatności nie może być z przyszłości.");
  const db = studioDb(studioId);
  const invoice = await db.invoice.findFirst({ where: { id: invoiceId }, select: { number: true, kind: true, status: true, issuedAt: true, paidAt: true } });
  if (!invoice) throw new AccessError(404, "Nie znaleziono faktury.");
  if (invoice.kind !== "invoice") throw new AccessError(409, "Płatność oznacza się na fakturze, nie na korekcie.");
  if (invoice.status !== "issued") throw new AccessError(409, "Tylko wystawioną fakturę można oznaczyć jako opłaconą.");
  if (invoice.issuedAt && paidAt < invoice.issuedAt) throw new AccessError(400, "Data płatności nie może być wcześniejsza niż data wystawienia.");
  // Warunek paidAt: null czyni oznaczenie atomowym: równoległy drugi klik nie nadpisze daty.
  const updated = await db.invoice.updateMany({ where: { id: invoiceId, kind: "invoice", status: "issued", paidAt: null }, data: { paidAt } });
  if (!updated.count) throw new AccessError(409, "Faktura jest już oznaczona jako opłacona.");
  return { id: invoiceId, number: invoice.number, paid: true, paidAt: paidAt.toISOString() };
}
