import { invoiceNumberFromSegment } from "@/components/faktury/model";
import { notFound, redirect } from "next/navigation";
export default async function FakturaPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ env?: string }> }) {
  const [{ number }, { env }] = await Promise.all([params, searchParams]);
  const decodedNumber = invoiceNumberFromSegment(number);
  if (!decodedNumber) notFound();
  redirect(`/invoices/${encodeURIComponent(decodedNumber)}${env ? `?env=${encodeURIComponent(env)}` : ""}`);
}
