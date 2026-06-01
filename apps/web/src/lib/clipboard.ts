/** 复制文本到剪贴板（Clipboard API + execCommand 回退，兼容非 HTTPS / 部分 WebView） */
export async function copyTextToClipboard(text: string): Promise<void> {
  const value = text.trim();
  if (!value) {
    throw new Error("无内容可复制");
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      /* 回退到 execCommand */
    }
  }

  if (typeof document === "undefined") {
    throw new Error("当前环境不支持复制");
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const ok = document.execCommand("copy");
    if (!ok) {
      throw new Error("复制失败，请手动选择复制");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}
