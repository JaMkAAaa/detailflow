import { PortfolioScreen } from "@/components/portfolio/PortfolioScreen";
import { platformDb } from "@/lib/db/client";
import { listPortfolio } from "@/src/server/portfolio/publish";
import { requireStudio } from "@/src/server/studio/context";
import { publishPortfolioPhoto, unpublishPortfolioPhoto } from "./actions";

export default async function PortfolioPage() {
  const { studioId, member, restriction } = await requireStudio();
  const studio = await platformDb.studio.findUniqueOrThrow({ where: { id: studioId }, select: { slug: true } });
  const list = await listPortfolio(studioId);
  const canManage = member.role !== "worker";
  return (
    <PortfolioScreen
      key={studioId}
      studioId={studioId}
      publicHref={`/realizacje/${studio.slug}`}
      photos={list.photos}
      truncated={list.truncated}
      canPublish={canManage && !restriction}
      canUnpublish={canManage}
      actions={{ publish: publishPortfolioPhoto, unpublish: unpublishPortfolioPhoto }}
    />
  );
}
