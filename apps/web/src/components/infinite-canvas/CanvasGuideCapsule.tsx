"use client";

import { BookOpen, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { canvasTheme } from "./canvas-theme";

type GuideSection = {
  title: string;
  items: string[];
};

const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: "一、画布导航",
    items: [
      "空格 / 中键 / 右键拖：平移画布",
      "W / A / S / D：键盘平移（Shift 加速）",
      "E / Q：以视口中心放大 / 缩小",
      "滚轮：缩放；右下角滑条可微调缩放",
      "空白处左键拖：框选多个节点",
      "左下角开关条：网格 / 吸附 / 连线动画 / 锁定视角",
    ],
  },
  {
    title: "二、基础操作",
    items: [
      "空白双击或右键：添加节点",
      "从输出点拖线到空白：创建节点并自动连线",
      "从节点连接点拖线到节点：创建连线",
      "双击节点标题：重命名",
      "单击连线选中，点击中点剪刀：删除连线",
      "Delete / Backspace：删除选中连线或节点",
      "Shift / Ctrl / Cmd + 点击：追加选择",
    ],
  },
  {
    title: "三、高级功能",
    items: [
      "Ctrl / Cmd + C / V：复制 / 粘贴节点",
      "右下角指南针：小地图与视图重置",
      "L：切换网格吸附",
    ],
  },
];

export function CanvasGuideCapsule() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (panelRef.current?.contains(target)) return;
      close();
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open, close]);

  const dockStyle = {
    background: canvasTheme.toolbar.panel,
    borderColor: canvasTheme.toolbar.border,
    color: canvasTheme.toolbar.item,
    boxShadow: "0 12px 32px rgba(0,0,0,.28)",
  };

  return (
    <div ref={panelRef} className="relative" data-testid="canvas-guide-capsule">
      <button
        type="button"
        data-testid="canvas-guide-toggle"
        aria-expanded={open}
        aria-label="画布使用指南"
        title="画布使用指南"
        className="flex h-10 items-center gap-1.5 rounded-lg border px-2.5 text-xs shadow-lg backdrop-blur transition-colors hover:opacity-90"
        style={dockStyle}
        onClick={() => setOpen((v) => !v)}
      >
        <BookOpen className="size-3.5 shrink-0" />
        <span className="hidden sm:inline">使用指南</span>
        <ChevronDown
          className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          className="absolute bottom-full left-0 mb-2 w-72 max-h-[min(420px,60vh)] overflow-y-auto rounded-xl border p-3 shadow-2xl backdrop-blur"
          style={{
            background: canvasTheme.toolbar.panel,
            borderColor: canvasTheme.toolbar.border,
            color: canvasTheme.node.text,
          }}
          data-testid="canvas-guide-panel"
        >
          <div className="mb-2 text-sm font-semibold">画布使用指南</div>
          <div className="space-y-3 text-xs leading-relaxed">
            {GUIDE_SECTIONS.map((section) => (
              <section key={section.title}>
                <h3 className="mb-1 font-medium" style={{ color: canvasTheme.node.label }}>
                  {section.title}
                </h3>
                <ul className="space-y-1 pl-3" style={{ color: canvasTheme.node.muted }}>
                  {section.items.map((item) => (
                    <li key={item} className="list-disc">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
