import { toNextJsHandler } from "better-auth/next-js";
import { platformAuth } from "@/lib/auth/platform";

export const { GET, POST } = toNextJsHandler(platformAuth);
