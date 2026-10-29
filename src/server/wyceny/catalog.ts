import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "../../../lib/db/generated/client";
import { studioDb } from "../../../lib/db/tenant";
import { AccessError } from "../acl";

/** Katalog demonstracyjny D-06. Tylko `prisma/seed` i testy — odczyt wycen
 *  i zleceń go nie wywołuje, więc pusta albo usunięta lista nie wraca. */
export const DEFAULT_SERVICES = [
  { code: "correction", name: "Korekta lakieru", description: "Dwa etapy · usunięcie mikrorys", basePrice: "2000.00", durationMin: 400, sort: 0 },
  { code: "ceramic", name: "Powłoka ceramiczna", description: "Ochrona 3 lata · CarPro CQuartz", basePrice: "2000.00", durationMin: 200, sort: 1 },
  { code: "interior", name: "Detailing wnętrza", description: "Czyszczenie i pielęgnacja wnętrza", basePrice: "650.00", durationMin: 150, sort: 2 },
  { code: "wash", name: "Mycie detailingowe", description: "Mycie ręczne i dekontaminacja", basePrice: "250.00", durationMin: 50, sort: 3 },
];

export async function seedServices(studioId: string) {
  await studioDb(studioId).service.createMany({
    data: DEFAULT_SERVICES.map((service) => ({ ...service, studioId, active: true })),
    skipDuplicates: true,
  });
}

export const money = z.string().regex(/^\d{1,8}(\.\d{1,2})?$/);

const fields = {
  name: z.string().trim().min(1).max(120),
  basePrice: money,
  durationMin: z.number().int().min(0).max(60000),
  description: z.string().trim().max(280),
  active: z.boolean(),
};

const createSchema = z.object({
  name: fields.name,
  basePrice: fields.basePrice,
  durationMin: fields.durationMin,
  description: fields.description.optional(),
  active: fields.active.optional(),
}).strict();

const patchSchema = z.object({
  name: fields.name.optional(),
  basePrice: fields.basePrice.optional(),
  durationMin: fields.durationMin.optional(),
  description: fields.description.optional(),
  active: fields.active.optional(),
}).strict().refine((data) => Object.values(data).some((value) => value !== undefined));

export type ServiceRecord = {
  id: string;
  code: string;
  name: string;
  description: string;
  basePrice: string;
  durationMin: number;
  active: boolean;
  sort: number;
};

type ServiceRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  basePrice: Prisma.Decimal;
  durationMin: number;
  active: boolean;
  sort: number;
};

function toView(service: ServiceRow): ServiceRecord {
  return {
    id: service.id,
    code: service.code,
    name: service.name,
    description: service.description,
    basePrice: service.basePrice.toFixed(2),
    durationMin: service.durationMin,
    active: service.active,
    sort: service.sort,
  };
}

export async function listServices(studioId: string) {
  const rows = await studioDb(studioId).service.findMany({ orderBy: [{ sort: "asc" }, { name: "asc" }, { id: "asc" }] });
  return rows.map(toView);
}

export async function createService(studioId: string, input: unknown) {
  const data = createSchema.parse(input);
  const db = studioDb(studioId);
  const last = await db.service.aggregate({ _max: { sort: true } });
  const created = await db.service.create({
    data: {
      studioId,
      code: `custom_${randomUUID()}`,
      name: data.name,
      description: data.description ?? "",
      basePrice: new Prisma.Decimal(data.basePrice),
      durationMin: data.durationMin,
      active: data.active ?? true,
      sort: (last._max.sort ?? -1) + 1,
    },
  });
  return toView(created);
}

export async function updateService(studioId: string, id: string, input: unknown) {
  const parsed = patchSchema.parse(input);
  const data: {
    name?: string;
    basePrice?: Prisma.Decimal;
    durationMin?: number;
    description?: string;
    active?: boolean;
  } = {};
  if (parsed.name !== undefined) data.name = parsed.name;
  if (parsed.basePrice !== undefined) data.basePrice = new Prisma.Decimal(parsed.basePrice);
  if (parsed.durationMin !== undefined) data.durationMin = parsed.durationMin;
  if (parsed.description !== undefined) data.description = parsed.description;
  if (parsed.active !== undefined) data.active = parsed.active;
  const db = studioDb(studioId);
  const result = await db.service.updateMany({ where: { id }, data });
  if (!result.count) throw new AccessError(404, "Nie znaleziono usługi.");
  const updated = await db.service.findFirst({ where: { id } });
  if (!updated) throw new AccessError(404, "Nie znaleziono usługi.");
  return toView(updated);
}

export async function deleteService(studioId: string, id: string) {
  const result = await studioDb(studioId).service.deleteMany({ where: { id } });
  if (!result.count) throw new AccessError(404, "Nie znaleziono usługi.");
}
