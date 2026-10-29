import { randomUUID } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { PUBLIC_MEDIA_CACHE } from "@/lib/portfolio/rules";
import { GET as listRoute } from "@/app/api/studios/[studioId]/portfolio/route";
import { DELETE, POST } from "@/app/api/studios/[studioId]/portfolio/[photoId]/route";
import { GET as mediaRoute } from "@/app/realizacje/[slug]/media/[photoId]/route";
import PublicPortfolioPage from "@/app/realizacje/[slug]/page";
import { publishPhoto, unpublishPhoto } from "./publish";
import { loadPublicPortfolio } from "./public";

const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  process.env.AUTH_SECRET ??= "test-secret-0123456789abcdef0123456789";
  return {
    objects: new Map<string, { body: Buffer; type: string }>(),
    presigns: [] as string[],
    opened: [] as string[],
    deleted: [] as string[],
    session: vi.fn(),
    beforePut: null as null | (() => Promise<void>),
  };
});
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@/lib/storage", () => ({
  presignPut: async () => "https://s3.test/put",
  presignGet: async (key: string) => {
    mocks.presigns.push(key);
    return `https://s3.test/get/${key}?X-Amz-Signature=secret`;
  },
  headObject: async (key: string) => {
    const object = mocks.objects.get(key);
    return object ? { sizeBytes: object.body.length, contentType: object.type } : null;
  },
  deleteObject: async (key: string) => {
    mocks.deleted.push(key);
    mocks.objects.delete(key);
  },
  putObject: async (key: string, body: Buffer, contentType: string) => {
    const hook = mocks.beforePut;
    mocks.beforePut = null;
    if (hook) await hook();
    mocks.objects.set(key, { body: Buffer.from(body), type: contentType });
  },
  openObject: async (key: string) => {
    mocks.opened.push(key);
    const object = mocks.objects.get(key);
    if (!object) return null;
    const stream = new Response(new Uint8Array(object.body)).body;
    if (!stream) return null;
    return { stream, contentType: object.type, contentLength: object.body.length };
  },
}));

const tag = randomUUID();
const studios: string[] = [];
const users: Record<string, { id: string }> = {};
const mask = { x: 0.1, y: 0.6, w: 0.4, h: 0.2 };
const secrets = {
  client: `KLIENT-${tag}`,
  email: `tajny-${tag}@example.test`,
  phone: `+48-KLIENT-${tag.slice(0, 8)}`,
  street: `ULICA-TAJNA-${tag.slice(0, 8)}`,
  plate: `TABLICA-${tag}`,
  order: `DF-TAJNY-${tag.slice(0, 8)}`,
  caption: `CAPTION-TAJNY-${tag.slice(0, 8)}`,
  gross: "7341.59",
  studioPhone: `TEL-STUDIA-${tag.slice(0, 8)}`,
  studioNip: `NIP-TAJNY-${tag.slice(0, 6)}`,
  address: `ADRES-TAJNY-${tag.slice(0, 6)}`,
};
let image: Buffer;

function req(method: string, body?: unknown, origin: string | null = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/studios/x/portfolio", {
    method,
    headers: { ...(origin ? { origin } : {}), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const postCtx = (studioId: string, photoId: string) => ({ params: Promise.resolve({ studioId, photoId }) });
const media = (slug: string, photoId: string, init?: RequestInit) => mediaRoute(
  new Request(`http://localhost:3000/realizacje/${slug}/media/${photoId}?studioId=foreign&v=1`, init),
  { params: Promise.resolve({ slug, photoId }) },
);

async function pattern() {
  const width = 64;
  const height = 64;
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      if (x < 32) {
        const on = Math.floor(x / 8) % 2 === Math.floor(y / 8) % 2;
        raw[i] = raw[i + 1] = raw[i + 2] = on ? 255 : 0;
      } else {
        raw[i + 2] = 255;
      }
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

async function fixture(index: number) {
  const studioId = studios[index]!;
  const db = studioDb(studioId);
  const client = await db.client.create({ data: {
    studioId, name: secrets.client, email: secrets.email, phone: secrets.phone, street: secrets.street,
  } });
  const vehicle = await db.vehicle.create({ data: {
    studioId, clientId: client.id, make: `Marka-${tag}-${index}`, model: `Model-${tag}`, plate: secrets.plate,
  } });
  const order = await db.workOrder.create({ data: {
    studioId, number: `${secrets.order}-${index}-${randomUUID().slice(0, 8)}`, clientId: client.id, vehicleId: vehicle.id,
    status: "completed", service: `Usluga-${tag}`, totalGross: secrets.gross,
    scheduledFrom: new Date("2026-10-20T08:00:00Z"), scheduledTo: new Date("2026-10-20T12:00:00Z"),
    completedAt: new Date("2026-10-20T12:00:00Z"),
  } });
  const photoId = randomUUID().replaceAll("-", "");
  const key = `studios/${studioId}/orders/${order.id}/${photoId}.png`;
  const photo = await db.orderPhoto.create({ data: {
    id: photoId, studioId, workOrderId: order.id, no: 1, stage: 4, key, contentType: "image/png",
    sizeBytes: image.length, caption: secrets.caption, uploadedAt: new Date(),
  } });
  const pendingId = randomUUID().replaceAll("-", "");
  const pending = await db.orderPhoto.create({ data: {
    id: pendingId, studioId, workOrderId: order.id, no: 2, stage: 4,
    key: `studios/${studioId}/orders/${order.id}/${pendingId}.png`,
    contentType: "image/png", sizeBytes: 4, caption: `${secrets.caption}-pending`,
  } });
  mocks.objects.set(key, { body: image, type: "image/png" });
  return { studioId, order, photo, pending, key };
}

beforeAll(async () => {
  image = await pattern();
  for (const suffix of ["a", "b"]) {
    studios.push((await platformDb.studio.create({ data: {
      status: "active", name: `Nazwa-${tag}-${suffix}`, publicCode: `${tag}-${suffix}`, slug: `${tag}-${suffix}`,
      phone: secrets.studioPhone, nip: secrets.studioNip, address: secrets.address, city: `Miasto-${tag}`,
    } })).id);
  }
  for (const role of ["owner", "manager", "worker"] as const) {
    users[role] = await platformDb.user.create({ data: { name: role, email: `${tag}-${role}@example.test` } });
    await studioDb(studios[0]!).membership.create({ data: { studioId: studios[0]!, userId: users[role]!.id, role } });
  }
});
afterAll(async () => {
  await platformDb.auditLog.deleteMany({ where: { studioId: { in: studios } } });
  await platformDb.studio.deleteMany({ where: { id: { in: studios } } });
  await platformDb.user.deleteMany({ where: { email: { startsWith: tag } } });
});

describe("publiczne portfolio (Postgres)", () => {
  it("keeps every photo private until the studio publishes, and an empty gallery is not a 404", async () => {
    const a = await fixture(0);
    const empty = await loadPublicPortfolio(`${tag}-b`);
    expect(empty?.items).toEqual([]);
    const html = renderToStaticMarkup(await PublicPortfolioPage({ params: Promise.resolve({ slug: `${tag}-b` }) }));
    expect(html).toContain("nie opublikowało jeszcze realizacji");
    expect(html).not.toContain("404");
    expect(html).not.toContain(secrets.client);
    expect((await media(`${tag}-a`, a.photo.id)).status).toBe(404);
    await expect(PublicPortfolioPage({ params: Promise.resolve({ slug: `${tag}-brak` }) })).rejects.toThrow();
    expect(await loadPublicPortfolio("../etc")).toBeNull();
  });

  it("publishes a masked derivative, hides client data, and never serves the private original", async () => {
    const a = await fixture(0);
    const b = await fixture(1);
    mocks.session.mockResolvedValue({ user: users.owner });
    const context = postCtx(a.studioId, a.photo.id);
    expect((await POST(req("POST", {}), context)).status).toBe(400);
    expect((await POST(req("POST", { plateVisible: false }), context)).status).toBe(400);
    expect((await POST(req("POST", { plateVisible: false, mask: { x: 0, y: 0, w: 0.01, h: 0.5 } }), context)).status).toBe(400);
    expect((await POST(req("POST", { plateVisible: true, studioId: b.studioId }), context)).status).toBe(400);
    expect((await POST(req("POST", { plateVisible: false, mask }, null), context)).status).toBe(403);
    mocks.session.mockResolvedValue({ user: users.worker });
    expect((await POST(req("POST", { plateVisible: false, mask }), context)).status).toBe(403);
    mocks.session.mockResolvedValue({ user: users.owner });
    const missing = await POST(req("POST", { plateVisible: false, mask }), postCtx(a.studioId, "missingphoto"));
    const foreign = await POST(req("POST", { plateVisible: false, mask }), postCtx(a.studioId, b.photo.id));
    const pending = await POST(req("POST", { plateVisible: false, mask }), postCtx(a.studioId, a.pending.id));
    expect(missing.status).toBe(404);
    expect(foreign.status).toBe(404);
    expect(pending.status).toBe(404);
    expect(await foreign.json()).toEqual(await missing.json());
    expect((await POST(req("POST", { plateVisible: false, mask }), postCtx(b.studioId, b.photo.id))).status).toBe(403);

    const published = await POST(req("POST", { plateVisible: false, mask }), context);
    expect(published.status).toBe(200);
    const row = await studioDb(a.studioId).orderPhoto.findFirstOrThrow({ where: { id: a.photo.id } });
    expect(row.publishedAt).toBeTruthy();
    expect(row.plateVisible).toBe(false);
    expect(row.publicKey).toMatch(/\/portfolio\//);
    expect(row.publicKey).not.toBe(a.key);
    expect(row.key).toBe(a.key);
    expect(mocks.objects.get(a.key)?.body.equals(image)).toBe(true);
    const derivative = mocks.objects.get(row.publicKey!)!.body;
    expect(derivative.equals(image)).toBe(false);
    expect(derivative.subarray(0, 2).toString("hex")).toBe("ffd8");
    expect(mocks.deleted.every((key) => key.includes("/portfolio/") && !key.includes("/orders/"))).toBe(true);

    const loaded = await loadPublicPortfolio(`${tag}-a`);
    expect(loaded?.items.map((item) => item.id)).toEqual([a.photo.id]);
    expect(loaded?.items[0]).toEqual({
      id: a.photo.id, make: `Marka-${tag}-0`, model: `Model-${tag}`, service: `Usluga-${tag}`,
      src: `/realizacje/${tag}-a/media/${a.photo.id}?v=${row.publicVersion}`,
    });
    const html = renderToStaticMarkup(await PublicPortfolioPage({ params: Promise.resolve({ slug: `${tag}-a` }) }));
    expect(html).toContain(`Marka-${tag}-0`);
    expect(html).toContain(`Usluga-${tag}`);
    expect(html).toContain(`/realizacje/${tag}-a/media/${a.photo.id}?v=${row.publicVersion}`);
    for (const secret of Object.values(secrets)) expect(html).not.toContain(secret);
    expect(html).not.toContain(b.photo.id);
    expect(html).not.toContain("s3.test");
    expect(html).not.toContain("X-Amz-");
    expect(html).not.toContain("/orders/");
    expect(html).not.toContain(a.studioId);
    expect(html).not.toContain(secrets.caption);

    mocks.opened.length = 0;
    mocks.presigns.length = 0;
    const ok = await media(`${tag}-a`, a.photo.id);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/jpeg");
    expect(ok.headers.get("cache-control")).toBe(PUBLIC_MEDIA_CACHE);
    expect(ok.headers.get("cache-control")).not.toMatch(/immutable|no-store/);
    expect(ok.headers.get("location")).toBeNull();
    expect(ok.headers.get("referrer-policy")).toBe("no-referrer");
    const bytes = Buffer.from(await ok.arrayBuffer());
    expect(bytes.equals(derivative)).toBe(true);
    expect(bytes.equals(image)).toBe(false);
    expect(mocks.opened).toEqual([row.publicKey]);
    expect(mocks.presigns).toEqual([]);
    const etag = ok.headers.get("etag");
    const again = await media(`${tag}-a`, a.photo.id, { headers: { "if-none-match": etag! } });
    expect(again.status).toBe(304);
    expect(mocks.opened).toEqual([row.publicKey]);
    expect((await again.arrayBuffer()).byteLength).toBe(0);
    expect((await media(`${tag}-b`, a.photo.id)).status).toBe(404);
    expect((await media(`${tag}-a`, b.photo.id)).status).toBe(404);

    const staff = await listRoute(req("GET"), { params: Promise.resolve({ studioId: a.studioId }) });
    const staffBody = await staff.json();
    expect(staffBody.photos.some((photo: { id: string; clientName: string; key?: string; publicKey?: string }) => photo.id === a.photo.id && photo.clientName === secrets.client)).toBe(true);
    expect(staffBody.photos.every((photo: { key?: string; publicKey?: string }) => photo.key === undefined && photo.publicKey === undefined)).toBe(true);
    expect(JSON.stringify(staffBody)).not.toContain(secrets.email);
    expect((await listRoute(req("GET"), { params: Promise.resolve({ studioId: b.studioId }) })).status).toBe(403);

    const audits = await platformDb.auditLog.findMany({ where: { studioId: a.studioId, action: "portfolio.publish" } });
    const dumped = JSON.stringify(audits);
    expect(dumped).toContain(a.photo.id);
    expect(dumped).not.toContain(secrets.plate);
    expect(dumped).not.toContain(a.key);
    expect(dumped).not.toContain("X-Amz-");
  });

  it("drops the derivative on unpublish, keeps the original, and still allows takedown when billing is restricted", async () => {
    const a = await fixture(0);
    mocks.session.mockResolvedValue({ user: users.manager });
    const first = await publishPhoto(a.studioId, a.photo.id, users.manager!.id, { plateVisible: false, mask });
    const published = await studioDb(a.studioId).orderPhoto.findFirstOrThrow({ where: { id: a.photo.id } });
    const stale = published.publicKey!;
    const again = await publishPhoto(a.studioId, a.photo.id, users.manager!.id, { plateVisible: true });
    expect(again.publicVersion).toBe(first.publicVersion + 1);
    expect(mocks.objects.has(stale)).toBe(false);
    expect(mocks.objects.has(a.key)).toBe(true);
    const visible = await studioDb(a.studioId).orderPhoto.findFirstOrThrow({ where: { id: a.photo.id } });
    expect(visible.plateVisible).toBe(true);
    expect(visible.publicKey).not.toBe(a.key);
    expect(mocks.objects.get(visible.publicKey!)?.body.equals(image)).toBe(false);

    await platformDb.studio.update({ where: { id: a.studioId }, data: { status: "suspended" } });
    try {
      expect((await POST(req("POST", { plateVisible: true }), postCtx(a.studioId, a.photo.id))).status).toBe(403);
      const removed = await DELETE(req("DELETE"), postCtx(a.studioId, a.photo.id));
      expect(removed.status).toBe(200);
      expect(await removed.json()).toEqual({ id: a.photo.id, published: false });
    } finally {
      await platformDb.studio.update({ where: { id: a.studioId }, data: { status: "active" } });
    }
    const stored = await studioDb(a.studioId).orderPhoto.findFirstOrThrow({ where: { id: a.photo.id } });
    expect(stored.publishedAt).toBeNull();
    expect(stored.publicKey).toBeNull();
    expect(stored.plateVisible).toBe(false);
    expect(mocks.objects.has(a.key)).toBe(true);
    expect(mocks.objects.has(visible.publicKey!)).toBe(false);
    expect(mocks.deleted.every((key) => key.includes("/portfolio/") && !key.includes("/orders/"))).toBe(true);
    mocks.opened.length = 0;
    const gone = await media(`${tag}-a`, a.photo.id, { headers: { "if-none-match": `"v${visible.publicVersion}"` } });
    expect(gone.status).toBe(404);
    expect(gone.headers.get("cache-control")).toBe("private, no-store");
    expect(gone.headers.get("location")).toBeNull();
    expect(mocks.opened).toEqual([]);
    const loaded = await loadPublicPortfolio(`${tag}-a`);
    expect(loaded?.items.some((item) => item.id === a.photo.id)).toBe(false);
    const html = renderToStaticMarkup(await PublicPortfolioPage({ params: Promise.resolve({ slug: `${tag}-a` }) }));
    expect(html).not.toContain(a.photo.id);
    expect((await DELETE(req("DELETE"), postCtx(a.studioId, a.photo.id))).status).toBe(200);
  });

  it("lets only one of two concurrent publishes win and refuses a corrupt file without publishing it", async () => {
    const a = await fixture(0);
    const results = await Promise.allSettled([0, 1].map(() => publishPhoto(a.studioId, a.photo.id, users.owner!.id, { plateVisible: true })));
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected) expect(rejected).toMatchObject({ status: "rejected", reason: { status: 409 } });
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    const stored = await studioDb(a.studioId).orderPhoto.findFirstOrThrow({ where: { id: a.photo.id } });
    expect(stored.publishedAt).toBeTruthy();
    expect(mocks.objects.has(stored.publicKey!)).toBe(true);
    expect(mocks.objects.has(a.key)).toBe(true);
    const portfolioKeys = [...mocks.objects.keys()].filter((key) => key.includes(`/portfolio/${a.photo.id}/`));
    expect(portfolioKeys).toEqual([stored.publicKey]);
    const stale = await studioDb(a.studioId).orderPhoto.updateMany({
      where: { id: a.photo.id, publicVersion: stored.publicVersion - 1 },
      data: { caption: "stale" },
    });
    expect(stale.count).toBe(0);
    const previousKey = stored.publicKey!;
    mocks.beforePut = async () => {
      await studioDb(a.studioId).orderPhoto.updateMany({
        where: { id: a.photo.id, publicVersion: stored.publicVersion },
        data: { publicVersion: { increment: 1 } },
      });
    };
    await expect(publishPhoto(a.studioId, a.photo.id, users.owner!.id, { plateVisible: true })).rejects.toMatchObject({ status: 409 });
    const afterRace = await studioDb(a.studioId).orderPhoto.findFirstOrThrow({ where: { id: a.photo.id } });
    expect(afterRace.publicKey).toBe(previousKey);
    expect(mocks.objects.has(previousKey)).toBe(true);
    expect([...mocks.objects.keys()].filter((key) => key.includes(`/portfolio/${a.photo.id}/`))).toEqual([previousKey]);

    const brokenId = randomUUID().replaceAll("-", "");
    const brokenKey = `studios/${a.studioId}/orders/${a.order.id}/${brokenId}.png`;
    await studioDb(a.studioId).orderPhoto.create({ data: {
      id: brokenId, studioId: a.studioId, workOrderId: a.order.id, no: 3, stage: 4, key: brokenKey,
      contentType: "image/png", sizeBytes: 12, uploadedAt: new Date(),
    } });
    mocks.objects.set(brokenKey, { body: Buffer.from("not-an-image"), type: "image/png" });
    await expect(publishPhoto(a.studioId, brokenId, users.owner!.id, { plateVisible: true })).rejects.toMatchObject({ status: 400 });
    const broken = await studioDb(a.studioId).orderPhoto.findFirstOrThrow({ where: { id: brokenId } });
    expect(broken.publishedAt).toBeNull();
    expect(broken.publicKey).toBeNull();
    expect([...mocks.objects.keys()].some((key) => key.includes(`/portfolio/${brokenId}/`))).toBe(false);
    expect(mocks.objects.get(brokenKey)?.body.toString()).toBe("not-an-image");
  });

  it("unpublishes through the domain helper without touching another studio", async () => {
    const a = await fixture(0);
    const b = await fixture(1);
    await publishPhoto(b.studioId, b.photo.id, users.owner!.id, { plateVisible: false, mask });
    await expect(unpublishPhoto(a.studioId, b.photo.id, users.owner!.id)).rejects.toMatchObject({ status: 404 });
    expect((await studioDb(b.studioId).orderPhoto.findFirstOrThrow({ where: { id: b.photo.id } })).publishedAt).toBeTruthy();
    const html = renderToStaticMarkup(await PublicPortfolioPage({ params: Promise.resolve({ slug: `${tag}-a` }) }));
    expect(html).not.toContain(b.photo.id);
    expect(html).not.toContain(`Marka-${tag}-1`);
  });
});
