"use client";

import { HelpCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { canvasTheme } from "./canvas-theme";
import { infiniteZoomControlsBottom } from "./infinite-canvas-layout";

const GUIDE_SECTIONS = [
  {
    id: "nav",
    title: "一、画布导航",
    items: [
      "滚轮缩放画布",
      "按住空格 / 中键拖动画布",
      "F 或 Ctrl/Cmd+0：适应视图",
      "右下角控件可重置缩放与打开小地图",
    ],
  },
  {
    id: "nodes",
    title: "二、节点操作",
    items: [
      "单击选中；Shift/Ctrl/Cmd 点击追加选择",
      "Ctrl/Cmd + 拖动空白处框选",
      "拖拽移动节点；按住 Shift 约束轴向",
      "L：切换网格吸附",
    ],
  },
  {
    id: "edges",
    title: "三、连线",
    items: [
      "从节点右侧圆点拖出连线到目标节点",
      "右键连线可删除",
    ],
  },
  {
    id: "edit",
    title: "四、编辑",
    items: [
      "Ctrl/Cmd + C / V：复制 / 粘贴",
      "Ctrl/Cmd + A：全选",
      "Delete / Backspace：删除选中",
      "Ctrl/Cmd + Z / Shift+Z：撤销 / 重做",
    ],
  },
  {
    id: "run",
    title: "五、运行",
    items: ["点击节点上的运行按钮触发生成"],
  },
  {
    id: "create",
    title: "六、快捷创建",
    items: ["左侧调色板添加工具节点", "双击空白或右键空白创建节点"],
  },
  {
    id: "save",
    title: "七、保存",
    items: ["画布变更会自动保存到云端会话"],
  },
] as const;

type CanvasGuideCapsuleProps = {
  bottomInsetPx?: number;
  visible?: boolean;
};

export function CanvasGuideCapsule({
  bottomInsetPx = 0,
  visible = true,
}: CanvasGuideCapsuleProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const openGuide = useCallback(() => {
    setOpen(true);
    dialogRef.current?.showModal();
  }, []);

  const closeGuide = useCallback(() => {
    setOpen(false);
    dialogRef.current?.close();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      closeGuide();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [closeGuide]);

  if (!visible) return null;

  return (
    <div
      className="absolute left-4 z-50"
      style={{ bottom: infiniteZoomControlsBottom(bottomInsetPx) }}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        data-testid="canvas-guide-capsule"
        className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs shadow-lg backdrop-blur transition hover:opacity-90"
        style={{
          background: canvasTheme.toolbar.panel,
          borderColor: canvasTheme.toolbar.border,
          color: canvasTheme.toolbar.item,
          boxShadow: "0 12px 32px rgba(0,0,0,.28)",
        }}
        onClick={openGuide}
        aria-label="画布使用指南"
        title="画布使用指南"
      >
        <HelpCircle className="size-3.5" />
        <span>使用指南</span>
      </button>

      <dialog
        ref={dialogRef}
        data-testid="canvas-guide-dialog"
        className="max-h-[80vh] w-[min(440px,92vw)] overflow-hidden rounded-xl border p-0 shadow-2xl backdrop:bg-black/50"
        style={{
          background: canvasTheme.toolbar.panel,
          borderColor: canvasTheme.toolbar.border,
          color: canvasTheme.node.text,
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) closeGuide();
        }}
      >
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: canvasTheme.node.stroke }}>
          <div className="text-base font-semibold">画布使用指南</div>
          <button
            type="button"
            className="rounded p-1 transition hover:bg-white/10"
            onClick={closeGuide}
            aria-label="关闭指南"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-5 py-4 text-sm">
          {GUIDE_SECTIONS.map((section) => (
            <section key={section.id} data-testid={`canvas-guide-section-${section.id}`}>
              <h3 className="mb-1.5 text-sm font-semibold">{section.title}</h3>
              <ul className="space-y-1 opacity-80">
                {section.items.map((item) => (
                  <li key={item} className="leading-5">
                    · {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="flex justify-end border-t px-5 py-3" style={{ borderColor: canvasTheme.node.stroke }}>
          <button
            type="button"
            className="rounded-md px-4 py-1.5 text-sm transition hover:opacity-80"
            style={{
              background: canvasTheme.toolbar.activeBg,
              color: canvasTheme.toolbar.activeText,
            }}
            onClick={closeGuide}
          >
            关闭
          </button>
        </div>
      </dialog>
      {open ? null : null}
    </div>
  );
}
