import { Overview } from "@/components/admin/Overview";
import { getPlatformOverview } from "@/src/server/admin/overview";

export default async function PlatformOverviewPage() {
  const data = await getPlatformOverview();
  return <Overview data={data} />;
}
