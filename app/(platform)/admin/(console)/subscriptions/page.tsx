import { Subscriptions } from "@/components/admin/Subscriptions";
import { requirePlatform } from "@/src/server/admin/context";
import { getPlatformSubscriptions } from "@/src/server/admin/subscriptions";

export default async function AdminSubscriptionsPage() {
  const [{ role }, data] = await Promise.all([requirePlatform(), getPlatformSubscriptions()]);
  return <Subscriptions data={data} canEdit={role !== "support"} />;
}
