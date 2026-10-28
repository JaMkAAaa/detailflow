import { checkDatabase } from "@/src/observability/db-check";
import { healthReport } from "@/src/observability/health";
import { logger } from "@/src/observability/logger";
import { pingRedis } from "@/src/observability/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const report = await healthReport({
    checkDb: checkDatabase,
    checkRedis: () => pingRedis(process.env.REDIS_URL ?? ""),
  });
  if (report.status !== "ok") logger.warn({ checks: report.checks }, "health check failed");
  return Response.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
