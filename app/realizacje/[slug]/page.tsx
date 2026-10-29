import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicPortfolio } from "@/components/portfolio/PublicPortfolio";
import { loadPublicPortfolio } from "@/src/server/portfolio/public";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await loadPublicPortfolio((await params).slug);
  if (!data) return { title: "Portfolio", robots: { index: false, follow: false } };
  return {
    title: `${data.studio.name} — realizacje`,
    description: `Wybrane realizacje studia ${data.studio.name}.`,
  };
}

export default async function PublicPortfolioPage({ params }: Params) {
  const data = await loadPublicPortfolio((await params).slug);
  if (!data) notFound();
  return <PublicPortfolio studio={data.studio} items={data.items} />;
}
