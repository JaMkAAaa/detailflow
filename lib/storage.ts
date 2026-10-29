import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";

// Bucket jest prywatny (docker-compose: `mc anonymous set none`). Dostęp do plików
// wyłącznie przez krótkotrwałe podpisane URL-e wydawane po sprawdzeniu studioId.

function createClient(endpoint: string) {
  return new S3Client({
    endpoint,
    region: env.S3_REGION ?? "us-east-1",
    forcePathStyle: true, // MinIO i R2 pod własnym hostem
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    // Nowe SDK domyślnie dopisuje sumę kontrolną do presigned PUT, czego przeglądarka nie wyśle.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

let internal: S3Client | undefined;
let signing: S3Client | undefined;
const internalClient = () => (internal ??= createClient(env.S3_ENDPOINT));
// Podpis obejmuje host, więc URL dla przeglądarki trzeba podpisać publicznym adresem.
const signingClient = () => (signing ??= createClient(env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT));

export function presignPut(input: { key: string; contentType: string; sizeBytes: number; expiresIn: number }) {
  return getSignedUrl(
    signingClient(),
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: input.key, ContentType: input.contentType, ContentLength: input.sizeBytes }),
    // Bez signableHeaders presigner pomija Content-Type, więc S3 przyjąłby dowolny typ.
    { expiresIn: input.expiresIn, signableHeaders: new Set(["content-type", "content-length"]) },
  );
}

export function presignGet(key: string, expiresIn: number) {
  return getSignedUrl(signingClient(), new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), { expiresIn });
}

function isMissingObject(error: unknown) {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === "NotFound" || e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404;
}

/** `null`, gdy obiektu nie ma. */
export async function headObject(key: string) {
  try {
    const head = await internalClient().send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return { sizeBytes: head.ContentLength ?? 0, contentType: head.ContentType ?? "" };
  } catch (error) {
    if (isMissingObject(error)) return null;
    throw error;
  }
}

/** Strumień obiektu dla route portalu. `null`, gdy obiektu nie ma. */
export async function openObject(key: string) {
  try {
    const result = await internalClient().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    if (!result.Body) return null;
    return {
      stream: result.Body.transformToWebStream(),
      contentType: result.ContentType ?? "application/octet-stream",
      contentLength: result.ContentLength,
    };
  } catch (error) {
    if (isMissingObject(error)) return null;
    throw error;
  }
}

export async function deleteObject(key: string) {
  await internalClient().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

/** Zapis po stronie serwera. Bez ACL — bucket zostaje prywatny, obiekt nie dostaje publicznego URL. */
export async function putObject(key: string, body: Buffer, contentType: string) {
  await internalClient().send(new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: "private, no-store",
  }));
}
