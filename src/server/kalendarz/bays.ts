import { z } from "zod";
import { platformDb } from "../../../lib/db/client";
import { Prisma, type Plan } from "../../../lib/db/generated/client";
import { studioDb } from "../../../lib/db/tenant";
import { plans } from "../../../lib/landing/plans";
import { AccessError } from "../acl";

export const bayInput = z.object({ name: z.string().trim().min(1).max(100) }).strict();

export async function createBay(studioId: string, input: unknown) {
  const { name } = bayInput.parse(input);
  const db = studioDb(studioId);
  for (let attempt = 0; ; attempt++) {
    try {
      // Keep the platform plan stable until the scoped Bay transaction commits.
      // Shared row locks allow concurrent creates but block a concurrent downgrade.
      return await platformDb.$transaction(async (metadata) => {
        const [studio] = await metadata.$queryRaw<{ plan: Plan }[]>`
          SELECT "plan" FROM "Studio" WHERE "id" = ${studioId} FOR SHARE
        `;
        if (!studio) throw new AccessError(404, "Nie znaleziono studia.");
        const plan = plans.find((plan) => plan.id === studio.plan)!;
        return db.$transaction(async (tx) => {
          const count = await tx.bay.count();
          if (plan.maxBays !== null && count >= plan.maxBays) {
            throw new AccessError(409, `Plan ${plan.name} pozwala na ${plan.maxBays} boksów. Istniejące boksy zostają po obniżeniu planu. Nowy boks możesz dodać, gdy liczba spadnie poniżej limitu lub po zmianie planu.`);
          }
          const last = await tx.bay.findFirst({ orderBy: { sort: "desc" }, select: { sort: true } });
          return tx.bay.create({ data: { studioId, name, sort: (last?.sort ?? -1) + 1 } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      });
    } catch (error) {
      const adapterConflict = error instanceof Error && "cause" in error &&
        typeof error.cause === "object" && error.cause !== null &&
        "kind" in error.cause && error.cause.kind === "TransactionWriteConflict";
      if (adapterConflict || (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code))) {
        if (attempt < 3) continue;
        throw new AccessError(409, "Lista boksów zmieniła się podczas zapisu. Spróbuj ponownie.");
      }
      throw error;
    }
  }
}
