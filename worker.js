import { Worker } from "bullmq";
import { connection } from "./redis.js";
import { deadLetterQueue } from "./DeadLetterQueue.js";

const worker = new Worker(
  "rate-limit-logs",
  async (job) => {
    const { name, data } = job;

    if (name === "blocked-ip") {
      console.log("🚫 Blocked IP:", data);
    }

    if (name === "ip-banned") {
      console.log("🔴 IP BANNED:", data);
    }

    // 🚨 NEW: SECURITY ALERT
    if (name === "security-alert") {
      console.log("🚨 SECURITY ALERT:", data);
    }
  },
  { connection, concurrency: 5 }
);

// DLQ Integration
worker.on("failed", async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    try {
      await deadLetterQueue.add("failed-job", {
        originalJobId: job.id,
        payload: job.data,
        reason: err.message,
        failedAt: new Date().toISOString(),
      });
    } catch (dlqError) {
      console.error("DLQ write failed:", dlqError.message);
    }
  }
});