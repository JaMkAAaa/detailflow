import { OperatorsScreen } from "@/components/admin/OperatorsScreen";
import { requirePlatform } from "@/src/server/admin/context";
import { mfaAccess } from "@/src/server/admin/mfa";
import { getAdministration } from "@/src/server/admin/operators";
import { beginMfaAction, challengeMfaAction, changeRoleAction, confirmMfaAction, setFlagAction } from "./actions";

export const metadata = { title: "Administracja — Detailflow" };

export default async function AdminOperatorsPage() {
  const actor = await requirePlatform();
  const access = await mfaAccess(actor.sessionId, actor.user.id);
  const administration = access.state === "ready" ? await getAdministration() : null;
  return (
    <OperatorsScreen
      actorRole={actor.role}
      access={access.state}
      administration={administration}
      beginAction={beginMfaAction}
      confirmAction={confirmMfaAction}
      challengeAction={challengeMfaAction}
      roleAction={changeRoleAction}
      flagAction={setFlagAction}
    />
  );
}
