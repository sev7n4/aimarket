import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { AppError } from "./errors.js";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "aimarket-dev-secret-change-me",
);

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.sub || typeof payload.sub !== "string") {
      throw new AppError(401, "UNAUTHORIZED", "无效的登录凭证");
    }
    return payload.sub;
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "登录已过期，请重新登录");
  }
}
