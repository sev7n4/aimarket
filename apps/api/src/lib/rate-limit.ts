import { AppError } from "./errors.js";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
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
