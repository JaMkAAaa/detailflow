import { SystemScreen } from "@/components/admin/SystemScreen";
import { getSystemSnapshot } from "@/src/server/admin/system";

export const metadata = { title: "System i KSeF — Detailflow" };

export default async function AdminSystemPage() {
  return <SystemScreen data={await getSystemSnapshot()} />;
}
