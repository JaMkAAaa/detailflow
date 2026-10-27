import { studioDb } from "@/lib/db/tenant";
import type { Environment, InvoiceView, Order, Seller } from "@/components/faktury/model";

export async function invoiceSeller(studioId: string, userId: string): Promise<Seller> {
  const { studio } = await studioDb(studioId).membership.findFirstOrThrow({ where: { studioId, userId }, select: { studio: { select: { name: true, ownerLegalName: true, nip: true, address: true, postal: true, city: true, ksefEnv: true } } } });
  return { name: studio.ownerLegalName ?? studio.name, nip: studio.nip ?? "", address: studio.address ?? "", postal: studio.postal ?? "", city: studio.city ?? "", env: studio.ksefEnv };
}
export async function invoiceRecord(studioId: string, where: { id: string } | { number: string; ksefEnv: Environment }) {
  return studioDb(studioId).invoice.findFirst({ where: { ...where, studioId }, include: {
    items: { where: { studioId }, orderBy: { lp: "asc" } }, events: { where: { studioId }, orderBy: [{ at: "desc" }, { kind: "desc" }] },
    workOrder: { select: { number: true, client: { select: { email: true } } } },
  } });
}
export async function invoiceDetail(studioId: string, number: string, env: Environment): Promise<InvoiceView | null> {
  const invoice = await invoiceRecord(studioId, { number, ksefEnv: env });
  if (!invoice) return null;
  return {
    id: invoice.id, number: invoice.number, env: invoice.ksefEnv, status: invoice.status, ksefStatus: invoice.ksefStatus, ksefNumber: invoice.ksefNumber,
    acceptedAt: invoice.ksefAcceptedAt?.toISOString() ?? null, issuedAt: invoice.issuedAt?.toISOString() ?? null, saleAt: invoice.saleAt?.toISOString() ?? null,
    dueAt: invoice.dueAt?.toISOString() ?? null, paidAt: invoice.paidAt?.toISOString() ?? null, emailedAt: invoice.emailedAt?.toISOString() ?? null, upoXml: invoice.ksefUpoXml,
    orderNumber: invoice.workOrder.number,
    buyer: { name: invoice.buyerName, nip: invoice.buyerNip ?? "", street: invoice.buyerStreet ?? "", postal: invoice.buyerPostal ?? "", city: invoice.buyerCity ?? "", email: invoice.workOrder.client.email ?? "" },
    items: invoice.items.map(item => ({ name: item.name, quantity: item.quantity.toString(), unitNet: item.unitNet.toString(), vatRate: item.vatRate, discount: "0" })),
    totalNet: invoice.totalNet.toString(), totalVat: invoice.totalVat.toString(), totalGross: invoice.totalGross.toString(),
    events: invoice.events.map(event => ({ id: event.id, kind: event.kind, at: event.at.toISOString(), message: event.message, ref: event.ref })),
  };
}
export async function invoiceOrders(studioId: string, env: Environment): Promise<Order[]> {
  const orders = await studioDb(studioId).workOrder.findMany({ where: { studioId, status: "completed", completedAt: { not: null } }, orderBy: { completedAt: "desc" }, include: {
    client: true, vehicle: true,
    invoices: { where: { studioId, ksefEnv: env }, orderBy: { createdAt: "asc" }, take: 1, include: { items: { where: { studioId }, orderBy: { lp: "asc" } } } },
  } });
  return orders.map(order => {
    // Istniejąca FV jest źródłem pozycji scenariusza demo. Bez niej zakres pochodzi ze zlecenia.
    const source = order.invoices[0]?.items;
    const items = source?.length ? source.map(item => ({ name: item.name, quantity: item.quantity.toString(), unitNet: item.unitNet.toString(), vatRate: item.vatRate, discount: "0" }))
      : [{ name: order.service, quantity: "1", unitNet: order.totalGross.div("1.23").toFixed(2), vatRate: 23, discount: "0" }];
    return { id: order.id, number: order.number, vehicle: `${order.vehicle.make} ${order.vehicle.model}`, completedAt: order.completedAt!.toISOString(),
      buyer: { name: order.client.name, nip: order.client.nip ?? "", street: order.client.street ?? "", postal: order.client.postal ?? "", city: order.client.city ?? "", email: order.client.email ?? "" }, items };
  });
}
