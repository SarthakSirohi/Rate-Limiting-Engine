import { Worker } from "bullmq";
import { connection } from "./redis.js";
import { deadLetterQueue } from "./DeadLetterQueue.js";

const worker = new Worker(
  "rate-limit-logs",
  async job => {
    console.log("Blocked IP Logged:", job.data);
  },
  { connection , concurrency: 5}
);

// DLQ integration
worker.on("failed", async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    try {
      await deadLetterQueue.add("blocked-ip-failed", {
        originalJobId: job.id,
        payload: job.data,
        reason: err.message,
        failedAt: new Date().toISOString()
      });
    } catch (dlqErr) {
      console.error("DLQ write failed:", dlqErr.message);
    }
  }
});