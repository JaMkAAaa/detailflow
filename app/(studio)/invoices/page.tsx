import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { requireStudio } from "@/src/server/studio/context";

export default async function InvoicesPage() {
  await requireStudio("invoices:manage");
  return <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-df-headline">Faktury</h1><Link href="/invoices/new" className={buttonVariants()}>Wystaw fakturę</Link></div>;
}
