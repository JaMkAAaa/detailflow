import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Przeglądarka woła /api/auth/* (ten sam origin), więc działa rate limit Better Auth.
export const authClient = createAuthClient({ plugins: [magicLinkClient()] });
