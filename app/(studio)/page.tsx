import { Dashboard } from "@/components/pulpit/dashboard";
import { requireStudio } from "@/src/server/studio/context";
import { getDashboardMetrics } from "@/src/server/pulpit/metrics";

export default async function DashboardPage() {
  const { studioId, user } = await requireStudio();
  return (
    <Dashboard data={await getDashboardMetrics(studioId)} name={user.name} />
  );
}
