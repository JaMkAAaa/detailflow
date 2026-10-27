import { StudiosScreen } from "@/components/admin/StudiosScreen";
import { parseStudiosQuery } from "@/src/server/admin/accounts";
import { listStudios } from "@/src/server/admin/directory";

export const metadata = { title: "Studia — Detailflow" };

export default async function StudiosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const data = await listStudios(parseStudiosQuery(await searchParams));
  return <StudiosScreen data={data} />;
}
