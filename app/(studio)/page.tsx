import { Dashboard } from "@/components/pulpit/dashboard";
import { MobileDashboard } from "@/components/pulpit/mobile-dashboard";
import { platformDb } from "@/lib/db/client";
import { requireStudio } from "@/src/server/studio/context";
import { getDashboardMetrics } from "@/src/server/pulpit/metrics";

// „Teraz” makiety D-01: 24.10.2026, 11:30 czasu Warszawy. Ten sam instant co DEMO.now w seedzie.
const DEMO_DASHBOARD_AT = new Date("2026-10-24T09:30:00.000Z");

export default async function DashboardPage() {
  const { studioId, user } = await requireStudio();
  const studio = await platformDb.studio.findUnique({ where: { id: studioId }, select: { slug: true } });
  const now = studio?.slug === "obsidian-studio" ? DEMO_DASHBOARD_AT : new Date();
  const data = await getDashboardMetrics(studioId, now);
  return (
    <>
      <div className="lg:hidden">
        <MobileDashboard data={data} name={user.name} />
      </div>
      <div className="hidden lg:block">
        <Dashboard data={data} name={user.name} />
      </div>
    </>
  );
}
