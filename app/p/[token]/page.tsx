import type { Metadata } from "next";
import { PortalExpired, PortalStatus } from "@/components/portal/PortalScreen";
import { resolvePortalDemo } from "@/components/portal/demo";

export const metadata: Metadata = {
  title: "Status zlecenia",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = resolvePortalDemo(token);
  if (state === "active") return <PortalStatus />;
  return <PortalExpired knownStudio={state === "expired"} />;
}
