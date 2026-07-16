# Studio 画布模式

> Phase D 终态：Studio 仅挂载 **ScrollCanvas**（`ProductGallery` 时间线）+ 底部 **CreationDock**。  
> 关联：[CANVAS_SUBTRACTION_PLAN.md](./CANVAS_SUBTRACTION_PLAN.md)

---

## 决策函数（单一真相）

| 函数 | 文件 | 职责 |
|------|------|------|
| `resolveCanvasEngine()` | `apps/web/src/lib/studio-canvas-view.ts` | **画布引擎**，恒返回 `"scroll"` |
| `resolveCanvasViewToggleEnabled()` | 同上 | 「节点视图」切换，恒 `false`（已下线） |

单测：`pnpm exec tsx scripts/test-studio-canvas-view.ts`

---

## 运行时架构

```
用户 → 左轨 [+] → /studio → ScrollCanvas + StudioDock（CreationDock）
```

| 符号 | 含义 |
|------|------|
| `CanvasEngine` | 类型别名，仅 `"scroll"` |
| `DesignCanvas` | 画布壳层；内部仅渲染 `ScrollCanvasPane` |
| `StudioDock` | 全局底部创作 Dock，始终显示 |

---

## 数据模型

| 写源 | 字段 | API |
|------|------|-----|
| **唯一写源** | `canvas_layout` | `PUT /sessions/:id/canvas` |
| 只读兼容 | `canvas_flow` | `GET /sessions/:id/canvas-flow`（MCP/遗留读取） |
| 已废弃写 | `canvas_flow` | `PUT /sessions/:id/canvas-flow` → **410 Gone** |

Web 端通过 `use-session-canvas` → `saveCanvasLayout` 持久化；`infiniteConnections` 仍可在 layout DTO 中读写（向后兼容）。

存量迁移：`scripts/migrate-canvas-flow-to-layout.ts`（`--dry-run` 支持）

---

## 已下线（Phase D）

- **FreeCanvas** / 精修模式（`isRefineMode`、`enterRefineMode`）
- **InfiniteCanvasPane** 挂载（代码保留于 `infinite-canvas/`，Phase E 决定去留）
- **节点视图** toggle、`viewPhase` 用户态
- Workflow / Drama / Production 产品线（Phase A–C）

---

## 相关测试

| 场景 | 入口 |
|------|------|
| 引擎决策 | `scripts/test-studio-canvas-view.ts` |
| 死代码检查 | `scripts/test-dead-code-removed.ts` |
| Studio 冒烟 | `apps/web/e2e/smoke.spec.ts` |
