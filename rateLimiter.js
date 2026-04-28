import { redisClient } from "./redis.js";
import { logQueue } from "./queue.js";

const WINDOW = 60;
const MAX_REQUESTS = 20;

const ALERT_THRESHOLD = 20;
const MAX_VIOLATIONS = 10;

const BAN_DURATION = 60 * 60 * 24;
const VIOLATION_WINDOW = 60 * 60;

export async function rateLimiter(req, res, next) {
  try {
    const ip = req.ip;
    const timestamp = new Date().toISOString();

    // Check ban
    if (await redisClient.exists(`ban:${ip}`)) {
      return res.status(403).json({ message: "IP banned" });
    }

    // Rate limiting
    const rateKey = `rate:${ip}`;
    const requests = await redisClient.incr(rateKey);

    if (requests === 1) {
      await redisClient.expire(rateKey, WINDOW);
    }

    let event = {
      ip,
      timestamp,
      blocked: false,
      alert: false,
      banned: false,
      requests,
    };

    if (requests > MAX_REQUESTS) {
      event.blocked = true;

      // Violations tracking
      const violationKey = `violations:${ip}`;
      const violations = await redisClient.incr(violationKey);

      if (violations === 1) {
        await redisClient.expire(violationKey, VIOLATION_WINDOW);
      }

      // Alert tracking
      const alertKey = `alerts:${ip}`;
      const alertCount = await redisClient.incr(alertKey);

      if (alertCount === 1) {
        await redisClient.expire(alertKey, 300);
      }

      if (alertCount === ALERT_THRESHOLD) {
        event.alert = true;
      }

      // Ban logic
      if (violations === MAX_VIOLATIONS) {
        await redisClient.set(`ban:${ip}`, "1", {
          EX: BAN_DURATION,
        });
        event.banned = true;
      }

      // SINGLE unified event
      await logQueue.add("rate-limit-event", event, {
        jobId: `event:${ip}:${timestamp}`, // avoids duplicates per request
      });

      return res.status(429).json({
        message: "Too many requests",
      });
    }

    next();
  } catch (err) {
    console.error("Rate limiter error:", err);
    next();
  }
}