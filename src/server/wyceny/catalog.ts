import { z } from "zod";
import { studioDb } from "../../../lib/db/tenant";
import { AccessError } from "../acl";

export const DEFAULT_SERVICES = [
  { code: "correction", name: "Korekta lakieru", description: "Dwa etapy · usunięcie mikrorys", basePrice: "2000.00", durationMin: 400, sort: 0 },
  { code: "ceramic", name: "Powłoka ceramiczna", description: "Ochrona 3 lata · CarPro CQuartz", basePrice: "2000.00", durationMin: 200, sort: 1 },
  { code: "interior", name: "Detailing wnętrza", description: "Czyszczenie i pielęgnacja wnętrza", basePrice: "650.00", durationMin: 150, sort: 2 },
  { code: "wash", name: "Mycie detailingowe", description: "Mycie ręczne i dekontaminacja", basePrice: "250.00", durationMin: 50, sort: 3 },
];

export async function seedServices(studioId: string) {
  await studioDb(studioId).service.createMany({
    data: DEFAULT_SERVICES.map((service) => ({ ...service, studioId })), skipDuplicates: true,
  });
}

export const money = z.string().regex(/^\d{1,8}(\.\d{1,2})?$/);
const serviceSchema = z.object({ name: z.string().trim().min(1).max(120), basePrice: money, durationMin: z.number().int().min(0).max(60000) });
export async function updateService(studioId: string, id: string, input: unknown) {
  const data = serviceSchema.parse(input);
  const result = await studioDb(studioId).service.updateMany({ where: { id }, data });
  if (!result.count) throw new AccessError(404, "Nie znaleziono usługi.");
}
