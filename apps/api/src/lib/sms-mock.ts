const codes = new Map<string, { code: string; expires: number }>();

const TTL_MS = 10 * 60 * 1000;

export function issueSmsCode(phone: string): string {
  const code =
    process.env.SMS_MOCK_CODE ??
    String(Math.floor(100000 + Math.random() * 900000));
  codes.set(phone, { code, expires: Date.now() + TTL_MS });
  return code;
}

export function verifySmsCode(phone: string, code: string): boolean {
  const row = codes.get(phone);
  if (!row || row.expires < Date.now()) return false;
  if (row.code !== code.trim()) return false;
  codes.delete(phone);
  return true;
}
