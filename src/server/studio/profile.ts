import { z } from "zod";
import { platformDb } from "../../../lib/db/client";
import { validNip } from "../../../components/faktury/model";
import { AccessError } from "../acl";

const nip = z.string().trim().transform((value) => value.replace(/[ -]/g, "")).refine((value) => validNip(value));
const phone = z.string().trim().regex(/^\+?[0-9][0-9 \-]{4,30}$/);

export const studioProfileInput = z.object({
  name: z.string().trim().min(1).max(120),
  ownerLegalName: z.string().trim().min(1).max(200),
  nip,
  address: z.string().trim().min(1).max(200),
  postal: z.string().trim().regex(/^\d{2}-\d{3}$/),
  city: z.string().trim().min(1).max(100),
  phone,
}).strict();

const profileSelect = {
  name: true,
  ownerLegalName: true,
  nip: true,
  address: true,
  postal: true,
  city: true,
  phone: true,
} as const;

export type StudioProfile = {
  name: string;
  ownerLegalName: string | null;
  nip: string | null;
  address: string | null;
  postal: string | null;
  city: string | null;
  phone: string | null;
};

/** Studio jest rekordem platformy. Wywołujący musi wcześniej autoryzować `studioId`. */
export async function readStudioProfile(studioId: string): Promise<StudioProfile> {
  const studio = await platformDb.studio.findUnique({ where: { id: studioId }, select: profileSelect });
  if (!studio) throw new AccessError(404, "Nie znaleziono studia.");
  return studio;
}

export async function updateStudioProfile(studioId: string, actorId: string, input: unknown) {
  const parsed = studioProfileInput.safeParse(input);
  if (!parsed.success) throw new AccessError(400, "Nieprawidłowe dane studia.");
  const updated = await platformDb.studio.updateMany({ where: { id: studioId }, data: parsed.data });
  if (!updated.count) throw new AccessError(404, "Nie znaleziono studia.");
  await platformDb.auditLog.create({
    data: {
      studioId,
      actorId,
      action: "studio.profile.update",
      meta: { fields: ["name", "ownerLegalName", "nip", "address", "postal", "city", "phone"] },
    },
  });
  return readStudioProfile(studioId);
}
