import { Analytics } from "@/components/admin/Analytics";
import { getPlatformAnalytics } from "@/src/server/admin/analytics";

export default async function AdminAnalyticsPage() {
  const data = await getPlatformAnalytics();
  return <Analytics data={data} />;
}
