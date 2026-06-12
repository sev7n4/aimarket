"use client";

import { assetUrl } from "@/lib/api-client";
import { isVideoCoverUrl } from "@/lib/inspiration-studio";
import Image from "next/image";

interface InspirationCoverMediaProps {
  coverUrl: string;
  title: string;
  mediaType?: "image" | "video";
  fill?: boolean;
  className?: string;
  sizes?: string;
  objectFit?: "cover" | "contain";
}

/** 灵感封面：图片用 Next Image，视频用 muted 预览/播放 */
export function InspirationCoverMedia({
  coverUrl,
  title,
  mediaType,
  fill = true,
  className = "object-cover",
  sizes,
  objectFit = "cover",
}: InspirationCoverMediaProps) {
  const isVideo = mediaType === "video" || isVideoCoverUrl(coverUrl);
  const src = coverUrl.startsWith("http") ? coverUrl : assetUrl(coverUrl);

  if (isVideo) {
    return (
      <video
        src={src}
        className={`${fill ? "absolute inset-0 h-full w-full" : "h-full w-full"} ${className}`}
        style={{ objectFit }}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={title}
      />
    );
  }

  if (fill) {
    return (
      <Image
        src={coverUrl}
        alt={title}
        fill
        sizes={sizes}
        className={className}
        unoptimized
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={coverUrl} alt={title} className={`h-full w-full ${className}`} />
  );
}
