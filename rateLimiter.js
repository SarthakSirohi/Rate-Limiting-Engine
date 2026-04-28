import { createClient } from "redis";
import { logQueue } from "./queue.js";

const redisClient = createClient();
await redisClient.connect();

const WINDOW_SIZE = 60;      // 1 minute
const MAX_REQUESTS = 20;    // per IP

// AUTO-BAN CONFIG
const MAX_VIOLATIONS = 10;
const VIOLATION_WINDOW = 60 * 60;      // 1 hour
const BAN_DURATION = 60 * 60 * 24;     // 24 hours
const ALERT_THRESHOLD = 20; // suspicious activity threshold

export async function rateLimiter(req, res, next) {
  try {
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

    await logQueue.add("blocked-ip", {
      ip,
      requests,
      timestamp: new Date().toISOString()
    });

    const violationKey = `violation:${ip}`;
    const violations = await redisClient.incr(violationKey);

    if (violations === 1) {
      await redisClient.expire(violationKey, VIOLATION_WINDOW);
    }

      //  SECURITY ALERT TRACKING
      const alertKey = `alerts:${ip}`;
      const alertCount = await redisClient.incr(alertKey);

      if (alertCount === 1) {
        await redisClient.expire(alertKey, 300); // 5 min window
      }

      // Trigger alert
      if (alertCount >= ALERT_THRESHOLD) {
        await logQueue.add("security-alert", {
          ip,
          alertCount,
          message: "Suspicious activity detected",
          timestamp,
        });
      }

    // Auto-ban IP
    if (violations >= MAX_VIOLATIONS) {
      await redisClient.set(`ban:${ip}`, "1", {
        EX: BAN_DURATION
      });

      logQueue.add("ip-banned", {
        ip,
        violations,
        bannedAt: new Date().toISOString()
      })

      return res.status(403).json({
        message: "IP banned for 24 hours"
      });
    }

    return res.status(429).json({
      message: "Too many requests"
    });
  }

  next();
  } catch (error) {
     //If redis is down or unreachable
     console.log("Redis unavailable, skipping rate limit", error.message);

     next()
  }
}