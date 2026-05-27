# 移动端协同优化 — 开发计划

> 分支：`feature/mobile-collab-optimization`  
> 目标：画布主屏 + 对话区按需抽屉 + 首页→Studio 闭环

## 里程碑

| Sprint | 范围 | 状态 |
|--------|------|------|
| A | P0-1 ~ P0-4 | ✅ 已完成 |
| B | P1-1 ~ P1-6 | ✅ 已完成 |
| C | P2-1 ~ P2-4 | ✅ 已完成 |
| D | P3-1 ~ P3-5 | ✅ 已完成 |

## 任务清单

### P0 — 阻断协同

| ID | 任务 | 状态 |
|----|------|------|
| P0-1 | 画布区展示生成进度（`CanvasJobOverlay`） | ✅ |
| P0-2 | AI 工具默认分辨率 + Seedream 最小像素兜底 | ✅ |
| P0-3 | 恢复 `pending_assets` sessionStorage | ✅ |
| P0-4 | 生成完成后自动 fit + pulse 新图 | ✅ |

### P1 — 协同体验

| ID | 任务 | 状态 |
|----|------|------|
| P1-1 | 移动端恢复热门能力 chips | ✅ |
| P1-2 | 需选图工具：画布↔对话区联动 | ✅ |
| P1-3 | 首页生成过渡 + `router.replace` | ✅ |
| P1-4 | 移动文案（对话区/画布角标） | ✅ |
| P1-5 | `?q=` / `?tool=` 深链补全 | ✅ |
| P1-6 | 画布工具栏移动底部横条 | ✅ |

### P2 — 信息架构

| ID | 任务 | 状态 |
|----|------|------|
| P2-1 | 术语统一（创作页/对话区/画布/工作区） | ✅ |
| P2-2 | 首次进入 Studio 轻量引导 | ✅ |
| P2-3 | 灵感 apply 滚动 + dock 动态占位 | ✅ |
| P2-4 | 移动最近会话入口 | ✅ |

### P3 — 增强

| ID | 任务 | 状态 |
|----|------|------|
| P3-1 | 首页生成轻量预览 overlay | ✅ |
| P3-2 | 画布长按上下文菜单 | ✅ |
| P3-3 | project kind 移动差异化提示 | ✅ |
| P3-4 | 触觉反馈（选中/完成） | ✅ |
| P3-5 | 断点统一到 `MOBILE_BREAKPOINT` | ✅ |

## 冒烟（移动 `<768px`）

见 [SMOKE_TEST.md](./SMOKE_TEST.md)「移动端协同」章节。

## 相关文件

| 路径 | 说明 |
|------|------|
| `apps/web/src/lib/breakpoints.ts` | 统一断点 768 |
| `apps/web/src/lib/pending-assets.ts` | 未登录附件恢复 |
| `apps/web/src/lib/tool-resolution.ts` | 工具默认分辨率 |
| `apps/web/src/lib/mobile-labels.ts` | 术语与移动文案 |
| `apps/web/src/components/design-canvas.tsx` | 画布进度/定位/长按菜单 |
| `apps/web/src/components/studio-workspace.tsx` | 主编排 |
| `apps/api/src/providers/tools/seedream-tool.ts` | 最小像素兜底 |

## 后续 PR

1. 本地 `pnpm typecheck` + `pnpm test:integration`
2. 开 PR → CI + Integration + E2E 全绿后合并
3. 合并后 Deploy workflow 部署生产
