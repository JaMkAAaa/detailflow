import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { contentSecurityPolicy } from "./src/server/security/csp";

// Walidacja env przy starcie i buildzie (SKIP_ENV_VALIDATION=1 w obrazie buildowym).
import "./lib/env";

const pdfkitStandardFonts = "./node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/standard-fonts/**/*";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // BullMQ ładuje opcjonalne adaptery w runtime. pino zostaje w node_modules, bo bundler gubi wątek sonic-boom.
  serverExternalPackages: ["bullmq", "pino", "pdfkit"],
  outputFileTracingIncludes: {
    "/*": [pdfkitStandardFonts],
    "/api/studios/*/invoices/*/*": ["./app/fonts/Inter.ttf", pdfkitStandardFonts],
  },
  // Next dev loguje domyślnie pełny URL, w tym sekret portalu.
  logging: { incomingRequests: false },
  async headers() {
    const headers = [
      { key: "Content-Security-Policy", value: contentSecurityPolicy() },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    if (process.env.NODE_ENV === "production") {
      headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
    }
    return [{ source: "/:path*", headers }];
  },
};

const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);

export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  sourcemaps: { disable: uploadSourceMaps ? false : true },
  suppressOnRouterTransitionStartWarning: true,
  errorHandler() {
    return undefined;
  },
  webpack: {
    treeshake: { removeDebugLogging: true, removeTracing: true },
  },
});
