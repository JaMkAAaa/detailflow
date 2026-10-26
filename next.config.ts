import type { NextConfig } from "next";

// Walidacja env przy starcie i buildzie (SKIP_ENV_VALIDATION=1 w obrazie buildowym).
import "./lib/env";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
