// Synthetic fixtures only; invoked by the isolated CI recovery smoke.
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import cryptoHelpers from "../../dist/ops-crypto.js";

const { decodeAes256Key, encryptWithKey, decryptWithKey } = cryptoHelpers;
assert.equal(process.env.SWI_RECOVERY_SMOKE, "1", "Explicit disposable recovery opt-in required");
const mode = process.argv[2];
assert.ok(["seed", "verify", "empty"].includes(mode), "Choose seed, verify or empty");
const prisma = new PrismaClient();
const s3 = new S3Client({ region: process.env.S3_REGION, endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } });
const email = "recovery-fixture@example.test", slug = "deployment-recovery-fixture";
const plaintext = "synthetic-recovery-secret", content = "private inventory recovery bytes";
const object = { Bucket: process.env.S3_BUCKET, Key: "spaces/deployment-recovery/fixture.txt" };
try {
  const key = decodeAes256Key(process.env.MFA_ENCRYPTION_KEY, "MFA_ENCRYPTION_KEY");
  if (mode === "empty") {
    assert.equal(await prisma.user.count({ where: { email } }), 0, "Recovery target must have no fixture account");
    assert.equal(await prisma.space.count({ where: { slug } }), 0, "Recovery target must have no fixture space");
    await assert.rejects(s3.send(new GetObjectCommand(object)), (error) => error?.$metadata?.httpStatusCode === 404,
      "Recovery target must have no private fixture object");
  } else if (mode === "seed") {
    const user = await prisma.user.create({ data: { email, name: "Recovery fixture", mfaSecretEncrypted: encryptWithKey(key, plaintext) } });
    await prisma.space.create({ data: { slug, name: "Recovery fixture", memberships: { create: { userId: user.id, role: "MANAGER" } },
      items: { create: { name: "Recovery catalogue fixture", sku: "RECOVERY-FIXTURE", qrCode: "SW-I-RECOVERY-FIXTURE" } } } });
    await s3.send(new PutObjectCommand({ ...object, Body: content }));
  } else {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    assert.equal(decryptWithKey(key, user.mfaSecretEncrypted), plaintext, "Restored keys must decrypt restored ciphertext");
    const space = await prisma.space.findUniqueOrThrow({ where: { slug }, include: { items: true, memberships: true } });
    assert.equal(space.items[0]?.sku, "RECOVERY-FIXTURE");
    assert.equal(space.memberships[0]?.userId, user.id);
    assert.equal(space.memberships[0]?.role, "MANAGER");
    const result = await s3.send(new GetObjectCommand(object));
    assert.equal(await result.Body.transformToString(), content);
    const anonymous = await fetch(`${process.env.S3_ENDPOINT}/${object.Bucket}/${object.Key}`);
    await anonymous.body?.cancel();
    assert.equal(anonymous.status, 403, "Restored files remain private");
  }
  console.log(`Disposable Inventory recovery fixture ${mode} passed (catalogue, membership, ciphertext, keys and private object).`);
} catch {
  console.error("Disposable Inventory recovery verification failed; credentials and fixture content were suppressed.");
  process.exitCode = 1;
} finally {
  s3.destroy();
  await prisma.$disconnect();
}
