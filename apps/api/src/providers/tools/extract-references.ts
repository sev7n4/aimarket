/** 从 tools/run 写入 job 的 prompt 中解析引用图 URL */
export function extractReferenceUrlsFromPrompt(prompt: string): string[] {
  const urls: string[] = [];
  const re = /\[引用图\d+:\s*([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(prompt)) !== null) {
    const url = match[1]?.trim();
    if (url) urls.push(url);
  }
  return urls;
}
