import { StatisticsScreen } from "@/components/statystyki/StatisticsScreen";
import { requireStudio } from "@/src/server/studio/context";
import { studioNow } from "@/src/server/pulpit/demo-clock";
import { AccessError } from "@/src/server/access-error";
import { getStudioStatistics, parseStatisticsRange, statisticsPresets } from "@/src/server/statystyki/statistics";

type SearchParams = Promise<{ from?: string | string[]; to?: string | string[] }>;
const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function StatisticsPage({ searchParams }: { searchParams: SearchParams }) {
  const { studioId } = await requireStudio("stats:read");
  const now = await studioNow(studioId);
  const query = await searchParams;
  let error: string | null = null;
  let range;
  try {
    range = parseStatisticsRange({ from: single(query.from), to: single(query.to) }, now);
  } catch (caught) {
    if (!(caught instanceof AccessError)) throw caught;
    error = caught.message;
    range = parseStatisticsRange({}, now);
  }
  return <StatisticsScreen key={studioId} data={await getStudioStatistics(studioId, range)} presets={statisticsPresets(now)} error={error} />;
}
