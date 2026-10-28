import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL ??= "http://localhost:3000";
  process.env.AUTH_SECRET ??= "test-secret-0123456789abcdef0123456789";
});

import { platformDb } from "@/lib/db/client";
import { SUPPORT_SESSION_ACCESS, SUPPORT_SESSION_MS, activeSupportSession, startSupportSession, suspendStudio } from "./studio-access";

const tag = randomUUID();
const ids: string[] = [];
let actorId: string;
let memberId: string;
let sharedId: string;
let activeCode: string;
let otherCode: string;

beforeAll(async () => {
  actorId = (await platformDb.user.create({ data: { name: `${tag} actor`, email: `${tag}-actor@example.com` } })).id;
  memberId = (await platformDb.user.create({ data: { name: `${tag} member`, email: `${tag}-member@example.com` } })).id;
  sharedId = (await platformDb.user.create({ data: { name: `${tag} shared`, email: `${tag}-shared@example.com` } })).id;
  const active = await platformDb.studio.create({
    data: { name: `${tag} Obsidian`, slug: `${tag}-a`, publicCode: `${tag}-a`, status: "active" },
  });
  const other = await platformDb.studio.create({
    data: { name: `${tag} Drugie`, slug: `${tag}-b`, publicCode: `${tag}-b`, status: "active" },
  });
  ids.push(active.id, other.id);
  activeCode = active.publicCode;
  otherCode = other.publicCode;
  await platformDb.membership.create({ data: { studioId: active.id, userId: memberId, role: "owner" } });
  await platformDb.membership.create({ data: { studioId: active.id, userId: sharedId, role: "worker" } });
  await platformDb.membership.create({ data: { studioId: other.id, userId: sharedId, role: "owner" } });
  await platformDb.session.createMany({
    data: [
      { userId: memberId, token: `${tag}-member`, expiresAt: new Date("2027-01-01T00:00:00.000Z") },
      { userId: sharedId, token: `${tag}-shared`, expiresAt: new Date("2027-01-01T00:00:00.000Z") },
    ],
  });
  await platformDb.supportTicket.create({
    data: {
      publicCode: `TK-${tag.slice(0, 8)}`,
      studioId: active.id,
      subject: "Podgląd",
      slaDueAt: new Date("2027-01-01T00:00:00.000Z"),
      messages: { create: { fromStudio: true, body: "Proszę o podgląd." } },
    },
  });
});

afterAll(async () => {
  await platformDb.session.deleteMany({ where: { userId: { in: [memberId, sharedId, actorId] } } });
  await platformDb.auditLog.deleteMany({ where: { studioId: { in: ids } } });
  await platformDb.studio.deleteMany({ where: { id: { in: ids } } });
  await platformDb.user.deleteMany({ where: { id: { in: [actorId, memberId, sharedId] } } });
});

describe("sesja wsparcia i zawieszenie", () => {
  it("zła nazwa nie zmienia konta i nie kasuje sesji", async () => {
    await expect(suspendStudio({ actorId, publicCode: activeCode, name: "inne studio", reason: "nadużycie" })).rejects.toThrow(/nie zgadza/);
    expect(await platformDb.studio.findFirst({ where: { publicCode: activeCode }, select: { status: true } })).toMatchObject({ status: "active" });
    expect(await platformDb.session.count({ where: { userId: memberId } })).toBe(1);
    expect(await platformDb.auditLog.count({ where: { studioId: ids[0], action: "studio.suspended" } })).toBe(0);
  });

  it("sesja wsparcia jest w audycie, wygasa po 15 min i nie tworzy sesji studia", async () => {
    const sessionsBefore = await platformDb.session.count();
    const now = new Date("2026-10-28T12:00:00.000Z");
    const started = await startSupportSession({
      actorId,
      publicCode: activeCode,
      reason: "weryfikacja faktury",
      ticketCode: `TK-${tag.slice(0, 8)}`,
      now,
    });
    expect(started.access).toBe(SUPPORT_SESSION_ACCESS);
    expect(started.expiresAt.getTime() - now.getTime()).toBe(SUPPORT_SESSION_MS);
    expect(await platformDb.session.count()).toBe(sessionsBefore);
    expect(await platformDb.auditLog.count({ where: { studioId: ids[0], action: "support.session.started" } })).toBe(1);
    expect(await activeSupportSession(actorId, activeCode, new Date(now.getTime() + SUPPORT_SESSION_MS - 1))).toMatchObject({
      access: "read",
      ticketCode: `TK-${tag.slice(0, 8)}`,
    });
    expect(await activeSupportSession(actorId, activeCode, new Date(now.getTime() + SUPPORT_SESSION_MS))).toBeNull();
    await expect(startSupportSession({
      actorId,
      publicCode: otherCode,
      reason: "cudze",
      ticketCode: `TK-${tag.slice(0, 8)}`,
      now,
    })).rejects.toThrow(/nie należy/);
  });

  it("poprawna nazwa wstrzymuje konto i odcina logowanie tylko tego studia", async () => {
    await suspendStudio({ actorId, publicCode: activeCode, name: `${tag} Obsidian`, reason: "nadużycie" });
    expect(await platformDb.studio.findFirst({ where: { publicCode: activeCode }, select: { status: true } })).toMatchObject({ status: "suspended" });
    expect(await platformDb.studio.findFirst({ where: { publicCode: otherCode }, select: { status: true } })).toMatchObject({ status: "active" });
    expect(await platformDb.session.count({ where: { userId: memberId } })).toBe(0);
    expect(await platformDb.session.count({ where: { userId: sharedId } })).toBe(1);
  });
});
