import { assetUrl } from "@/lib/api-client";

/** 从视频 URL 截取最后一帧（客户端 canvas，用于首尾帧续作） */
export async function extractVideoLastFrame(videoUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("无法加载视频以提取尾帧"));
    };

    video.onloadedmetadata = () => {
      const t = Number.isFinite(video.duration)
        ? Math.max(0, video.duration - 0.12)
        : 0;
      video.currentTime = t;
    };

    video.onseeked = () => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) {
          cleanup();
          reject(new Error("视频尺寸无效"));
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          reject(new Error("无法创建画布"));
          return;
        }
        ctx.drawImage(video, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (blob) resolve(blob);
            else reject(new Error("尾帧导出失败"));
          },
          "image/jpeg",
          0.92,
        );
      } catch (e) {
        cleanup();
        reject(e instanceof Error ? e : new Error("尾帧提取失败"));
      }
    };

    video.src = assetUrl(videoUrl);
  });
}
