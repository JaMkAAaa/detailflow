import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL ??= "http://localhost:3000";
  process.env.AUTH_SECRET ??= "test-secret-0123456789abcdef0123456789";
});

import { platformDb } from "@/lib/db/client";
import { SLA_MS, openTicket, replyToTicket, resolveTicket, slaState } from "./support";

const tag = randomUUID();
const ids: string[] = [];
let actorId = "";

afterAll(async () => {
  await platformDb.auditLog.deleteMany({ where: { studioId: { in: ids } } });
  await platformDb.studio.deleteMany({ where: { id: { in: ids } } });
  if (actorId) await platformDb.user.deleteMany({ where: { id: actorId } });
});

describe("zgłoszenia i SLA", () => {
  it("trzyma pilne w godzinie, zwykłe w ośmiu, i nie dopisuje odpowiedzi do innego studia", async () => {
    const now = new Date("2026-10-28T12:00:00.000Z");
    expect(slaState("open", new Date(now.getTime() - 1), now)).toBe("breached");
    expect(slaState("resolved", new Date(now.getTime() - 1), now)).toBe("done");
    actorId = (await platformDb.user.create({ data: { name: tag, email: `${tag}@example.com` } })).id;
    const studios = await Promise.all(["a", "b"].map((suffix) => platformDb.studio.create({
      data: { name: `${tag} ${suffix}`, slug: `${tag}-${suffix}`, publicCode: `${tag}-${suffix}` },
    })));
    ids.push(...studios.map((studio) => studio.id));
    const urgent = await openTicket(actorId, {
      publicCode: studios[0]!.publicCode,
      subject: "Odrzucenie TEST",
      body: "NIP nabywcy",
      priority: "urgent",
      now,
    });
    const normal = await openTicket(actorId, {
      publicCode: studios[1]!.publicCode,
      subject: "Pytanie o kalendarz",
      body: "Nie widzę boksów",
      priority: "normal",
      now,
    });
    const urgentRow = await platformDb.supportTicket.findUniqueOrThrow({
      where: { publicCode: urgent.publicCode },
      include: { messages: true },
    });
    const normalRow = await platformDb.supportTicket.findUniqueOrThrow({ where: { publicCode: normal.publicCode } });
    expect(urgentRow.slaDueAt.getTime() - now.getTime()).toBe(SLA_MS.urgent);
    expect(normalRow.slaDueAt.getTime() - now.getTime()).toBe(SLA_MS.normal);
    expect(urgentRow.messages.map((message) => message.studioId)).toEqual([studios[0]!.id]);
    await expect(replyToTicket(actorId, urgent.publicCode, "   ")).rejects.toThrow(/treść/);
    await replyToTicket(actorId, urgent.publicCode, "Sprawdzamy tylko TEST.");
    const replied = await platformDb.supportMessage.findMany({ where: { ticketId: urgentRow.id } });
    expect(replied).toHaveLength(2);
    expect(replied.every((message) => message.studioId === studios[0]!.id)).toBe(true);
    expect(await platformDb.supportMessage.count({ where: { studioId: studios[1]!.id } })).toBe(1);
    await resolveTicket(actorId, urgent.publicCode, now);
    expect(await platformDb.supportTicket.findUnique({ where: { id: urgentRow.id }, select: { status: true } })).toMatchObject({ status: "resolved" });
  });
});
