import { requireStudio } from "@/src/server/studio/context";
import { InviteForm } from "./form";

export default async function TeamPage() {
  await requireStudio("members:invite");
  return <div className="flex flex-col gap-6"><h1 className="text-df-section">Zaproś do studia</h1><InviteForm /></div>;
}
