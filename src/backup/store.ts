import { DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { BackupStore } from "./run";

export function s3BackupStore(config: {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}): BackupStore {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
  });
  return {
    async put(key, body) {
      await client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: "application/octet-stream",
      }));
    },
    async list(prefix) {
      const objects: { key: string; lastModified: Date }[] = [];
      let token: string | undefined;
      do {
        const page = await client.send(new ListObjectsV2Command({ Bucket: config.bucket, Prefix: prefix, ContinuationToken: token }));
        for (const item of page.Contents ?? []) {
          if (item.Key && item.LastModified) objects.push({ key: item.Key, lastModified: item.LastModified });
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return objects;
    },
    async delete(keys) {
      for (const key of keys) await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}
