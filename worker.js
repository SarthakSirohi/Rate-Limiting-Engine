import { Worker } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis({
    maxRetriesPerRequest: null
});

new Worker(
  "rate-limit-logs",
  async job => {
    console.log("🚫 Blocked IP Logged:", job.data);
  },
  { connection }
);