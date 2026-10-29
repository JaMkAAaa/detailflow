/** Hosty, na które przeglądarka wysyła presigned PUT. Bez tego connect-src 'self' blokuje S3. */
const STORAGE_CONNECT = "http://localhost:9000 http://127.0.0.1:9000 https://*.r2.cloudflarestorage.com";

function configuredStorageOrigin() {
  const origins = new Set<string>();
  for (const raw of [process.env.S3_PUBLIC_ENDPOINT, process.env.S3_ENDPOINT]) {
    if (!raw) continue;
    try {
      const url = new URL(raw);
      if (url.hostname === "minio" || (url.protocol !== "http:" && url.protocol !== "https:")) continue;
      origins.add(url.origin);
    } catch {
      // Niepoprawny endpoint nie wchodzi do CSP.
    }
  }
  return [...origins].join(" ");
}

/** CSP dla HTML. Next wstrzykuje skrypty startowe, więc script-src dopuszcza inline.
 *  `frame-ancestors 'none'` zamyka osadzanie. Obrazy S3 są na https albo na lokalnym MinIO.
 *  Presigned PUT idzie wprost do magazynu, więc connect-src zna tylko jego hosty.
 */
export function contentSecurityPolicy(nodeEnv = process.env.NODE_ENV) {
  const script = nodeEnv === "production" ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
  const connect = `connect-src 'self' https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io ${STORAGE_CONNECT} ${configuredStorageOrigin()}`;
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
    connect.replace(/\s+/g, " ").trim(),
    "worker-src 'self'",
    "manifest-src 'self'",
  ].join("; ");
}
