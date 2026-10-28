import { Badge } from "@/components/ui/badge";

export function KsefEnvBadge({ env }: { env: "test" | "production" }) {
  const label = env === "production" ? "KSeF PROD" : "KSeF TEST";
  return <Badge variant={env === "production" ? "prod" : "test"} aria-label={label}>{label}</Badge>;
}
