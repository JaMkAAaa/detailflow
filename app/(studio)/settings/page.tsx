import { KsefEnvForm } from "@/components/faktury/KsefEnvForm";
import { ksefStudioStatus } from "@/src/ksef/submissions";
import { readStudioProfile } from "@/src/server/studio/profile";
import { requireStudio } from "@/src/server/studio/context";
import { ProfileForm } from "./profile-form";
import { TokenForm } from "./token-form";

export default async function SettingsPage() {
  const { studioId } = await requireStudio("studio:settings");
  const [profile, status] = await Promise.all([readStudioProfile(studioId), ksefStudioStatus(studioId)]);
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-df-section">Ustawienia i KSeF</h1>
      <ProfileForm profile={profile} />
      <KsefEnvForm env={status.env} prodAllowed={status.prodAllowed} tokenSet={status.tokenSet} />
      <TokenForm studioId={studioId} tokenSet={status.tokenSet} />
    </div>
  );
}
