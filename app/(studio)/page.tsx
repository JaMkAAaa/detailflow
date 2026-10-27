import { Dashboard } from "@/components/pulpit/dashboard";
import { MobileDashboard } from "@/components/pulpit/mobile-dashboard";
import { requireStudio } from "@/src/server/studio/context";
import { getDashboardMetrics } from "@/src/server/pulpit/metrics";

export default async function DashboardPage() {
  const { studioId, user } = await requireStudio();
  const data = await getDashboardMetrics(studioId);
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
