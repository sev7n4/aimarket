import Redis from "ioredis";
import { AppError } from "./errors.js";

const buckets = new Map<string, { count: number; resetAt: number }>();

let redisClient: Redis | null = null;
let redisUnavailable = false;

function useRedisStore(): boolean {
  if (redisUnavailable || !process.env.REDIS_URL) return false;
  const store = process.env.RATE_LIMIT_STORE ?? "auto";
  if (store === "memory") return false;
  if (store === "redis") return true;
  return (process.env.JOB_QUEUE ?? "memory") === "redis";
}

function getRedis(): Redis | null {
  if (!useRedisStore()) return null;
  if (redisClient) return redisClient;
  try {
    redisClient = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    redisClient.on("error", () => {
      redisUnavailable = true;
    });
    return redisClient;
  } catch {
    redisUnavailable = true;
    return null;
  }
}

function rateLimitMemory(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    throw new AppError(429, "RATE_LIMITED", "操作过于频繁，请稍后再试");
  }
}

async function rateLimitRedis(key: string, limit: number, windowMs: number) {
  const redis = getRedis();
  if (!redis) {
    rateLimitMemory(key, limit, windowMs);
    return;
  }

  try {
    const redisKey = `aimarket:rl:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.pexpire(redisKey, windowMs);
    }
    if (count > limit) {
      throw new AppError(429, "RATE_LIMITED", "操作过于频繁，请稍后再试");
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    redisUnavailable = true;
    rateLimitMemory(key, limit, windowMs);
  }
}

/** Phase 6C：内存限流；生产可配 REDIS_URL + RATE_LIMIT_STORE=redis */
export async function rateLimit(key: string, limit: number, windowMs: number) {
  if (useRedisStore()) {
    await rateLimitRedis(key, limit, windowMs);
    return;
  }
  rateLimitMemory(key, limit, windowMs);
}

export function getRateLimitStatus() {
  return {
    store: useRedisStore() ? "redis" : "memory",
    redisUrlConfigured: Boolean(process.env.REDIS_URL),
  };
}
