import { createHash } from "node:crypto";
import { Redis } from "ioredis";
import { redisConnection } from "../../ksef/queue";

export type Rule = { window: number; max: number };
export type Decision = { allowed: boolean; retryAfter: number | null };
export interface Counter { consume(key: string, rule: Rule): Promise<Decision> }

// Atomic read/decide/write. Keep the existing auth semantics: the window starts
// at the last allowed request; rejected requests do not extend the lockout.
const CONSUME = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local window = tonumber(ARGV[1])
local max = tonumber(ARGV[2])
local data = redis.call('HMGET', KEYS[1], 'count', 'last')
local count = tonumber(data[1]) or 0
local last = tonumber(data[2]) or 0
if now - last >= window then count = 0 end
if count >= max then return {0, math.max(1, math.ceil((last + window - now) / 1000))} end
redis.call('HSET', KEYS[1], 'count', count + 1, 'last', now)
redis.call('PEXPIRE', KEYS[1], window)
return {1, 0}
`;

export function counterKey(scope: string, subject: string) {
  return `detailflow:rate:${scope}:${createHash("sha256").update(subject).digest("hex")}`;
}

export function redisCounter(client: Pick<Redis, "eval">): Counter {
  return { async consume(key, rule) {
    const [allowed, retry] = await client.eval(CONSUME, 1, key, rule.window * 1000, rule.max) as number[];
    return { allowed: allowed === 1, retryAfter: allowed === 1 ? null : retry! };
  } };
}

// Explicit test double, never a fallback for a failed production connection.
export function fakeCounter(now = Date.now): Counter {
  const rows = new Map<string, { count: number; last: number }>();
  return { async consume(key, rule) {
    const time = now();
    const row = rows.get(key);
    if (row && time - row.last < rule.window * 1000 && row.count >= rule.max) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((row.last + rule.window * 1000 - time) / 1000)) };
    }
    rows.set(key, { count: row && time - row.last < rule.window * 1000 ? row.count + 1 : 1, last: time });
    return { allowed: true, retryAfter: null };
  } };
}

let counter: Counter | undefined;
export function sharedCounter(): Counter {
  if (counter) return counter;
  if (process.env.NODE_ENV === "test") return counter = fakeCounter();
  if (!process.env.REDIS_URL) throw new Error("REDIS_URL is required for rate limiting");
  const client = new Redis({ ...redisConnection(), lazyConnect: true, maxRetriesPerRequest: 1,
    connectTimeout: 1500, commandTimeout: 2000 });
  // Avoid unhandled error events; callers return a generic denial on failure.
  client.on("error", () => {});
  return counter = redisCounter(client);
}

export function authCounter(realm: "studio" | "platform", getCounter = sharedCounter): Counter {
  return { async consume(key, rule) {
    try { return await getCounter().consume(counterKey(`auth:${realm}`, key), rule); }
    catch { return { allowed: false, retryAfter: rule.window }; }
  } };
}

export const API_WRITE_RULE = { window: 60, max: 60 };
