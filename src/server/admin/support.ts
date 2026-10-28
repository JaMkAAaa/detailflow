import { randomBytes } from "node:crypto";
import type { SupportPriority, SupportTicketStatus } from "@/lib/db/generated/client";
import { platformDb } from "@/lib/db/client";
import { BILLING_PLANS } from "@/src/server/billing/plans";
import { STATUS_LABEL } from "./accounts";
import { PlatformError } from "./errors";

export const SLA_MS = { normal: 8 * 60 * 60 * 1000, urgent: 60 * 60 * 1000 } as const;

export function slaState(status: SupportTicketStatus, due: Date, now: Date) {
  if (status === "resolved") return "done" as const;
  return now.getTime() > due.getTime() ? "breached" as const : "ok" as const;
}

export function slaRemaining(due: Date, now: Date) {
  const minutes = Math.floor(Math.abs(due.getTime() - now.getTime()) / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const body = hours > 0 ? `${hours} godz. ${rest} min` : `${minutes} min`;
  return due.getTime() >= now.getTime() ? body : `${body} po terminie`;
}

const PRIORITY_LABEL = { normal: "Zwykły", urgent: "Pilny" } as const;
const STATUS_TEXT = { open: "Otwarte", waiting: "Czeka na studio", resolved: "Zamknięte" } as const;

function clean(value: string, max: number) {
  const text = value.trim();
  if (!text) throw new PlatformError("Uzupełnij treść.");
  if (text.length > max) throw new PlatformError("Treść jest za długa.");
  return text;
}

export async function openTicket(actorId: string, input: {
  publicCode: string;
  subject: string;
  body: string;
  priority: SupportPriority;
  now?: Date;
}) {
  const subject = input.subject.trim();
  if (subject.length < 3 || subject.length > 140) throw new PlatformError("Temat ma mieć od 3 do 140 znaków.");
  const body = clean(input.body, 4000);
  const studio = await platformDb.studio.findUnique({
    where: { publicCode: input.publicCode.trim() },
    select: { id: true },
  });
  if (!studio) throw new PlatformError("Nie ma takiego studia.");
  const now = input.now ?? new Date();
  const priority = input.priority === "urgent" ? "urgent" : "normal";
  const publicCode = `TK-${randomBytes(4).toString("hex").toUpperCase()}`;
  const ticket = await platformDb.$transaction(async (tx) => {
    const created = await tx.supportTicket.create({
      data: {
        publicCode,
        studioId: studio.id,
        subject,
        priority,
        slaDueAt: new Date(now.getTime() + SLA_MS[priority]),
        openedAt: now,
        assigneeId: actorId,
      },
      select: { id: true, publicCode: true, slaDueAt: true },
    });
    await tx.supportMessage.create({
      data: { ticketId: created.id, studioId: studio.id, authorId: actorId, fromStudio: false, body },
    });
    await tx.auditLog.create({
      data: { actorId, studioId: studio.id, action: "support.ticket.opened", meta: { ticketCode: created.publicCode } },
    });
    return created;
  });
  return ticket;
}

export async function replyToTicket(actorId: string, publicCode: string, body: string) {
  const text = clean(body, 4000);
  const ticket = await platformDb.supportTicket.findUnique({
    where: { publicCode },
    select: { id: true, studioId: true },
  });
  if (!ticket) throw new PlatformError("Nie ma takiego zgłoszenia.");
  await platformDb.$transaction([
    platformDb.supportMessage.create({
      data: { ticketId: ticket.id, studioId: ticket.studioId, authorId: actorId, fromStudio: false, body: text },
    }),
    platformDb.supportTicket.update({
      where: { id: ticket.id },
      data: { status: "waiting", resolvedAt: null, assigneeId: actorId },
    }),
    platformDb.auditLog.create({
      data: { actorId, studioId: ticket.studioId, action: "support.ticket.replied", meta: { ticketCode: publicCode } },
    }),
  ]);
}

export async function resolveTicket(actorId: string, publicCode: string, now = new Date()) {
  const ticket = await platformDb.supportTicket.findUnique({
    where: { publicCode },
    select: { id: true, studioId: true, status: true },
  });
  if (!ticket) throw new PlatformError("Nie ma takiego zgłoszenia.");
  if (ticket.status === "resolved") return;
  await platformDb.$transaction([
    platformDb.supportTicket.update({
      where: { id: ticket.id },
      data: { status: "resolved", resolvedAt: now, assigneeId: actorId },
    }),
    platformDb.auditLog.create({
      data: { actorId, studioId: ticket.studioId, action: "support.ticket.resolved", meta: { ticketCode: publicCode } },
    }),
  ]);
}

export async function getSupportQueue(selectedCode: string | null, now = new Date()) {
  const rows = await platformDb.supportTicket.findMany({
    take: 80,
    orderBy: { slaDueAt: "asc" },
    select: {
      publicCode: true,
      subject: true,
      status: true,
      priority: true,
      slaDueAt: true,
      studio: { select: { publicCode: true, name: true } },
    },
  });
  const rank: Record<SupportTicketStatus, number> = { open: 0, waiting: 1, resolved: 2 };
  const tickets = rows
    .slice()
    .sort((a, b) => rank[a.status] - rank[b.status] || a.slaDueAt.getTime() - b.slaDueAt.getTime())
    .map((ticket) => ({
      publicCode: ticket.publicCode,
      subject: ticket.subject,
      status: ticket.status,
      statusLabel: STATUS_TEXT[ticket.status],
      priorityLabel: PRIORITY_LABEL[ticket.priority],
      sla: slaState(ticket.status, ticket.slaDueAt, now),
      remaining: slaRemaining(ticket.slaDueAt, now),
      studioName: ticket.studio.name,
      studioCode: ticket.studio.publicCode,
    }));
  if (!selectedCode) return { tickets, selected: null };
  const selected = await platformDb.supportTicket.findUnique({
    where: { publicCode: selectedCode },
    select: {
      publicCode: true,
      subject: true,
      status: true,
      priority: true,
      slaDueAt: true,
      studio: { select: { publicCode: true, name: true, status: true, plan: true, city: true, phone: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, body: true, fromStudio: true, createdAt: true },
      },
    },
  });
  if (!selected) return { tickets, selected: null };
  return {
    tickets,
    selected: {
      publicCode: selected.publicCode,
      subject: selected.subject,
      status: selected.status,
      statusLabel: STATUS_TEXT[selected.status],
      priorityLabel: PRIORITY_LABEL[selected.priority],
      sla: slaState(selected.status, selected.slaDueAt, now),
      remaining: slaRemaining(selected.slaDueAt, now),
      studio: {
        publicCode: selected.studio.publicCode,
        name: selected.studio.name,
        statusLabel: STATUS_LABEL[selected.studio.status],
        planName: BILLING_PLANS[selected.studio.plan].name,
        city: selected.studio.city,
        phone: selected.studio.phone,
      },
      messages: selected.messages.map((message) => ({
        id: message.id,
        body: message.body,
        fromStudio: message.fromStudio,
        at: message.createdAt.toISOString(),
      })),
    },
  };
}
