import { platformDb } from "../../lib/db/client";

/** Brak wiersza albo `enabled=false` zamyka PROD. Flaga nie zmienia `ksefEnv` studiów. */
export async function ksefProdEnabled() {
  const flag = await platformDb.featureFlag.findUnique({ where: { key: "ksef_prod" }, select: { enabled: true } });
  return flag?.enabled === true;
}
