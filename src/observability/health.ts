export type HealthCheck = () => Promise<void>;

export type HealthReport = {
  status: "ok" | "error";
  time: string;
  checks: { db: "ok" | "error"; redis: "ok" | "error" };
};

async function probe(check: HealthCheck): Promise<"ok" | "error"> {
  try {
    await check();
    return "ok";
  } catch {
    return "error";
  }
}

export async function healthReport(input: { checkDb: HealthCheck; checkRedis: HealthCheck; now?: Date }): Promise<HealthReport> {
  const [db, redis] = await Promise.all([probe(input.checkDb), probe(input.checkRedis)]);
  return {
    status: db === "ok" && redis === "ok" ? "ok" : "error",
    time: (input.now ?? new Date()).toISOString(),
    checks: { db, redis },
  };
}
