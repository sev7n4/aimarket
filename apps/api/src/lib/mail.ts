type SendVerificationParams = {
  to: string;
  verifyUrl: string;
};

export async function sendVerificationEmail(params: SendVerificationParams) {
  const from = process.env.MAIL_FROM ?? "AIMarket <noreply@aimarket.local>";
  const subject = "验证邮箱以领取注册积分";
  const text = [
    "你好，",
    "",
    "请点击以下链接验证邮箱（24 小时内有效，仅可使用一次）：",
    params.verifyUrl,
    "",
    "验证成功后，注册赠送积分将到账。如非本人操作请忽略此邮件。",
  ].join("\n");

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.info(
      `[mail] verification email to=${params.to} from=${from}\n${text}`,
    );
    return { provider: "log" as const };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend failed (${res.status}): ${body}`);
  }

  return { provider: "resend" as const };
}
