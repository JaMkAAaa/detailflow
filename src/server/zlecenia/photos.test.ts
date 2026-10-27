import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import { assertKeyInStudio, confirmPhotoUpload, listPhotos, photoKey, requestPhotoUpload } from "./photos";
import { acceptProtocol, getProtocol, saveProtocol } from "./intake";
import { GET as listRoute, POST as uploadRoute } from "../../../app/api/studios/[studioId]/orders/[workOrderId]/photos/route";
import { POST as confirmRoute } from "../../../app/api/studios/[studioId]/orders/[workOrderId]/photos/confirm/route";
import { GET as protocolGet, PUT as protocolPut } from "../../../app/api/studios/[studioId]/orders/[workOrderId]/protocol/route";
import { POST as acceptRoute } from "../../../app/api/studios/[studioId]/orders/[workOrderId]/protocol/accept/route";

// S3 jest tu podmienione pamięcią; prawdziwy MinIO sprawdza storage.minio.test.ts.
const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  return { session: vi.fn(), objects: new Map<string, { sizeBytes: number; contentType: string }>() };
});
vi.mock("../../../lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("../../../lib/storage", () => ({
  presignPut: async ({ key, expiresIn }: { key: string; expiresIn: number }) => `https://s3.test/put/${key}?expires=${expiresIn}`,
  presignGet: async (key: string, expiresIn: number) => `https://s3.test/get/${key}?expires=${expiresIn}`,
  headObject: async (key: string) => mocks.objects.get(key) ?? null,
  deleteObject: async (key: string) => { mocks.objects.delete(key); },
}));

const jpeg = { contentType: "image/jpeg", sizeBytes: 1024 };
const upload = (key: string, body = jpeg) => mocks.objects.set(key, { sizeBytes: body.sizeBytes, contentType: body.contentType });
const damage = (photoId?: string) => ({ title: "Rysa na lewym błotniku", part: "Lewy błotnik", size: "Około 4 cm", x: 0.22, y: 0.21, ...(photoId ? { photoId } : {}) });

describe("zdjęcia i protokół przyjęcia (Postgres)", () => {
  const tag = randomUUID();
  const studios: string[] = [];
  const orders: string[][] = [];
  let userId: string, workerId: string, outsiderId: string;
  beforeAll(async () => {
    userId = (await platformDb.user.create({ data: { name: "Michał Kowalski", email: `${tag}@example.com` } })).id;
    workerId = (await platformDb.user.create({ data: { name: "Kamil", email: `${tag}-w@example.com` } })).id;
    outsiderId = (await platformDb.user.create({ data: { name: "Obcy", email: `${tag}-o@example.com` } })).id;
    for (const suffix of ["a", "b"]) {
      const studioId = (await platformDb.studio.create({ data: { status: "active", name: tag, publicCode: `${tag}-${suffix}`, slug: `${tag}-${suffix}` } })).id;
      studios.push(studioId);
      const db = studioDb(studioId);
      await db.membership.create({ data: { studioId, userId, role: "manager" } });
      if (suffix === "a") await db.membership.create({ data: { studioId, userId: workerId, role: "worker" } });
      const client = await db.client.create({ data: { studioId, name: tag } });
      const vehicle = await db.vehicle.create({ data: { studioId, clientId: client.id, make: "Porsche", model: "Panamera", plate: tag } });
      const local: string[] = [];
      for (let i = 0; i < 3; i++) local.push((await db.workOrder.create({ data: {
        studioId, clientId: client.id, vehicleId: vehicle.id, number: `DF-${suffix === "a" ? "02" : "09"}4${i}`, status: "in_progress", service: "Korekta", stage: 2,
        scheduledFrom: new Date("2026-10-27T08:00Z"), scheduledTo: new Date("2026-10-27T09:00Z"), totalGross: "4800.00",
      } })).id);
      orders.push(local);
    }
  });
  afterAll(async () => {
    await platformDb.studio.deleteMany({ where: { id: { in: studios } } });
    await platformDb.user.deleteMany({ where: { id: { in: [userId, workerId, outsiderId] } } });
  });

  const context = (studioId: string, workOrderId: string) => ({ params: Promise.resolve({ studioId, workOrderId }) });
  const request = (method: string, data?: unknown, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/x", {
    method, headers: { origin, "content-type": "application/json" }, ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const addPhoto = async (studioId: string, workOrderId: string, body = jpeg) => {
    const requested = await requestPhotoUpload(studioId, workOrderId, userId, body);
    upload(requested.key, body);
    return confirmPhotoUpload(studioId, workOrderId, { key: requested.key }).then((photo) => ({ ...photo, key: requested.key }));
  };

  describe("zdjęcia", () => {
    it("wydaje podpisany URL pod kluczem z prefiksem studia i ukrywa zdjęcie do potwierdzenia", async () => {
      const [a] = studios, [order] = orders[0]!;
      const requested = await requestPhotoUpload(a!, order!, userId, { ...jpeg, caption: "Przód auta" });
      expect(requested).toMatchObject({ no: 1, stage: 2, headers: { "Content-Type": "image/jpeg" } });
      expect(requested.key).toBe(photoKey(a!, order!, requested.id, "image/jpeg"));
      expect(requested.key.startsWith(`studios/${a}/orders/${order}/`)).toBe(true);
      expect(requested.uploadUrl).toContain(requested.key);
      expect(await listPhotos(a!, order!)).toEqual([]);
      await expect(confirmPhotoUpload(a!, order!, { key: requested.key })).rejects.toMatchObject({ status: 409 });

      upload(requested.key);
      const confirmed = await confirmPhotoUpload(a!, order!, { key: requested.key });
      expect(confirmed).toMatchObject({ no: 1, caption: "Przód auta", uploadedBy: { name: "Michał Kowalski" } });
      expect(confirmed.uploadedAt).toBeInstanceOf(Date);
      expect(confirmed.createdAt).toBeInstanceOf(Date);
      expect(confirmed).not.toHaveProperty("key");
      expect(confirmed.url).toContain(`/get/${requested.key}`);
      expect(await confirmPhotoUpload(a!, order!, { key: requested.key })).toMatchObject({ id: requested.id }); // idempotentne
      expect(await listPhotos(a!, order!)).toHaveLength(1);
    });
    it("nadaje unikalne kolejne numery także przy równoległych żądaniach", async () => {
      const a = studios[0]!, order = orders[0]![1]!;
      const results = await Promise.all(Array.from({ length: 6 }, () => requestPhotoUpload(a, order, userId, { ...jpeg, stage: 3 })));
      expect(results.map((r) => r.no).sort()).toEqual([1, 2, 3, 4, 5, 6]);
      expect(results.every((r) => r.stage === 3)).toBe(true);
    });
    it.each([
      ["typ", { contentType: "application/pdf", sizeBytes: 10 }],
      ["rozmiar 0", { contentType: "image/png", sizeBytes: 0 }],
      ["rozmiar > 20 MB", { contentType: "image/png", sizeBytes: 20 * 1024 * 1024 + 1 }],
      ["etap 5", { ...jpeg, stage: 5 }],
      ["dodatkowe pole", { ...jpeg, key: "studios/x/y" }],
    ])("odrzuca nieprawidłowe dane: %s", async (_name, body) => {
      await expect(requestPhotoUpload(studios[0]!, orders[0]![0]!, userId, body)).rejects.toMatchObject({ name: "ZodError" });
    });
    it("usuwa plik i wiersz, gdy wgrany obiekt nie zgadza się z zapowiedzią", async () => {
      const a = studios[0]!, order = orders[0]![2]!;
      const requested = await requestPhotoUpload(a, order, userId, jpeg);
      upload(requested.key, { contentType: "image/jpeg", sizeBytes: 99_999_999 });
      await expect(confirmPhotoUpload(a, order, { key: requested.key })).rejects.toMatchObject({ status: 400 });
      expect(mocks.objects.has(requested.key)).toBe(false);
      expect(await studioDb(a).orderPhoto.count({ where: { id: requested.id } })).toBe(0);
    });
    it("klucz spoza prefiksu studia → 403, zanim dotknie bazy lub S3", async () => {
      const [a, b] = studios as [string, string], orderA = orders[0]![0]!, orderB = orders[1]![0]!;
      const foreign = await addPhoto(b, orderB);
      expect(() => assertKeyInStudio(a, foreign.key)).toThrowError(expect.objectContaining({ status: 403 }));
      mocks.session.mockResolvedValue({ user: { id: userId } });
      const response = await confirmRoute(request("POST", { key: foreign.key }), context(a, orderA));
      expect(response.status).toBe(403);
      for (const key of [`studios/${b}/orders/${orderB}/x.jpg`, `studios/${a}x/orders/${orderA}/x.jpg`, `../studios/${b}/orders/${orderB}/x.jpg`, `studios/${b}/../${a}/orders/${orderA}/x.jpg`]) {
        expect((await confirmRoute(request("POST", { key }), context(a, orderA))).status).toBe(403);
      }
    });
    it("klucz własnego studia, ale ze ścieżką lub cudzym zleceniem, nie przechodzi", async () => {
      const a = studios[0]!, [order, other] = orders[0]!;
      const photo = await addPhoto(a, order!);
      mocks.session.mockResolvedValue({ user: { id: userId } });
      expect((await confirmRoute(request("POST", { key: photo.key }), context(a, other!))).status).toBe(404);
      expect((await confirmRoute(request("POST", { key: `studios/${a}/../${a}/orders/${order}/x.jpg` }), context(a, order!))).status).toBe(400);
      expect((await confirmRoute(request("POST", { key: `studios/${a}/orders/${order}/nieistnieje.jpg` }), context(a, order!))).status).toBe(404);
    });
    it("izoluje studia: cudze zlecenie w dostępnym studiu = 404, brak członkostwa = 403", async () => {
      const [a, b] = studios as [string, string], orderB = orders[1]![0]!;
      mocks.session.mockResolvedValue({ user: { id: userId } });
      expect((await uploadRoute(request("POST", jpeg), context(a, orderB))).status).toBe(404);
      expect((await listRoute(request("GET"), context(a, orderB))).status).toBe(404);
      expect(await listPhotos(a, orderB).catch((e) => e.status)).toBe(404);
      expect(await studioDb(a).orderPhoto.count({ where: { workOrderId: orderB } })).toBe(0);
      expect((await listPhotos(b, orderB)).length).toBeGreaterThan(0);
      mocks.session.mockResolvedValue({ user: { id: outsiderId } });
      expect((await uploadRoute(request("POST", jpeg), context(a, orders[0]![0]!))).status).toBe(403);
      expect((await listRoute(request("GET"), context(a, orders[0]![0]!))).status).toBe(403);
    });
    it("HTTP: 401 bez sesji, Origin wymagany, pracownik może dodawać zdjęcia", async () => {
      const [a] = studios, [order] = orders[0]!;
      mocks.session.mockResolvedValue(null);
      expect((await uploadRoute(request("POST", jpeg), context(a!, order!))).status).toBe(401);
      mocks.session.mockResolvedValue({ user: { id: workerId } });
      expect((await uploadRoute(request("POST", jpeg, "https://evil.example"), context(a!, order!))).status).toBe(403);
      expect((await uploadRoute(request("POST", { contentType: "x" }), context(a!, order!))).status).toBe(400);
      const response = await uploadRoute(request("POST", jpeg), context(a!, order!));
      expect(response.status).toBe(201);
      const body = await response.json();
      upload(body.key);
      const confirmed = await confirmRoute(request("POST", { key: body.key }), context(a!, order!));
      expect(confirmed.status).toBe(200);
      expect(await confirmed.json()).toMatchObject({ uploadedBy: { name: "Kamil" } });
    });
  });

  describe("protokół przyjęcia", () => {
    it("zapisuje punkty 1..n ze zdjęciem, numer z numeru zlecenia i podmienia punkty do akceptacji", async () => {
      const a = studios[0]!, order = orders[0]![0]!;
      await expect(getProtocol(a, order)).rejects.toMatchObject({ status: 404 });
      const photo = await addPhoto(a, order);
      const created = await saveProtocol(a, order, userId, { damages: [damage(photo.id), { ...damage(), title: "Odprysk", part: "Prawe drzwi", x: 0.77, y: 0.69 }] });
      expect(created).toMatchObject({ number: "P-0240", acceptedAt: null, createdBy: { name: "Michał Kowalski" } });
      expect(created.damages.map((d) => [d.no, d.x])).toEqual([[1, 0.22], [2, 0.77]]);
      expect(created.damages[0]!.photo).toMatchObject({ id: photo.id, no: photo.no });
      expect(created.damages[0]!.photo!.url).toContain(`/get/${photo.key}`);
      expect(created.damages[1]!.photo).toBeNull();

      const replaced = await saveProtocol(a, order, workerId, { damages: [damage()] });
      expect(replaced.id).toBe(created.id);
      expect(replaced.damages).toHaveLength(1);
      expect(replaced.createdBy?.name).toBe("Michał Kowalski");
      expect((await saveProtocol(a, order, userId, { damages: [] })).damages).toEqual([]);
      expect((await getProtocol(a, order)).id).toBe(created.id);
    });
    it("odrzuca zdjęcie niewgrane, z innego zlecenia i z innego studia oraz złe współrzędne", async () => {
      const [a, b] = studios as [string, string], [order, other] = orders[0]!;
      const pending = await requestPhotoUpload(a, order!, userId, jpeg);
      const otherOrder = await addPhoto(a, other!);
      const foreign = await addPhoto(b, orders[1]![0]!);
      for (const photoId of [pending.id, otherOrder.id, foreign.id, "nie-ma"]) {
        await expect(saveProtocol(a, order!, userId, { damages: [damage(photoId)] })).rejects.toMatchObject({ status: 400 });
      }
      for (const bad of [{ ...damage(), x: 1.2 }, { ...damage(), y: -0.1 }, { ...damage(), title: "" }, { damages: Array(31).fill(damage()) }]) {
        await expect(saveProtocol(a, order!, userId, "damages" in bad ? bad : { damages: [bad] })).rejects.toMatchObject({ name: "ZodError" });
      }
      expect((await getProtocol(a, order!)).damages).toEqual([]); // nieudane zapisy niczego nie zmieniły
    });
    it("akceptacja klienta jest flagą, idempotentną, i zamraża protokół", async () => {
      const a = studios[0]!, order = orders[0]![0]!;
      const first = await acceptProtocol(a, order);
      expect(first.acceptedAt).toBeInstanceOf(Date);
      expect((await acceptProtocol(a, order)).acceptedAt).toEqual(first.acceptedAt);
      await expect(saveProtocol(a, order, userId, { damages: [damage()] })).rejects.toMatchObject({ status: 409 });
      expect((await getProtocol(a, order)).damages).toEqual([]);
    });
    it("równoległa akceptacja i zapis: po akceptacji punkty się nie zmieniają", async () => {
      const a = studios[0]!, order = orders[0]![1]!;
      await saveProtocol(a, order, userId, { damages: [damage()] });
      const results = await Promise.allSettled([
        saveProtocol(a, order, userId, { damages: [damage(), damage(), damage()] }),
        acceptProtocol(a, order),
      ]);
      const protocol = await getProtocol(a, order);
      expect(protocol.acceptedAt).not.toBeNull();
      const saved = results[0].status === "fulfilled";
      expect(protocol.damages).toHaveLength(saved ? 3 : 1); // zapis albo wyprzedził akceptację, albo dostał 409
      if (!saved) expect(results[0]).toMatchObject({ reason: { status: 409 } });
    });
    it("nie akceptuje nieistniejącego protokołu; izoluje studia", async () => {
      const [a, b] = studios as [string, string], orderB = orders[1]![0]!;
      await expect(acceptProtocol(a, orders[0]![2]!)).rejects.toMatchObject({ status: 404 });
      await saveProtocol(b, orderB, userId, { damages: [damage()] });
      await expect(getProtocol(a, orderB)).rejects.toMatchObject({ status: 404 });
      await expect(saveProtocol(a, orderB, userId, { damages: [] })).rejects.toMatchObject({ status: 404 });
      await expect(acceptProtocol(a, orderB)).rejects.toMatchObject({ status: 404 });
      expect((await getProtocol(b, orderB)).acceptedAt).toBeNull();
    });
    it("HTTP: PUT/GET/accept wymagają sesji i członkostwa", async () => {
      const [a] = studios as [string], order = orders[0]![2]!;
      mocks.session.mockResolvedValue(null);
      expect((await protocolGet(request("GET"), context(a, order))).status).toBe(401);
      mocks.session.mockResolvedValue({ user: { id: outsiderId } });
      expect((await protocolPut(request("PUT", { damages: [] }), context(a, order))).status).toBe(403);
      expect((await acceptRoute(request("POST"), context(a, order))).status).toBe(403);
      mocks.session.mockResolvedValue({ user: { id: workerId } });
      expect((await protocolGet(request("GET"), context(a, order))).status).toBe(404);
      expect((await protocolPut(request("PUT", { damages: [damage()] }, "https://evil.example"), context(a, order))).status).toBe(403);
      expect((await protocolPut(request("PUT", { damages: "x" }), context(a, order))).status).toBe(400);
      expect((await protocolPut(request("PUT", { damages: [damage()] }), context(a, order))).status).toBe(200);
      expect((await acceptRoute(request("POST"), context(a, order))).status).toBe(200);
      expect((await protocolPut(request("PUT", { damages: [] }), context(a, order))).status).toBe(409);
    });
  });
});
