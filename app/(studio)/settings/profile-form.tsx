"use client";

import { useActionState } from "react";
import { updateStudioProfileAction } from "./actions";

type Profile = {
  name: string;
  ownerLegalName: string | null;
  nip: string | null;
  address: string | null;
  postal: string | null;
  city: string | null;
  phone: string | null;
};

const field = "block w-full rounded bg-df-raised p-3 text-df-body";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateStudioProfileAction, { error: "", saved: false });
  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl bg-df-panel p-4">
      <h2 className="text-df-strong">Dane studia</h2>
      <label className="flex flex-col gap-2 text-df-label">Nazwa<input name="name" required maxLength={120} defaultValue={profile.name} className={field} /></label>
      <label className="flex flex-col gap-2 text-df-label">Nazwa prawna<input name="ownerLegalName" required maxLength={200} defaultValue={profile.ownerLegalName ?? ""} className={field} /></label>
      <label className="flex flex-col gap-2 text-df-label">NIP<input name="nip" required inputMode="numeric" autoComplete="off" defaultValue={profile.nip ?? ""} className={field} /></label>
      <label className="flex flex-col gap-2 text-df-label">Adres<input name="address" required maxLength={200} defaultValue={profile.address ?? ""} className={field} /></label>
      <label className="flex flex-col gap-2 text-df-label">Kod pocztowy<input name="postal" required pattern="\d{2}-\d{3}" defaultValue={profile.postal ?? ""} className={field} /></label>
      <label className="flex flex-col gap-2 text-df-label">Miasto<input name="city" required maxLength={100} defaultValue={profile.city ?? ""} className={field} /></label>
      <label className="flex flex-col gap-2 text-df-label">Telefon<input name="phone" type="tel" required maxLength={32} defaultValue={profile.phone ?? ""} className={field} /></label>
      <button disabled={pending} className="min-h-10 rounded-lg bg-df-lime px-3 text-df-bg disabled:opacity-40">{pending ? "Zapisywanie…" : "Zapisz dane"}</button>
      {state.saved && <p role="status">Dane studia zostały zapisane.</p>}
      {state.error && <p role="alert" className="text-df-error">{state.error}</p>}
    </form>
  );
}
