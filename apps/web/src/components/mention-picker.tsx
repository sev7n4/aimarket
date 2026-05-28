"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { assetUrl } from "@/lib/api-client";
import type { CanvasItem } from "@/lib/canvas-tools";
import type { SessionReference } from "@/lib/types";

/**
 * 工作台 prompt 输入框的 @ 上下文引用候选项。
 * 仿 Cursor 的 @ 体验，可同时引用：
 *  - 画布上的图片（上传素材 / 生成产物）
 *  - 工作台当前上传但尚未进画布的图片
 *  - session 历史生成图
 */
export type MentionItem =
  | {
      key: string;
      source: "canvas-asset";
      label: string;
      url: string;
      /** 画布 item 角色 chip：参考 / 商品 / 输出 */
      roleLabel?: string;
      /** 已入库的 assetId，提交时进 referenceAssets */
      assetId: string;
    }
  | {
      key: string;
      source: "upload-asset";
      label: string;
      url: string;
      roleLabel?: string;
      /** 工作台当前上传的 assets.id，提交时进 assetIds */
      assetId: string;
    }
  | {
      key: string;
      source: "canvas-output";
      label: string;
      url: string;
      roleLabel?: string;
      /** 生成产物 outputId，提交时进 referenceOutputIds */
      outputId: string;
    }
  | {
      key: string;
      source: "history-output";
      label: string;
      url: string;
      outputId: string;
    };

interface MentionPickerProps {
  open: boolean;
  /** dock 工作站输入在底部，列表向下展开避免被滚动容器裁切 */
  placement?: "above" | "below";
  /** 当前查询（@ 后的字符），用于客户端过滤 */
  query?: string;
  canvasItems?: CanvasItem[];
  uploadedAssets?: Array<{ id: string; url: string; label?: string }>;
  references?: SessionReference[];
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  reference: "参考",
  product: "商品",
  output: "成品",
};

export function buildCanvasMentionItems(items: CanvasItem[]): MentionItem[] {
  const out: MentionItem[] = [];
  items.forEach((item, idx) => {
    const mention = canvasItemToMentionItem(item, idx);
    if (mention) out.push(mention);
  });
  return out;
}

export function canvasItemToMentionItem(
  item: CanvasItem,
  index = 0,
): MentionItem | null {
  const baseLabel = item.label ?? `图${index + 1}`;
  const roleLabel = item.role ? ROLE_LABEL[item.role] : undefined;
  const outputId =
    item.outputId ?? (item.role === "output" ? item.id : undefined);
  if (outputId) {
    return {
      key: `canvas-output-${item.id}`,
      source: "canvas-output",
      label: baseLabel,
      url: item.url,
      roleLabel,
      outputId,
    };
  }
  if (item.assetId) {
    return {
      key: `canvas-asset-${item.id}`,
      source: "canvas-asset",
      label: baseLabel,
      url: item.url,
      roleLabel,
      assetId: item.assetId,
    };
  }
  return null;
}

export function buildHistoryMentionItems(
  refs: SessionReference[],
): MentionItem[] {
  return refs.map((r) => ({
    key: `history-${r.id}`,
    source: "history-output",
    label: r.label,
    url: r.url,
    outputId: r.id,
  }));
}

export function buildUploadMentionItems(
  uploads: Array<{ id: string; url: string; label?: string }>,
): MentionItem[] {
  return uploads.map((upload, idx) => ({
    key: `upload-${upload.id}`,
    source: "upload-asset",
    label: upload.label ?? `上传图${idx + 1}`,
    url: upload.url,
    roleLabel: "当前上传",
    assetId: upload.id,
  }));
}

const PICKER_SHELL_ABOVE =
  "absolute bottom-full left-0 z-50 mb-2 w-full max-w-md";
const PICKER_SHELL_BELOW =
  "absolute top-full left-0 z-50 mt-2 w-full max-w-md";

export function MentionPicker({
  open,
  placement = "above",
  query = "",
  canvasItems = [],
  uploadedAssets = [],
  references = [],
  onSelect,
  onClose,
}: MentionPickerProps) {
  const canvasGroup = useMemo(
    () => buildCanvasMentionItems(canvasItems),
    [canvasItems],
  );
  const historyGroup = useMemo(
    () => buildHistoryMentionItems(references),
    [references],
  );
  const uploadGroup = useMemo(
    () => buildUploadMentionItems(uploadedAssets),
    [uploadedAssets],
  );

  const q = query.trim().toLowerCase();
  const filteredCanvas = useMemo(
    () =>
      canvasGroup.filter(
        (item) => !q || item.label.toLowerCase().includes(q),
      ),
    [canvasGroup, q],
  );
  const filteredHistory = useMemo(
    () =>
      historyGroup.filter(
        (item) => !q || item.label.toLowerCase().includes(q),
      ),
    [historyGroup, q],
  );
  const filteredUploads = useMemo(
    () =>
      uploadGroup.filter(
        (item) => !q || item.label.toLowerCase().includes(q),
      ),
    [uploadGroup, q],
  );
  const flat = useMemo(
    () => [...filteredCanvas, ...filteredUploads, ...filteredHistory],
    [filteredCanvas, filteredUploads, filteredHistory],
  );

  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setActiveIdx(0);
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (flat.length === 0 ? 0 : (i + 1) % flat.length));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) =>
          flat.length === 0 ? 0 : (i - 1 + flat.length) % flat.length,
        );
        return;
      }
      if (e.key === "Enter") {
        if (flat[activeIdx]) {
          e.preventDefault();
          onSelect(flat[activeIdx]);
        }
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, flat, activeIdx, onSelect, onClose]);

  if (!open) return null;

  const shellClass =
    placement === "below" ? PICKER_SHELL_BELOW : PICKER_SHELL_ABOVE;
  const emptyShellClass =
    placement === "below"
      ? "absolute top-full left-0 z-50 mt-2 w-full max-w-sm"
      : "absolute bottom-full left-0 z-50 mb-2 w-full max-w-sm";

  if (flat.length === 0) {
    return (
      <div
        className={`${emptyShellClass} rounded-xl border border-white/10 bg-zinc-900 p-3 text-xs text-zinc-500 shadow-xl`}
      >
        没有可引用的图片
        <button
          type="button"
          onClick={onClose}
          className="ml-2 text-zinc-400 hover:text-zinc-200"
        >
          关闭
        </button>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className={`${shellClass} rounded-xl border border-white/10 bg-zinc-900/95 p-2 shadow-2xl backdrop-blur`}
    >
      <div className="mb-1 flex items-center justify-between px-2 text-[10px] uppercase tracking-wider text-zinc-500">
        <span>引用上下文（↑↓ 选择 · 回车确认）</span>
        <button
          type="button"
          onClick={onClose}
          className="hover:text-zinc-300"
          aria-label="关闭"
        >
          Esc
        </button>
      </div>
      {filteredCanvas.length > 0 ? (
        <MentionGroup
          title="画布"
          items={filteredCanvas}
          activeKey={flat[activeIdx]?.key}
          onSelect={onSelect}
        />
      ) : null}
      {filteredUploads.length > 0 ? (
        <MentionGroup
          title="当前上传"
          items={filteredUploads}
          activeKey={flat[activeIdx]?.key}
          onSelect={onSelect}
        />
      ) : null}
      {filteredHistory.length > 0 ? (
        <MentionGroup
          title="历史"
          items={filteredHistory}
          activeKey={flat[activeIdx]?.key}
          onSelect={onSelect}
        />
      ) : null}
    </div>
  );
}

function MentionGroup({
  title,
  items,
  activeKey,
  onSelect,
}: {
  title: string;
  items: MentionItem[];
  activeKey?: string;
  onSelect: (item: MentionItem) => void;
}) {
  return (
    <div className="mb-1 last:mb-0">
      <p className="px-2 pb-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
        {title}
      </p>
      <ul className="max-h-56 overflow-y-auto">
        {items.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                  isActive
                    ? "bg-purple-500/15 text-purple-100"
                    : "text-zinc-300 hover:bg-white/5"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    item.url.startsWith("http") || item.url.startsWith("blob:")
                      ? item.url
                      : assetUrl(item.url)
                  }
                  alt=""
                  className="size-8 shrink-0 rounded object-cover"
                />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {"roleLabel" in item && item.roleLabel ? (
                  <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-zinc-400">
                    {item.roleLabel}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
