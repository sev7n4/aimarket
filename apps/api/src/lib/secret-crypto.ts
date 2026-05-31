import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

function encryptionKey(): Buffer {
  const secret =
    process.env.BYOK_ENCRYPTION_KEY?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    "aimarket-dev-insecure";
  return scryptSync(secret, "aimarket-byok-v1", 32);
}

/** AES-256-GCM，存储格式 iv.tag.ciphertext（base64） */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(".");
  if (parts.length !== 3) throw new Error("invalid encrypted secret");
  const [ivB, tagB, dataB] = parts;
  const iv = Buffer.from(ivB, "base64");
  const tag = Buffer.from(tagB, "base64");
  const data = Buffer.from(dataB, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}
