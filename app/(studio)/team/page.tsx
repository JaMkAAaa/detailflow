import { requireStudio } from "@/src/server/studio/context";
import { listTeam } from "@/src/server/studio/members";
import { InviteForm } from "./form";
import { MemberForm } from "./member-form";

const roles = { owner: "Właściciel", manager: "Manager", worker: "Pracownik" };
export default async function TeamPage() {
  const { user, studioId } = await requireStudio("members:invite");
  const { members, invitations } = await listTeam(user.id, studioId);
  return <div className="flex flex-col gap-6">
    <h1 className="text-df-section">Zespół studia</h1>
    <ul className="flex flex-col gap-4">{members.map((member) => <li key={member.id} className="rounded border border-df-border p-4">
      <p>{member.user.name} — {member.user.email}</p>
      <p>{roles[member.role]}</p>
      {member.role === "owner" ? <p>Właściciel jest chroniony przed usunięciem i zmianą roli.</p>
        : <MemberForm id={member.id} role={member.role} name={member.user.name} />}
    </li>)}</ul>
    <section className="flex flex-col gap-3"><h2 className="text-df-section">Oczekujące zaproszenia</h2>
      {invitations.length ? <ul>{invitations.map((invitation) => <li key={invitation.id}>
        {invitation.email} — {roles[invitation.role]} — ważne do {invitation.expiresAt.toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })}
      </li>)}</ul> : <p>Brak oczekujących zaproszeń.</p>}
    </section>
    <section className="flex flex-col gap-4"><h2 className="text-df-section">Zaproś do studia</h2><InviteForm /></section>
  </div>;
}
