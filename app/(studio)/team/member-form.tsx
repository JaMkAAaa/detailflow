"use client";
import { useActionState } from "react";
import { updateMember } from "./actions";

export function MemberForm({ id, role, name }: { id: string; role: "manager" | "worker"; name: string }) {
  const [state, action, pending] = useActionState(updateMember, { message: "" });
  return <form action={action} className="flex flex-wrap items-center gap-3">
    <input type="hidden" name="membershipId" value={id} />
    <select name="role" defaultValue={role} aria-label={`Rola: ${name}`} className="rounded bg-df-raised p-3" disabled={pending}>
      <option value="worker">Pracownik</option><option value="manager">Manager</option>
    </select>
    <button name="operation" value="role" disabled={pending} className="rounded bg-df-lime p-3 text-df-bg">Zapisz rolę</button>
    <button name="operation" value="remove" disabled={pending} className="rounded border p-3" onClick={(event) => {
      if (!window.confirm(`Usunąć dostęp do studia dla ${name}?`)) event.preventDefault();
    }}>Usuń dostęp</button>
    <p role="status" className="w-full">{state.message}</p>
  </form>;
}
