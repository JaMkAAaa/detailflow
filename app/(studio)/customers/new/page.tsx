import Link from "next/link";
import { requireStudio } from "@/src/server/studio/context";
import { ClientForm, ImportForm } from "../forms";

export default async function NewCustomerPage() {
  const { studioId } = await requireStudio();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/customers" className="text-df-body text-df-muted hover:text-df-text">← Klienci</Link>
        <h1 className="mt-2 text-df-section text-df-text">Nowy klient</h1>
      </div>
      <ClientForm studioId={studioId} />
      <section className="flex max-w-xl flex-col gap-3 border-t border-df-line pt-6">
        <h2 className="text-df-strong text-df-text">Import CSV</h2>
        <p className="text-df-body text-df-muted">Kolumny: imię, telefon, e-mail, marka, model, tablica. Excel z średnikiem też przejdzie.</p>
        <ImportForm studioId={studioId} />
      </section>
    </div>
  );
}
