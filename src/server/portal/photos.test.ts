import { randomUUID } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { GET as getPhoto } from "@/app/p/media/[photoId]/route";
import PortalPage from "@/app/p/[token]/page";
import { POST as postProtocol } from "@/app/p/[token]/protocol/route";
import { createPortalLink, readPortal, revokePortalLink } from "./links";
import { portalPhotoPath } from "./media";
import { saveProtocol } from "../zlecenia/intake";
import { VIEW_URL_TTL_S } from "../zlecenia/photos";

const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  process.env.AUTH_SECRET ??= "test-secret-0123456789abcdef0123456789";
  return { objects: new Map<string, string>() };
});
vi.mock("@/lib/storage", () => ({
  presignPut: async () => "https://s3.test/put",
  presignGet: async (key: string) => `https://s3.test/get/${key}`,
  headObject: async () => null,
  deleteObject: async () => undefined,
  openObject: async (key: string) => {
    const bytes = mocks.objects.get(key);
    if (!bytes) return null;
    const stream = new Response(bytes).body;
    if (!stream) return null;
    return { stream, contentType: "image/jpeg", contentLength: Buffer.byteLength(bytes) };
  },
}));

const tag = randomUUID();
const studios: string[] = [];
let userId: string;
let seq = 0;
const tokenFrom = (link: { path: string }) => link.path.slice(3);
const stable = (value: string) => value.replace(/\/p\/media\/[^"]+/g, "/p/media/photo");
const page = (token: string, unavailable?: string) => PortalPage({
  params: Promise.resolve({ token }),
  searchParams: Promise.resolve(unavailable ? { unavailable } : {}),
});
const post = (token: string, origin = "http://localhost:3000") => postProtocol(new Request(`http://localhost:3000/p/${token}/protocol`, {
  method: "POST", headers: { origin },
}), { params: Promise.resolve({ token }) });
const photoRequest = (path: string, photoId: string, studioId?: string) => {
  const url = new URL(path, "http://localhost:3000");
  if (studioId) url.searchParams.set("studioId", studioId);
  return getPhoto(new Request(url), { params: Promise.resolve({ photoId }) });
};

async function fixture(index: number, plate: string, caption: string) {
  const studioId = studios[index]!;
  const db = studioDb(studioId);
  const client = await db.client.create({ data: { studioId, name: `Klient ${++seq}` } });
  const vehicle = await db.vehicle.create({ data: { studioId, clientId: client.id, make: index === 0 ? "Porsche" : "Volvo", model: index === 0 ? "911" : "V60", plate } });
  const quote = await db.quote.create({ data: {
    studioId, clientId: client.id, vehicleId: vehicle.id, status: "sent",
    sizeMult: "1.20", paintMult: "1.00", totalGross: "4800.00", vatAmount: "897.56",
  } });
  const order = await db.workOrder.create({ data: {
    studioId, number: `DF-${tag.slice(0, 8)}-${seq}`, clientId: client.id, vehicleId: vehicle.id, quoteId: quote.id,
    status: "in_progress", stage: 2, service: "Korekta + ceramika", totalGross: "4800.00",
    scheduledFrom: new Date("2026-10-29T08:00:00Z"), scheduledTo: new Date("2026-10-30T10:00:00Z"),
  } });
  const photoId = randomUUID().replaceAll("-", "");
  const key = `studios/${studioId}/orders/${order.id}/${photoId}.jpg`;
  const photo = await db.orderPhoto.create({ data: {
    id: photoId, studioId, workOrderId: order.id, no: 1, stage: 2, key, contentType: "image/jpeg",
    sizeBytes: caption.length, caption, uploadedAt: new Date(),
  } });
  const pending = await db.orderPhoto.create({ data: {
    studioId, workOrderId: order.id, no: 2, stage: 2,
    key: `studios/${studioId}/orders/${order.id}/${randomUUID().replaceAll("-", "")}.jpg`,
    contentType: "image/jpeg", sizeBytes: 4, caption: `${caption}-niepotwierdzone`,
  } });
  mocks.objects.set(key, `bytes-${caption}`);
  const link = await createPortalLink(db, studioId, { workOrderId: order.id });
  const quoteLink = await createPortalLink(db, studioId, { quoteId: quote.id });
  return { db, studioId, quote, order, photo, pending, link, token: tokenFrom(link), quoteToken: tokenFrom(quoteLink) };
}

async function addProtocol(db: ReturnType<typeof studioDb>, studioId: string, workOrderId: string, title = "Rysa na masce") {
  const protocol = await db.intakeProtocol.create({ data: { studioId, workOrderId, number: `P-${randomUUID().slice(0, 8)}` } });
  const damage = await db.intakeDamage.create({ data: {
    studioId, protocolId: protocol.id, no: 1, title, part: "Maska", size: "2 cm", posX: 0.22, posY: 0.21,
  } });
  return { protocol, damage };
}

beforeAll(async () => {
  for (const suffix of ["a", "b"]) {
    studios.push((await platformDb.studio.create({ data: { status: "active", publicCode: `${tag}-${suffix}`, slug: `${tag}-${suffix}`, name: `Studio ${suffix}` } })).id);
  }
  userId = (await platformDb.user.create({ data: { email: `${tag}@example.test`, name: "Owner" } })).id;
});
afterAll(async () => {
  await platformDb.studio.deleteMany({ where: { id: { in: studios } } });
  await platformDb.user.deleteMany({ where: { id: userId } });
});

describe("zdjęcia i akceptacja protokołu w portalu (Postgres)", () => {
  it("shows only this order's confirmed photos through a short signature without the portal token", async () => {
    const a = await fixture(0, `WX ${tag.slice(0, 4)} A`, `caption-${tag}-a`);
    const b = await fixture(1, `WX ${tag.slice(0, 4)} B`, `caption-${tag}-b`);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const portal = await readPortal(a.token);
      expect(portal?.photos).toEqual([{ no: 1, caption: a.photo.caption, url: expect.stringMatching(/^\/p\/media\//) }]);
      const url = portal!.photos[0]!.url;
      expect(url).not.toContain(a.token);
      expect(url).not.toContain(a.studioId);
      expect(url).not.toContain("studioId");
      expect(url).not.toContain(a.photo.key);
      const html = renderToStaticMarkup(await page(a.token));
      const htmlB = renderToStaticMarkup(await page(b.token));
      expect(html).toContain(a.photo.caption!);
      expect(html).not.toContain(b.photo.caption!);
      expect(html).not.toContain(b.order.number);
      expect(html).not.toContain(`${a.photo.caption}-niepotwierdzone`);
      expect(html).not.toContain(a.token);
      expect(html).toContain("Korekta lakieru");
      expect(html).toContain("Ceramika i kontrola");
      expect(htmlB).toContain(b.photo.caption!);
      expect(htmlB).not.toContain(a.photo.caption!);
      const srcs = [...html.matchAll(/src="([^"]+)"/g)].map((match) => match[1]!);
      expect(srcs.some((src) => src.startsWith("/p/media/"))).toBe(true);
      expect(srcs.every((src) => !src.includes(a.token) && !src.includes(a.studioId))).toBe(true);

      const ok = await photoRequest(url, a.photo.id, b.studioId);
      expect(ok.status).toBe(200);
      expect(ok.headers.get("content-type")).toBe("image/jpeg");
      expect(ok.headers.get("referrer-policy")).toBe("no-referrer");
      expect(ok.headers.get("location")).toBeNull();
      expect(await ok.text()).toBe(`bytes-${a.photo.caption}`);
      const foreign = await photoRequest(url, b.photo.id);
      expect(foreign.status).toBe(404);
      expect(await foreign.text()).toBe("");
      expect(foreign.headers.get("location")).toBeNull();
      const pendingUrl = portalPhotoPath(a.link.id, a.pending.id);
      expect((await photoRequest(pendingUrl, a.pending.id)).status).toBe(404);
      const dumped = JSON.stringify([log.mock.calls, info.mock.calls, url, pendingUrl]);
      expect(dumped).not.toContain(a.token);
      expect(dumped).not.toContain(b.token);
    } finally {
      log.mockRestore();
      info.mockRestore();
    }
  });

  it("does not reveal another car's photos on a quote link without an order", async () => {
    const quoteCar = await fixture(0, `QP ${tag.slice(0, 4)}`, `quote-own-${tag}`);
    const other = await fixture(0, `QV ${tag.slice(0, 4)} VOLVO`, `other-car-${tag}`);
    const html = renderToStaticMarkup(await page(quoteCar.quoteToken));
    expect(html).toContain("Akceptuję wycenę");
    expect(html).not.toContain("Akceptuję stan auta");
    expect(html).not.toContain("/p/media/");
    expect(html).not.toContain(quoteCar.photo.caption!);
    expect(html).not.toContain(other.photo.caption!);
    expect(html).not.toContain("VOLVO");
    expect(html).not.toContain(other.order.number);
    const read = await readPortal(quoteCar.quoteToken);
    expect(read?.order).toBeNull();
    expect(read?.photos).toEqual([]);
    expect(read?.protocol).toBeNull();
    const { protocol } = await addProtocol(quoteCar.db, quoteCar.studioId, quoteCar.order.id, "Protokół wyceny");
    const quoteLink = await quoteCar.db.portalLink.findFirstOrThrow({ where: { quoteId: quoteCar.quote.id } });
    expect((await photoRequest(portalPhotoPath(quoteLink.id, quoteCar.photo.id), quoteCar.photo.id)).status).toBe(404);
    expect((await photoRequest(portalPhotoPath(quoteLink.id, other.photo.id), other.photo.id)).status).toBe(404);
    const response = await post(quoteCar.quoteToken);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).not.toContain("unavailable");
    expect((await quoteCar.db.intakeProtocol.findFirstOrThrow({ where: { id: protocol.id } })).acceptedAt).toBeNull();
    expect(renderToStaticMarkup(await page(quoteCar.quoteToken))).not.toContain("Protokół wyceny");
  });

  it("rejects a swapped photo, a tampered signature and an expired signature", async () => {
    const a = await fixture(0, `SW ${tag.slice(0, 4)}`, `swap-${tag}`);
    const otherOrder = await a.db.workOrder.create({ data: {
      studioId: a.studioId, number: `DF-other-${++seq}`, clientId: a.order.clientId, vehicleId: a.order.vehicleId,
      status: "accepted", service: "Mycie", totalGross: "100.00",
      scheduledFrom: new Date(), scheduledTo: new Date(),
    } });
    const otherPhoto = await a.db.orderPhoto.create({ data: {
      studioId: a.studioId, workOrderId: otherOrder.id, no: 1, stage: 1,
      key: `studios/${a.studioId}/orders/${otherOrder.id}/other.jpg`,
      contentType: "image/jpeg", sizeBytes: 4, caption: `swap-other-${tag}`, uploadedAt: new Date(),
    } });
    mocks.objects.set(otherPhoto.key, "bytes-other");
    const path = (await readPortal(a.token))!.photos[0]!.url;
    expect((await photoRequest(portalPhotoPath(a.link.id, otherPhoto.id), otherPhoto.id)).status).toBe(404);
    const tampered = new URL(path, "http://localhost:3000");
    const sig = tampered.searchParams.get("s")!;
    tampered.searchParams.set("s", `${sig[0] === "a" ? "b" : "a"}${sig.slice(1)}`);
    expect((await getPhoto(new Request(tampered), { params: Promise.resolve({ photoId: a.photo.id }) })).status).toBe(404);
    const expired = portalPhotoPath(a.link.id, a.photo.id, Date.now() - (VIEW_URL_TTL_S + 30) * 1000);
    expect((await photoRequest(expired, a.photo.id)).status).toBe(404);
    await revokePortalLink(a.db, a.link.id);
    expect((await photoRequest(path, a.photo.id)).status).toBe(404);
  });

  it("hides the protocol section when there is no protocol and does not create one", async () => {
    const a = await fixture(0, `NP ${tag.slice(0, 4)}`, `noprotocol-${tag}`);
    const html = renderToStaticMarkup(await page(a.token));
    expect(html).not.toContain("Protokół przyjęcia");
    expect(html).not.toContain("Nie znaleziono");
    expect(html).not.toContain("Akceptuję stan auta");
    const response = await post(a.token);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).not.toContain("unavailable");
    expect(await a.db.intakeProtocol.count({ where: { workOrderId: a.order.id } })).toBe(0);
    expect(stable(renderToStaticMarkup(await page(a.token)))).toBe(stable(html));
  });

  it("accepts once, keeps the same content on the second click, and freezes the protocol", async () => {
    const a = await fixture(0, `AC ${tag.slice(0, 4)}`, `accept-${tag}`);
    const b = await fixture(1, `ACB ${tag.slice(0, 4)}`, `accept-b-${tag}`);
    const { protocol } = await addProtocol(a.db, a.studioId, a.order.id);
    await addProtocol(b.db, b.studioId, b.order.id, "Cudze uszkodzenie");
    const before = renderToStaticMarkup(await page(a.token));
    expect(before).toContain("Akceptuję stan auta");
    expect(before).toContain(`action="/p/${a.token}/protocol"`);
    expect(before).toContain("Rysa na masce");
    const srcs = [...before.matchAll(/src="([^"]+)"/g)].map((match) => match[1]!);
    expect(srcs.some((src) => src.startsWith("/p/media/"))).toBe(true);
    expect(srcs.every((src) => !src.includes(a.token))).toBe(true);
    expect(before).not.toContain("Cudze uszkodzenie");
    const first = await post(a.token);
    expect(first.status).toBe(303);
    expect(new URL(first.headers.get("location")!).searchParams.has("unavailable")).toBe(false);
    const accepted = await a.db.intakeProtocol.findFirstOrThrow({ where: { id: protocol.id } });
    expect(accepted.acceptedAt).toBeInstanceOf(Date);
    const [again, parallel] = await Promise.all([post(a.token), post(a.token)]);
    expect(again.status).toBe(303);
    expect(parallel.status).toBe(303);
    const reread = await a.db.intakeProtocol.findFirstOrThrow({ where: { id: protocol.id } });
    expect(reread.acceptedAt).toEqual(accepted.acceptedAt);
    expect(await a.db.intakeDamage.findMany({ where: { protocolId: protocol.id }, orderBy: { no: "asc" } })).toMatchObject([
      { title: "Rysa na masce", part: "Maska", size: "2 cm", posX: 0.22, posY: 0.21 },
    ]);
    await expect(saveProtocol(a.studioId, a.order.id, userId, { damages: [{ title: "Podmiana", part: "Drzwi", x: 0.4, y: 0.4 }] })).rejects.toMatchObject({ status: 409 });
    expect(await a.db.intakeDamage.findMany({ where: { protocolId: protocol.id } })).toMatchObject([{ title: "Rysa na masce" }]);
    expect((await b.db.intakeProtocol.findFirstOrThrow({ where: { workOrderId: b.order.id } })).acceptedAt).toBeNull();
    const after = renderToStaticMarkup(await page(a.token));
    const repeated = renderToStaticMarkup(await page(a.token));
    expect(after).toContain("Stan zaakceptowany");
    expect(after).toContain("Rysa na masce");
    expect(after).not.toContain("Akceptuję stan auta");
    expect(after).not.toContain("Podmiana");
    expect(after).not.toContain("Cudze uszkodzenie");
    expect(stable(repeated)).toBe(stable(after));
  });

  it.each(["bad-token-value", "x".repeat(40), ""])("turns a bad protocol post into P-02 without order data: %s", async (token) => {
    const a = await fixture(0, `BD ${tag.slice(0, 4)}`, `secret-caption-${tag}`);
    const response = await post(token);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("unavailable=1");
    const html = renderToStaticMarkup(await page(token || "invalid", "1"));
    expect(html).toContain("Ten link już wygasł");
    expect(html).not.toContain(a.photo.caption!);
    expect(html).not.toContain("VOLVO");
    expect(html).not.toContain(a.order.number);
    expect(html).not.toContain("/p/media/");
  });

  it("rejects expired, revoked and cross-origin acceptance without changing the protocol", async () => {
    const expired = await fixture(0, `EX ${tag.slice(0, 4)}`, `expired-${tag}`);
    const revoked = await fixture(0, `RV ${tag.slice(0, 4)}`, `revoked-${tag}`);
    const live = await fixture(0, `LV ${tag.slice(0, 4)}`, `live-${tag}`);
    await addProtocol(expired.db, expired.studioId, expired.order.id, "Protokół wygasły");
    await addProtocol(revoked.db, revoked.studioId, revoked.order.id, "Protokół odwołany");
    await addProtocol(live.db, live.studioId, live.order.id, "Protokół żywy");
    await expired.db.portalLink.update({ where: { id: expired.link.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await revokePortalLink(revoked.db, revoked.link.id);
    for (const token of [expired.token, revoked.token]) {
      const response = await post(token);
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toContain("unavailable=1");
      const html = renderToStaticMarkup(await page(token));
      expect(html).toContain("Ten link już wygasł");
      expect(html).not.toContain("Protokół wygasły");
      expect(html).not.toContain("Protokół odwołany");
      expect(html).not.toContain("/p/media/");
    }
    expect((await post(live.token, "https://evil.test")).status).toBe(403);
    for (const row of [expired, revoked, live]) {
      expect((await row.db.intakeProtocol.findFirstOrThrow({ where: { workOrderId: row.order.id } })).acceptedAt).toBeNull();
    }
  });
});
