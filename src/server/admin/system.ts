import net from "node:net";
import type { KsefEnv } from "@/lib/db/generated/client";
import { platformDb } from "@/lib/db/client";
import { queueAgeMinutes, queueIncidents, splitKsefGroups, topErrorCategories, type EnvAcceptance } from "./ksef-health";

export type ServiceProbe = "ok" | "down" | "unconfigured";

const PENDING = ["queued", "processing", "retrying"] as const;

function pingRedis(url: string, timeoutMs = 800): Promise<Exclude<ServiceProbe, "unconfigured">> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: "ok" | "down") => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      finish("down");
      return;
    }
    if (parsed.protocol !== "redis:") {
      finish("down");
      return;
    }
    const socket = net.connect({ host: parsed.hostname, port: Number(parsed.port || 6379) });
    const timer = setTimeout(() => {
      socket.destroy();
      finish("down");
    }, timeoutMs);
    socket.on("error", () => {
      clearTimeout(timer);
      socket.destroy();
      finish("down");
    });
    socket.on("connect", () => {
      const password = decodeURIComponent(parsed.password);
      socket.write(`${password ? `AUTH ${password}\r\n` : ""}PING\r\n`);
    });
    socket.on("data", (buf) => {
      clearTimeout(timer);
      socket.end();
      finish(buf.toString().includes("+PONG") ? "ok" : "down");
    });
  });
}

async function probeDatabase(): Promise<ServiceProbe> {
  try {
    await platformDb.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "down";
  }
}

async function probeRedis(): Promise<ServiceProbe> {
  const url = process.env.REDIS_URL;
  if (!url) return "unconfigured";
  try {
    return await pingRedis(url);
  } catch {
    return "down";
  }
}

async function oldestPending(env: KsefEnv) {
  const row = await platformDb.invoice.findFirst({
    where: { ksefEnv: env, ksefStatus: { in: [...PENDING] } },
    orderBy: { updatedAt: "asc" },
    select: { updatedAt: true },
  });
  return row?.updatedAt ?? null;
}

export async function ksefErrorCounts(env: KsefEnv) {
  const rows = await platformDb.ksefEvent.groupBy({
    by: ["message"],
    where: { kind: "rejected", invoice: { ksefEnv: env } },
    _count: { _all: true },
  });
  return rows.map((row) => ({ message: row.message, count: row._count._all }));
}

export type SystemProbes = {
  database?: () => Promise<ServiceProbe>;
  redis?: () => Promise<ServiceProbe>;
  stripe?: () => ServiceProbe;
  mail?: () => ServiceProbe;
};

export async function getSystemSnapshot(now = new Date(), probes: SystemProbes = {}) {
  const [database, redis, grouped, oldestTest, oldestProd, testErrors, prodErrors] = await Promise.all([
    (probes.database ?? probeDatabase)(),
    (probes.redis ?? probeRedis)(),
    platformDb.invoice.groupBy({ by: ["ksefEnv", "ksefStatus"], _count: { _all: true } }),
    oldestPending("test"),
    oldestPending("production"),
    ksefErrorCounts("test"),
    ksefErrorCounts("production"),
  ]);
  const stripe = (probes.stripe ?? (() => (process.env.STRIPE_SECRET_KEY ? "ok" : "unconfigured")))();
  const mail = (probes.mail ?? (() => (process.env.SMTP_URL || process.env.RESEND_API_KEY ? "ok" : "unconfigured")))();
  const acceptance = splitKsefGroups(grouped.map((row) => ({
    env: row.ksefEnv,
    status: row.ksefStatus,
    count: row._count._all,
  })));
  const age = {
    test: queueAgeMinutes(oldestTest, now),
    production: queueAgeMinutes(oldestProd, now),
  };
  const withAge = (stats: EnvAcceptance, minutes: number | null) => ({ ...stats, ageMinutes: minutes });
  return {
    services: [
      { key: "database", label: "PostgreSQL", status: database, hint: "Zapytanie SELECT 1" },
      { key: "redis", label: "Redis", status: redis, hint: "PING brokera kolejki" },
      { key: "stripe", label: "Stripe", status: stripe, hint: "Klucz abonamentu, bez wywołania API" },
      { key: "mail", label: "Poczta", status: mail, hint: "SMTP albo Resend" },
    ],
    ksef: {
      test: withAge(acceptance.test, age.test),
      production: withAge(acceptance.production, age.production),
    },
    incidents: queueIncidents(age),
    errors: {
      test: topErrorCategories(testErrors),
      production: topErrorCategories(prodErrors),
    },
  };
}

export type SystemSnapshot = Awaited<ReturnType<typeof getSystemSnapshot>>;
