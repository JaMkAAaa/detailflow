import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudioCard } from "@/components/admin/StudioCard";
import { requirePlatform } from "@/src/server/admin/context";
import { getStudioCard } from "@/src/server/admin/directory";
import { activeSupportSession } from "@/src/server/admin/studio-access";

export async function generateMetadata({ params }: { params: Promise<{ publicCode: string }> }): Promise<Metadata> {
  const { publicCode } = await params;
  return { title: `${decodeURIComponent(publicCode)} — Detailflow` };
}

export default async function StudioCardPage({ params }: { params: Promise<{ publicCode: string }> }) {
  const { user: operator } = await requirePlatform();
  const { publicCode } = await params;
  const code = decodeURIComponent(publicCode);
  const card = await getStudioCard(code, operator.id);
  if (!card) notFound();
  const support = await activeSupportSession(operator.id, code);
  return (
    <StudioCard
      card={card}
      supportSession={support ? { expiresAt: support.expiresAt.toISOString(), reason: support.reason, ticketCode: support.ticketCode } : null}
    />
  );
}
