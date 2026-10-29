import { permissions } from "@/src/server/acl";
import { Dashboard } from "@/components/pulpit/dashboard";
import { MobileDashboard } from "@/components/pulpit/mobile-dashboard";
import { requireStudio } from "@/src/server/studio/context";
import { getDashboardMetrics } from "@/src/server/pulpit/metrics";
import { studioNow } from "@/src/server/pulpit/demo-clock";

export default async function DashboardPage() {
  const { studioId, user, member } = await requireStudio();
  const now = await studioNow(studioId);
  const data = await getDashboardMetrics(studioId, now);
  return (
    <>
      <div className="lg:hidden">
        <MobileDashboard data={data} name={user.name} studioId={studioId} canInvoice={(permissions["invoices:manage"] as readonly string[]).includes(member.role)} />
      </div>
      <div className="hidden lg:block">
        <Dashboard data={data} name={user.name} studioId={studioId} canInvoice={(permissions["invoices:manage"] as readonly string[]).includes(member.role)} />
      </div>
    </>
  );
}
