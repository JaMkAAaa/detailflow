import { QuoteWizard } from "@/components/wyceny/QuoteWizard";
import { requireStudio } from "@/src/server/studio/context";

export default async function NewQuotePage() {
  const { studioId, user } = await requireStudio();
  return <QuoteWizard key={`${studioId}:${user.id}`} studioId={studioId} userId={user.id} />;
}
