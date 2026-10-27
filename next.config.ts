import type { NextConfig } from "next";

// Walidacja env przy starcie i buildzie (SKIP_ENV_VALIDATION=1 w obrazie buildowym).
import "./lib/env";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // BullMQ loads optional Redis adapters at runtime; keep them out of webpack.
  serverExternalPackages: ["bullmq"],
  outputFileTracingIncludes: { "/api/studios/*/invoices/*/*": ["./app/fonts/Inter.ttf"] },
  // Next dev loguje domyślnie pełny URL, w tym sekret portalu.
  logging: { incomingRequests: false },
};

export default nextConfig;
