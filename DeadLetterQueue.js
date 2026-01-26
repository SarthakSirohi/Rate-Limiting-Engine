import { Queue } from "bullmq";
import { connection } from "./redis.js";

export const deadLetterQueue = new Queue("rate-limit-dlq", {
  connection
});