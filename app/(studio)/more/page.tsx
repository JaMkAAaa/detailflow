import { MoreScreen } from "@/components/studio/MoreScreen";
import { invoiceAttentionCount } from "@/src/server/faktury/list-query";
import { requireStudio } from "@/src/server/studio/context";

export default async function MorePage() {
  const { studioId, choices, user } = await requireStudio();
  const current = choices.find((choice) => choice.studioId === studioId)!;
  const count =
    current.role === "worker"
      ? 0
      : await invoiceAttentionCount(studioId, current.studio.ksefEnv);
  return (
    <MoreScreen
      choices={choices}
      studioId={studioId}
      studio={current.studio.name}
      name={user.name}
      location={[current.studio.city, current.studio.district]
        .filter(Boolean)
        .join(", ")}
      role={current.role}
      attentionCount={count}
    />
  );
}
