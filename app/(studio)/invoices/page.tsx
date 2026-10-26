import { requireStudio } from "@/src/server/studio/context";

export default async function InvoicesPage() {
  await requireStudio("invoices:manage");
  return <h1 className="sr-only">Faktury</h1>;
}
