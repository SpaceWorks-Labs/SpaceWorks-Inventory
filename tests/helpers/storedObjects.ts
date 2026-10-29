import { readdir } from "node:fs/promises";
import path from "node:path";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { deleteObjects, storageConfigured } from "@/lib/storage";

/** Inspect the configured test backend, including unreferenced failed uploads. */
export async function storedObjectKeys(spaceId: string, folder = "") {
  if (!/^[A-Za-z0-9_-]+$/.test(spaceId) || !/^[A-Za-z0-9_-]*$/.test(folder)) throw new Error("Invalid test storage scope.");
  const prefix = `spaces/${spaceId}/${folder ? `${folder}/` : ""}`;
  if (!storageConfigured()) {
    const directory = path.resolve(process.cwd(), ".data/storage", prefix);
    const entries = await readdir(directory, { recursive: true }).catch(() => [] as string[]);
    return entries.filter((name) => name.endsWith(".webp")).map((name) => prefix + name.split(path.sep).join("/"));
  }
  const client = new S3Client({ region: process.env.S3_REGION, endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "1",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! } });
  try {
    const keys: string[] = [];
    let continuation: string | undefined;
    do {
      const result = await client.send(new ListObjectsV2Command({ Bucket: process.env.S3_BUCKET!, Prefix: prefix, ContinuationToken: continuation }));
      keys.push(...(result.Contents ?? []).flatMap((object) => object.Key?.startsWith(prefix) ? [object.Key] : []));
      continuation = result.IsTruncated ? result.NextContinuationToken : undefined;
    } while (continuation);
    return keys;
  } finally { client.destroy(); }
}

export async function cleanupStoredObjects(spaceId: string) {
  await deleteObjects(await storedObjectKeys(spaceId));
}
