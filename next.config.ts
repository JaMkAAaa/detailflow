import type { NextConfig } from "next";

// Walidacja env przy starcie i buildzie (SKIP_ENV_VALIDATION=1 w obrazie buildowym).
import "./lib/env";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  outputFileTracingIncludes: { "/api/studios/*/invoices/*/*": ["./app/fonts/Inter.ttf"] },
  // Next dev loguje domyślnie pełny URL, w tym sekret portalu.
  logging: { incomingRequests: false },
};

export default nextConfig;
