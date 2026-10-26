"use client";
import { useActionState } from "react";
import { sendInvite } from "./actions";

export function InviteForm() {
  const [state, action, pending] = useActionState(sendInvite, { message: "" });
  return <form action={action} className="flex max-w-md flex-col gap-4">
    <label>E-mail<input name="email" type="email" required maxLength={254} className="block w-full rounded bg-df-raised p-3" /></label>
    <label>Rola<select name="role" className="block w-full rounded bg-df-raised p-3"><option value="worker">Pracownik</option><option value="manager">Manager</option></select></label>
    <button disabled={pending} className="rounded bg-df-lime p-3 text-df-bg">{pending ? "Wysyłanie…" : "Wyślij zaproszenie"}</button>
    <p role="status">{state.message}</p>
  </form>;
}
