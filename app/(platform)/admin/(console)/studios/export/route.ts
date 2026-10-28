import { parseStudiosQuery } from "@/src/server/admin/accounts";
import { requirePlatform } from "@/src/server/admin/context";
import { studiosCsv } from "@/src/server/admin/directory";

export async function GET(request: Request) {
  await requirePlatform();
  const url = new URL(request.url);
  const csv = await studiosCsv(parseStudiosQuery({ q: url.searchParams.get("q") ?? undefined, filter: url.searchParams.get("filter") ?? undefined }));
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="studia.csv"',
      "cache-control": "private, no-store",
    },
  });
}
