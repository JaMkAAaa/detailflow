import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudioCard } from "@/components/admin/StudioCard";
import { requirePlatform } from "@/src/server/admin/context";
import { getStudioCard } from "@/src/server/admin/directory";

export async function generateMetadata({ params }: { params: Promise<{ publicCode: string }> }): Promise<Metadata> {
  const { publicCode } = await params;
  return { title: `${decodeURIComponent(publicCode)} — Detailflow` };
}

export default async function StudioCardPage({ params }: { params: Promise<{ publicCode: string }> }) {
  const { user: operator } = await requirePlatform();
  const { publicCode } = await params;
  const card = await getStudioCard(decodeURIComponent(publicCode), operator.id);
  if (!card) notFound();
  return <StudioCard card={card} />;
}
