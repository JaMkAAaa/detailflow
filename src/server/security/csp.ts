/** CSP dla HTML. Next wstrzykuje skrypty startowe, więc script-src dopuszcza inline.
 *  `frame-ancestors 'none'` zamyka osadzanie. Obrazy S3 są na https albo na lokalnym MinIO.
 */
export function contentSecurityPolicy(nodeEnv = process.env.NODE_ENV) {
  const script = nodeEnv === "production" ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    script,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http://localhost:9000 http://127.0.0.1:9000",
    "font-src 'self'",
    "connect-src 'self' https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io",
    "worker-src 'self'",
    "manifest-src 'self'",
  ].join("; ");
}
