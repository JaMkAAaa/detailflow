import { QuoteWizard } from "@/components/wyceny/QuoteWizard";
import { requireStudio } from "@/src/server/studio/context";
import { loadQuoteWizard } from "@/src/server/wyceny/query";

export default async function NewQuotePage() {
  const { studioId, user } = await requireStudio("quotes:write");
  const data = await loadQuoteWizard(studioId, user.id);
  return <QuoteWizard key={`${studioId}:${user.id}`} studioId={studioId} userId={user.id} clientChoices={data.clients} serviceChoices={data.services} heldServices={data.heldServices} initialQuote={data.quote} />;
}
