import { createClient } from "redis";
import { logQueue } from "./queue.js";

const redisClient = createClient();
await redisClient.connect();

const WINDOW_SIZE = 60; // seconds
const MAX_REQUESTS = 5;

export async function rateLimiter(req, res, next) {
  const ip = req.ip;
  const key = `rate:${ip}`;

  const requests = await redisClient.incr(key);

  if (requests === 1) {
    await redisClient.expire(key, WINDOW_SIZE);
  }

  if (requests > MAX_REQUESTS) {
    // push log job to queue
    await logQueue.add("blocked-ip", {
      ip,
      time: new Date().toISOString()
    });

    return res.status(429).json({
      message: "Too many requests. Try again later."
    });
  }

  next();
}