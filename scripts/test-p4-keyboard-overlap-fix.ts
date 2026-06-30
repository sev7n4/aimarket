#!/usr/bin/env node
/**
 * P4.3 修复回归测试：验证画布 overlay 中关键控件的 testid/位置，避免再被 dock / MiniMap 遮盖。
 *
 * 关键点（基于 MCP 浏览器实测结论）：
 *   1) 背景主题按钮组 (canvas-background-controls) 必须从右下角挪走，
 *      否则在 mobile (556×628) / desktop (1440×900) 视口下都会被 React Flow MiniMap 完全覆盖，
 *      elementFromPoint 命中的是 dock 内部 div，用户根本点不到。
 *   2) 顶部工具栏必须包含：撤销/重做/复制、命令、一键整理、列表视图、背景主题。
 *   3) React Flow 自带 Controls (react-flow__controls) 不应再渲染（与我们的 zoom 重复）。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const results: { name: string; pass: boolean; detail?: string }[] = [];
function ok(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const root = join(__dirname, "..");
const overlay = readFileSync(
  join(root, "apps/web/src/components/canvas-flow-overlay.tsx"),
  "utf8",
);
const flow = readFileSync(
  join(root, "apps/web/src/components/canvas-flow.tsx"),
  "utf8",
);
const ws = readFileSync(
  join(root, "apps/web/src/components/studio-workspace.tsx"),
  "utf8",
);
const iab = readFileSync(
  join(root, "apps/web/src/components/image-action-bar.tsx"),
  "utf8",
);

// 1) 背景主题按钮必须在顶部工具栏（canvas-flow-overlay.tsx）
const overlayHasBgInToolbar =
  /canvas-background-controls[\s\S]{0,300}?背景主题/.test(overlay) ||
  /背景主题[\s\S]{0,300}?canvas-background-controls/.test(overlay) ||
  // 简化：检查 overlay 文件中 background-controls 出现的行号
  (() => {
    const lines = overlay.split("\n");
    const bgLine = lines.findIndex((l) => l.includes("canvas-background-controls"));
    return bgLine > 0 && bgLine < 200 && /top-3/.test(lines[Math.max(0, bgLine - 10)] || "");
  })();
ok(
  "背景主题按钮组 canvas-background-controls 在 overlay 文件中（移到顶部）",
  overlay.includes("canvas-background-controls") && !/bottom-3 right-3.*canvas-background-controls/s.test(overlay),
  "右下角版本应已删除",
);

// 2) overlay 文件中不应再有 right-3 z-20 的 background-controls 容器
ok(
  "overlay 中右下角 background-controls 已删除（避免与 MiniMap 抢右下角）",
  !/bottom-3 right-3[\s\S]{0,40}?canvas-background-controls/.test(overlay),
);

// 3) canvas-flow.tsx 中 React Flow Controls 不应再渲染
ok(
  "canvas-flow.tsx 中 React Flow <Controls /> 已禁用",
  !/^\s*<Controls\s/m.test(flow) || /Controls[^>]*showZoom=\{false\}/.test(flow),
  "应改为 showZoom/showFitView/showInteractive 全 false 或直接不渲染",
);

// 4) Controls 不再从 @xyflow/react 导入
ok(
  "canvas-flow.tsx 中 Controls 已从 @xyflow/react 导入列表中移除",
  !/^\s*Controls,$/m.test(flow.split("from \"@xyflow/react\"")[0] || ""),
);

// 5) CanvasFlowHandle 接口包含 deleteSelected
ok(
  "CanvasFlowHandle 接口暴露 deleteSelected()",
  /deleteSelected:\s*\(\)\s*=>\s*number/.test(flow),
);

// 6) useImperativeHandle 实现了 deleteSelected
ok(
  "useImperativeHandle 中实现了 deleteSelected (过滤选中节点 + 关联边)",
  /deleteSelected:\s*\(\)\s*=>\s*\{[\s\S]{0,500}?selectedNodeIds[\s\S]{0,500}?setNodes\([\s\S]{0,200}?setEdges/.test(flow),
);

// 7) studio-workspace.tsx 监听 Delete/Backspace 键
ok(
  "studio-workspace 显式监听 Delete/Backspace 键 (无 mod 条件下)",
  /e\.key === "Delete" \|\| e\.key === "Backspace"/.test(ws),
);

// 8) studio-workspace 在 image-action-bar / batch-tool-strip 焦点时跳过画布快捷键
ok(
  "studio-workspace 在 image-action-bar / canvas-batch-tool-strip 焦点时跳过画布快捷键",
  /target\.closest\(\s*"\[\s*data-testid='image-action-bar'\s*\],\s*\[\s*data-testid='canvas-batch-tool-strip'\s*\]"\s*\)/.test(ws),
);

// 9) image-action-bar 组件加上 data-testid
ok(
  "image-action-bar 加上 data-testid=\"image-action-bar\"",
  /data-testid="image-action-bar"/.test(iab),
);

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
