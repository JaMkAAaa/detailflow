import { redirect } from "next/navigation";

export default async function ZleceniaOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ number }, { tab }] = await Promise.all([params, searchParams]);
  redirect(`/orders/${number}${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`);
}
