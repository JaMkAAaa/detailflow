import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { Redis } from "ioredis";
import { expect, it } from "vitest";
import { authCounter, counterKey, fakeCounter, redisCounter } from "./index";

it("keeps the sliding window and does not extend it on denied requests", async () => {
  let now = 1000;
  const store = fakeCounter(() => now);
  const rule = { window: 60, max: 2 };
  expect((await store.consume("a", rule)).allowed).toBe(true);
  now += 1000;
  expect((await store.consume("a", rule)).allowed).toBe(true);
  now += 59000;
  expect(await store.consume("a", rule)).toEqual({ allowed: false, retryAfter: 1 });
  now += 1000;
  expect((await store.consume("a", rule)).allowed).toBe(true);
});

it("separates subjects and auth realms; stores only hashed subjects", async () => {
  const store = fakeCounter();
  const studio = authCounter("studio", () => store);
  const platform = authCounter("platform", () => store);
  const rule = { window: 60, max: 1 };
  expect((await studio.consume("ip:path", rule)).allowed).toBe(true);
  expect((await studio.consume("ip:path", rule)).allowed).toBe(false);
  expect((await platform.consume("ip:path", rule)).allowed).toBe(true);
  expect(counterKey("api-write", "user@example.com")).not.toContain("user@example.com");
  expect((await store.consume(counterKey("api-write", "other-user"), rule)).allowed).toBe(true);
});

it("denies auth generically when Redis is unavailable", async () => {
  const auth = authCounter("studio", () => ({ consume: async () => { throw new Error("private connection error"); } }));
  expect(await auth.consume("key", { window: 60, max: 5 })).toEqual({ allowed: false, retryAfter: 60 });
});

it.skipIf(!process.env.RATE_LIMIT_REDIS_TEST_URL)("shares an atomic bucket between two independent processes and expires it", async () => {
  const url = process.env.RATE_LIMIT_REDIS_TEST_URL!;
  const key = counterKey("test", randomUUID());
  const client = new Redis(url);
  try {
    const script = `
      import { Redis } from 'ioredis';
      import { redisCounter } from './src/server/rate-limit/index.ts';
      const client = new Redis(process.env.RATE_LIMIT_REDIS_TEST_URL);
      try {
        const results = await Promise.all(Array.from({length: 12}, () => redisCounter(client).consume(process.env.RATE_LIMIT_TEST_KEY, {window: 60, max: 5})));
        console.log(results.filter(r => r.allowed).length);
      } finally { await client.quit(); }
    `;
    const run = () => promisify(execFile)(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
      env: { ...process.env, RATE_LIMIT_TEST_KEY: key },
    });
    const results = await Promise.all([run(), run()]);
    expect(results.reduce((sum, r) => sum + Number(r.stdout.trim()), 0)).toBe(5);
    expect(await client.pttl(key)).toBeGreaterThan(0);
    // Expiry allows a new request, including after a different process filled it.
    await client.pexpire(key, 1);
    await new Promise(resolve => setTimeout(resolve, 10));
    expect((await redisCounter(client).consume(key, { window: 60, max: 5 })).allowed).toBe(true);
  } finally { await client.del(key); await client.quit(); }
});
