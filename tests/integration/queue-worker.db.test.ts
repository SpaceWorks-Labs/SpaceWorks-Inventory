import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const delivery = vi.hoisted(() => ({ send: vi.fn(async () => undefined) }));
vi.mock("@/lib/email/send", () => ({ sendRenderedEmail: delivery.send }));

import { prisma } from "@/lib/db";
import { enqueueEmail } from "@/lib/outbox";
import { closeQueues, createQueues, queueConnection, type Queues } from "@/lib/queue/client";
import { jobId } from "@/lib/queue/definitions";
import { createWorkers } from "@/lib/queue/worker";

const redisUrl = process.env.TEST_QUEUE_REDIS_URL;
const prefix = `swi-audit-${randomUUID()}`;
let queues: Queues;
let workers: ReturnType<typeof createWorkers>;
const outboxIds: string[] = [];

describe.skipIf(!redisUrl)("BullMQ transactional email delivery", () => {
  beforeAll(async () => {
    queues = createQueues(prefix, queueConnection(false, redisUrl));
    workers = createWorkers({ prefix, redisUrl });
    await workers.ready();
  });

  afterAll(async () => {
    await workers?.close();
    if (queues) {
      await Promise.all(Object.values(queues).map((queue) => queue.obliterate({ force: true })));
      await closeQueues(queues);
    }
    await prisma.outboxMessage.deleteMany({ where: { id: { in: outboxIds } } });
  });

  it("delivers committed SQL outbox messages in the real Redis worker without placing content in Redis", async () => {
    const message = await prisma.$transaction((tx) => enqueueEmail(tx, { to: "audit-recipient@example.test", subject: "Worker delivery", html: "<p>Private content</p>", text: "Private content" }));
    outboxIds.push(message.id);
    expect(delivery.send).not.toHaveBeenCalled();
    const id = jobId("outbox", message.id);
    await queues.outbox.add("deliver", { kind: "outbox", outboxId: message.id }, { jobId: id });
    await expect.poll(async () => (await prisma.outboxMessage.findUniqueOrThrow({ where: { id: message.id } })).status, { timeout: 10_000 }).toBe("SENT");
    expect(delivery.send).toHaveBeenCalledOnce();
    expect(delivery.send).toHaveBeenCalledWith("audit-recipient@example.test", expect.objectContaining({ text: "Private content" }), `<swi-${message.id}@outbox.invalid>`);
    expect((await queues.outbox.getJob(id))?.data).toEqual({ kind: "outbox", outboxId: message.id });
    // Repeated relays use the same stable id; completed email is not resent.
    await queues.outbox.add("deliver", { kind: "outbox", outboxId: message.id }, { jobId: id });
    expect(delivery.send).toHaveBeenCalledOnce();
  });
});
