/**
 * URL 爬取工具 Provider
 *
 * 从产品官网 URL 提取标题、描述与图片等信息，
 * 并通过 LLM 提炼核心卖点与推荐 prompt。
 */
import { generateImages } from "../registry.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

/** URL 爬取结果 */
export interface UrlScraperResult {
  title: string;
  description: string;
  images: string[];
  /** LLM 提炼的卖点列表 */
  sellingPoints: string[];
  /** 推荐生成 prompt */
  recommendedPrompts: string[];
}

/** 从 HTML 中提取 meta 信息 */
function extractMetaInfo(html: string, url: string): { title: string; description: string; images: string[] } {
  // 提取 title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
  const title = ogTitleMatch?.[1]?.trim() ?? titleMatch?.[1]?.trim() ?? "";

  // 提取 description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
  const description = ogDescMatch?.[1]?.trim() ?? descMatch?.[1]?.trim() ?? "";

  // 提取 og:image
  const images: string[] = [];
  const ogImageMatches = html.matchAll(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/gi);
  for (const m of ogImageMatches) {
    if (m[1]) images.push(m[1]);
  }

  // 补充 img 标签中的图片（最多 5 张）
  if (images.length < 5) {
    const imgMatches = html.matchAll(/<img[^>]*src=["']([^"']*)["']/gi);
    for (const m of imgMatches) {
      if (m[1] && !m[1].startsWith("data:") && images.length < 5) {
        // 转换相对路径为绝对路径
        try {
          const absUrl = new URL(m[1], url).href;
          images.push(absUrl);
        } catch {
          // 忽略无效 URL
        }
      }
    }
  }

  return { title, description, images };
}

/** 去除 HTML 标签，保留纯文本 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000); // 限制长度，避免 LLM token 过多
}

/** LLM 卖点提炼 */
async function extractSellingPoints(
  title: string,
  description: string,
  textContent: string,
): Promise<{ sellingPoints: string[]; recommendedPrompts: string[] }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    // 未配置 LLM 时返回基础卖点
    return {
      sellingPoints: [title, description].filter(Boolean).slice(0, 3),
      recommendedPrompts: [`${title}产品展示图`].filter(Boolean),
    };
  }

  const base = (
    process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const model = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";

  const systemPrompt =
    "你是一位资深产品营销文案专家。根据产品信息提炼3-5个核心卖点，并为每个卖点生成一条适合AI图片生成的英文prompt。" +
    "请严格按以下JSON格式输出，不要额外说明：\n" +
    '{"sellingPoints":["卖点1","卖点2","卖点3"],"recommendedPrompts":["prompt1","prompt2","prompt3"]}';

  const userContent = `产品名称：${title}\n产品描述：${description}\n页面内容：${textContent}`;

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 1000,
        temperature: 0.5,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.warn(`[url-scraper] LLM 卖点提炼失败 (${res.status})`);
      return {
        sellingPoints: [title, description].filter(Boolean).slice(0, 3),
        recommendedPrompts: [`${title}产品展示图`].filter(Boolean),
      };
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return {
        sellingPoints: [title, description].filter(Boolean).slice(0, 3),
        recommendedPrompts: [`${title}产品展示图`].filter(Boolean),
      };
    }

    // 尝试解析 JSON，兼容 markdown 代码块包裹
    const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const parsed = JSON.parse(jsonStr) as {
      sellingPoints?: string[];
      recommendedPrompts?: string[];
    };

    return {
      sellingPoints: parsed.sellingPoints?.slice(0, 5) ?? [title],
      recommendedPrompts: parsed.recommendedPrompts?.slice(0, 5) ?? [`${title}产品展示图`],
    };
  } catch (err) {
    console.warn("[url-scraper] LLM 卖点提炼异常:", err instanceof Error ? err.message : err);
    return {
      sellingPoints: [title, description].filter(Boolean).slice(0, 3),
      recommendedPrompts: [`${title}产品展示图`].filter(Boolean),
    };
  }
}

/** URL 爬取 + LLM 卖点提炼（供外部 Skill 调用） */
export async function scrapeUrl(url: string): Promise<UrlScraperResult> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AIMarketBot/1.0)",
    },
  });

  if (!res.ok) {
    throw new Error(`URL 爬取失败 (${res.status}): ${url}`);
  }

  const html = await res.text();
  const { title, description, images } = extractMetaInfo(html, url);
  const textContent = stripHtml(html);

  // LLM 提炼卖点
  const { sellingPoints, recommendedPrompts } = await extractSellingPoints(
    title,
    description,
    textContent,
  );

  return { title, description, images, sellingPoints, recommendedPrompts };
}

/** URL 爬取 Provider */
export const urlScraperProvider: ImageToolProvider = {
  name: "tool-url-scraper",
  supports(toolId: string) {
    return toolId === "url-scraper";
  },
  async run(params: ToolRunParams): Promise<ToolRunResult> {
    // prompt 中传入 URL
    const url = params.prompt.trim();
    const result = await scrapeUrl(url);

    // 基于推荐 prompt 生成展示图
    if (result.recommendedPrompts.length > 0) {
      const genResults = await Promise.all(
        result.recommendedPrompts.slice(0, 4).map((prompt) =>
          generateImages({
            prompt,
            modelId: params.modelId,
            count: 1,
            resolution: params.resolution,
            aspectRatio: params.aspectRatio,
            referenceUrls: params.referenceUrls.length > 0 ? [params.referenceUrls[0]!] : undefined,
            userId: params.userId,
          }),
        ),
      );
      const urls = genResults.flatMap((r) => r.urls);
      return {
        urls,
        provider: "tool-url-scraper",
      };
    }

    // 无推荐 prompt 时返回空结果
    return {
      urls: [],
      provider: "tool-url-scraper",
    };
  },
};
