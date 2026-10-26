import { z } from "zod";
import { Prisma } from "../../../lib/db/generated/client";
import { studioDb } from "../../../lib/db/tenant";
import { presignGet } from "../../../lib/storage";
import { OrderError } from "./errors";
import { VIEW_URL_TTL_S } from "./photos";

export const MAX_DAMAGES = 30;

const fraction = z.number().min(0).max(1);
export const damageSchema = z.object({
  title: z.string().trim().min(1).max(120),
  part: z.string().trim().min(1).max(80),
  size: z.string().trim().min(1).max(80).optional(),
  // Położenie na schemacie auta jako ułamek jego szerokości/wysokości.
  x: fraction,
  y: fraction,
  photoId: z.string().min(1).optional(),
}).strict();
// Punkty numerowane są 1..n według kolejności w tablicy.
export const protocolSchema = z.object({ damages: z.array(damageSchema).max(MAX_DAMAGES) }).strict();

const select = {
  id: true, number: true, createdAt: true, updatedAt: true, acceptedAt: true,
  createdBy: { select: { id: true, name: true } },
  damages: {
    orderBy: { no: "asc" },
    select: { id: true, no: true, title: true, part: true, size: true, posX: true, posY: true, photo: { select: { id: true, no: true, key: true } } },
  },
} satisfies Prisma.IntakeProtocolSelect;
type ProtocolRow = Prisma.IntakeProtocolGetPayload<{ select: typeof select }>;

async function present({ damages, ...protocol }: ProtocolRow) {
  return {
    ...protocol,
    damages: await Promise.all(damages.map(async ({ photo, posX, posY, ...damage }) => ({
      ...damage, x: posX, y: posY,
      photo: photo && { id: photo.id, no: photo.no, url: await presignGet(photo.key, VIEW_URL_TTL_S), urlExpiresIn: VIEW_URL_TTL_S },
    }))),
  };
}

export async function getProtocol(studioId: string, workOrderId: string) {
  const protocol = await studioDb(studioId).intakeProtocol.findFirst({ where: { workOrderId }, select });
  if (!protocol) throw new OrderError(404, "Nie znaleziono protokołu przyjęcia.");
  return present(protocol);
}

/** DF-0248 → P-0248. */
const protocolNumber = (orderNumber: string) => `P-${orderNumber.replace(/^DF-/, "")}`;

/**
 * Tworzy protokół zlecenia albo zastępuje jego punkty uszkodzeń. Po akceptacji
 * klienta protokół jest niezmienny (409), także przy równoległej akceptacji.
 */
export async function saveProtocol(studioId: string, workOrderId: string, userId: string, input: unknown) {
  const { damages } = protocolSchema.parse(input);
  const db = studioDb(studioId);

  const photoIds = [...new Set(damages.flatMap((d) => (d.photoId ? [d.photoId] : [])))];
  const id = await db.$transaction(async (tx) => {
    const order = await tx.workOrder.findFirst({ where: { id: workOrderId }, select: { number: true } });
    if (!order) throw new OrderError(404, "Nie znaleziono zlecenia.");
    // Zdjęcie punktu musi być wgrane i należeć do tego samego zlecenia.
    const photos = await tx.orderPhoto.count({ where: { id: { in: photoIds }, workOrderId, uploadedAt: { not: null } } });
    if (photos !== photoIds.length) throw new OrderError(400, "Zdjęcie punktu uszkodzenia nie należy do tego zlecenia.");

    let protocolId: string;
    const existing = await tx.intakeProtocol.findFirst({ where: { workOrderId }, select: { id: true } });
    if (existing) {
      // Zapis blokuje wiersz, więc akceptacja w tle nie wyprzedzi podmiany punktów.
      const locked = await tx.intakeProtocol.updateMany({ where: { id: existing.id, acceptedAt: null }, data: { updatedAt: new Date() } });
      if (!locked.count) throw new OrderError(409, "Protokół jest zaakceptowany przez klienta i nie można go zmienić.");
      await tx.intakeDamage.deleteMany({ where: { protocolId: existing.id } });
      protocolId = existing.id;
    } else {
      protocolId = (await tx.intakeProtocol.create({
        data: { studioId, workOrderId, number: protocolNumber(order.number), createdById: userId }, select: { id: true },
      })).id;
    }
    if (damages.length) {
      await tx.intakeDamage.createMany({
        data: damages.map((d, index) => ({
          studioId, protocolId, no: index + 1, title: d.title, part: d.part, size: d.size ?? null, posX: d.x, posY: d.y, photoId: d.photoId ?? null,
        })),
      });
    }
    return protocolId;
  }).catch((error: unknown) => {
    // Dwa równoległe pierwsze zapisy: przegrany widzi istniejący protokół.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new OrderError(409, "Protokół jest właśnie zapisywany. Spróbuj ponownie.");
    }
    throw error;
  });
  const protocol = await db.intakeProtocol.findFirst({ where: { id }, select });
  return present(protocol!);
}

/** Akceptacja klienta (flaga). Idempotentna; UI portalu podłączy ją później. */
export async function acceptProtocol(studioId: string, workOrderId: string) {
  const db = studioDb(studioId);
  await db.intakeProtocol.updateMany({ where: { workOrderId, acceptedAt: null }, data: { acceptedAt: new Date() } });
  return getProtocol(studioId, workOrderId);
}
