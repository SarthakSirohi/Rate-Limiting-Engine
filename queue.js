import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis({
    maxRetriesPerRequest: null
});

export const logQueue = new Queue("rate-limit-logs", {
  connection
});

