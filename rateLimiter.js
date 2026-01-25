import { createClient } from "redis";

const redisClient = createClient();
await redisClient.connect();

const WINDOW_SIZE = 60;      // 1 minute
const MAX_REQUESTS = 20;    // per IP

// AUTO-BAN CONFIG
const MAX_VIOLATIONS = 10;
const VIOLATION_WINDOW = 60 * 60;      // 1 hour
const BAN_DURATION = 60 * 60 * 24;     // 24 hours

export async function rateLimiter(req, res, next) {
  const ip = req.ip;

  // Check if IP is banned
  if (await redisClient.exists(`ban:${ip}`)) {
    return res.status(403).json({
      message: "IP banned due to excessive abuse"
    });
  }

  const rateKey = `rate:${ip}`;
  const requests = await redisClient.incr(rateKey);

  // Start rate limit window
  if (requests === 1) {
    await redisClient.expire(rateKey, WINDOW_SIZE);
  }

  // Rate limit exceeded
  if (requests > MAX_REQUESTS) {
    const violationKey = `violation:${ip}`;
    const violations = await redisClient.incr(violationKey);

    if (violations === 1) {
      await redisClient.expire(violationKey, VIOLATION_WINDOW);
    }

    // Auto-ban IP
    if (violations >= MAX_VIOLATIONS) {
      await redisClient.set(`ban:${ip}`, "1", {
        EX: BAN_DURATION
      });

      return res.status(403).json({
        message: "IP banned for 24 hours"
      });
    }

    return res.status(429).json({
      message: "Too many requests"
    });
  }

  next();
}