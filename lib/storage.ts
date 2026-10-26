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

/** `null`, gdy obiektu nie ma. */
export async function headObject(key: string) {
  try {
    const head = await internalClient().send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return { sizeBytes: head.ContentLength ?? 0, contentType: head.ContentType ?? "" };
  } catch (error) {
    const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === "NotFound" || e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

export async function deleteObject(key: string) {
  await internalClient().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}
