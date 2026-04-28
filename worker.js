import { Worker } from "bullmq";
import { connection } from "./redis.js";
import { deadLetterQueue } from "./dlq.js";

const worker = new Worker(
  "rate-limit-logs",
  async (job) => {
    const { data } = job;

    if (data.blocked) {
      console.log("BLOCKED:", data.ip);
    }

    if (data.alert) {
      console.log("ALERT:", data.ip);
    }

    if (data.banned) {
      console.log("BANNED:", data.ip);
    }
  },
  { connection, concurrency: 5 }
);

// DLQ
worker.on("failed", async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    await deadLetterQueue.add("failed-job", {
      id: job.id,
      data: job.data,
      error: err.message,
      time: new Date().toISOString(),
    });
  }
});