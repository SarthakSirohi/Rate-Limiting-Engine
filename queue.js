import { Queue } from "bullmq";
import { connection } from "./redis.js";

export const logQueue = new Queue("rate-limit-logs", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: true,
  },
});