import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const platformAuthClient = createAuthClient({
  basePath: "/api/auth/platform",
  plugins: [magicLinkClient()],
});
