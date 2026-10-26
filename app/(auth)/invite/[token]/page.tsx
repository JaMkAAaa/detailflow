import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { acceptInvite } from "./actions";

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) return <p>Nieprawidłowe zaproszenie.</p>;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  const { error } = await searchParams;
  return <form action={acceptInvite.bind(null, token)} className="flex flex-col gap-4">
    <h1 className="text-df-section">Zaproszenie do studia</h1>
    <p>Zalogowano jako {session.user.email}.</p>
    {error && <p role="alert">{error === "403" ? "Zaloguj się adresem, na który wysłano zaproszenie." : "Zaproszenie wygasło lub zostało wykorzystane."}</p>}
    <button className="rounded bg-df-lime p-3 text-df-bg" type="submit">Przyjmij zaproszenie</button>
    <a href="/logout">Zmień konto</a>
  </form>;
}
