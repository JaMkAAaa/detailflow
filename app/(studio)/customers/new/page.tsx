import Link from "next/link";
import { requireStudio } from "@/src/server/studio/context";
import { ClientForm } from "../forms";

export default async function NewCustomerPage() {
  const { studioId } = await requireStudio();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/customers" className="text-df-body text-df-muted hover:text-df-text">← Klienci</Link>
        <h1 className="mt-2 text-df-section text-df-text">Nowy klient</h1>
      </div>
      <ClientForm studioId={studioId} />
    </div>
  );
}
