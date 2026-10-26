import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Prawdziwy S3 (MinIO). Pominięty, dopóki nie ustawisz S3_TEST_ENDPOINT, np.:
//   docker run -d -p 19000:9000 -e MINIO_ROOT_USER=detailflow -e MINIO_ROOT_PASSWORD=detailflow-dev-secret pgsty/minio server /data
//   S3_TEST_ENDPOINT=http://localhost:19000 S3_TEST_BUCKET=detailflow-test pnpm test src/server/zlecenia/storage.minio
// Bucket musi istnieć i być prywatny (`mc anonymous set none`).
const endpoint = process.env.S3_TEST_ENDPOINT;
vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  if (process.env.S3_TEST_ENDPOINT) {
    process.env.S3_ENDPOINT = process.env.S3_TEST_ENDPOINT;
    process.env.S3_BUCKET = process.env.S3_TEST_BUCKET ?? "detailflow-test";
    process.env.S3_ACCESS_KEY ??= "detailflow";
    process.env.S3_SECRET_KEY ??= "detailflow-dev-secret";
  }
});

describe.skipIf(!endpoint)("S3: prywatny bucket i podpisane URL-e (MinIO)", () => {
  const prefix = `studios/test-${randomUUID()}/orders/o1`;
  const key = `${prefix}/${randomUUID().replaceAll("-", "")}.jpg`;
  const body = Buffer.from("fake-jpeg-bytes");
  let storage: typeof import("../../../lib/storage");
  beforeAll(async () => { storage = await import("../../../lib/storage"); });
  afterAll(async () => { await storage?.deleteObject(key); });

  const put = (url: string, init: { type?: string; data?: Buffer } = {}) =>
    fetch(url, { method: "PUT", headers: { "Content-Type": init.type ?? "image/jpeg" }, body: new Uint8Array(init.data ?? body) });

  it("PUT wymaga podpisanego Content-Type i długości; zgodny upload działa", async () => {
    const url = await storage.presignPut({ key, contentType: "image/jpeg", sizeBytes: body.length, expiresIn: 60 });
    expect((await put(url, { type: "text/html" })).status).toBe(403);
    expect((await put(url, { data: Buffer.concat([body, body]) })).status).toBe(403);
    expect(await storage.headObject(key)).toBeNull();
    expect((await put(url)).status).toBe(200);
    expect(await storage.headObject(key)).toEqual({ sizeBytes: body.length, contentType: "image/jpeg" });
  });
  it("GET działa tylko z podpisem; bez podpisu, z podmienionym kluczem i po wygaśnięciu → 403", async () => {
    const url = await storage.presignGet(key, 60);
    const ok = await fetch(url);
    expect(ok.status).toBe(200);
    expect(Buffer.from(await ok.arrayBuffer())).toEqual(body);
    expect((await fetch(url.split("?")[0]!)).status).toBe(403);
    expect((await fetch(url.replace(prefix, "studios/inny/orders/o1"))).status).toBe(403);
    const short = await storage.presignGet(key, 1);
    await new Promise((resolve) => setTimeout(resolve, 2200));
    expect((await fetch(short)).status).toBe(403);
  });
  it("PUT po wygaśnięciu podpisu → 403", async () => {
    const url = await storage.presignPut({ key: `${prefix}/expired.jpg`, contentType: "image/jpeg", sizeBytes: body.length, expiresIn: 1 });
    await new Promise((resolve) => setTimeout(resolve, 2200));
    expect((await put(url)).status).toBe(403);
  });
  it("headObject zwraca null dla brakującego obiektu", async () => {
    expect(await storage.headObject(`${prefix}/nie-ma.jpg`)).toBeNull();
  });
});
