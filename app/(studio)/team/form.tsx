"use client";
import { useActionState } from "react";
import { Select } from "@/components/ui/select";
import { sendInvite } from "./actions";

export function InviteForm() {
  const [state, action, pending] = useActionState(sendInvite, { message: "" });
  return <form action={action} className="flex max-w-md flex-col gap-4">
    <label>E-mail<input name="email" type="email" required maxLength={254} className="block w-full rounded bg-df-raised p-3" /></label>
    <label>Rola<Select name="role" aria-label="Rola" options={[{ value: "worker", label: "Pracownik" }, { value: "manager", label: "Manager" }]} /></label>
    <button disabled={pending} className="rounded bg-df-lime p-3 text-df-bg">{pending ? "Wysyłanie…" : "Wyślij zaproszenie"}</button>
    <p role="status">{state.message}</p>
  </form>;
}
