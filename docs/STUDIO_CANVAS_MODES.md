# Studio 画布模式

> 终态：Studio 仅挂载 **ScrollCanvas**（`ProductGallery` 时间线）+ 底部 **CreationDock**。  
> 关联：[CANVAS_SUBTRACTION_PLAN.md](./CANVAS_SUBTRACTION_PLAN.md)

---

## 决策函数（单一真相）

| 函数 | 文件 | 职责 |
|------|------|------|
| `resolveCanvasEngine()` | `apps/web/src/lib/studio-canvas-view.ts` | **画布引擎**，恒返回 `"scroll"` |
| `resolveCanvasViewToggleEnabled()` | 同上 | 「节点视图」切换，恒 `false`（已下线） |
| `isCanvasFlowMode()` | `apps/web/src/lib/modes.ts` | **已废弃**，恒 `false`（Phase E 删除 Infinite） |

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
| **唯一写源** | `canvas_layout.items` | `PUT /sessions/:id/canvas` |
| 只读兼容 | `canvas_flow` | `GET /sessions/:id/canvas-flow`（MCP/遗留读取） |
| 已废弃写 | `canvas_flow` | `PUT /sessions/:id/canvas-flow` → **410 Gone** |
| Legacy 只读 | `infiniteConnections`, `dramaNodePositions` | layout DTO 中保留 schema，Web 不再写入 |

Web 端通过 `use-session-canvas` → `saveCanvasLayout` 持久化 items；legacy infinite/drama 字段仅 API 向后兼容读取。

存量迁移：`scripts/migrate-canvas-flow-to-layout.ts`（`--dry-run` 支持）

---

## 已下线

- **FreeCanvas** / 精修模式（Phase D）
- **InfiniteCanvas** 引擎及节点视图（Phase E）
- **圈选/扩图 Web UI**：`expand`、`inpaint`、`erase` 工具条已隐藏（API 路由保留，smoke 测试仍可用）
- Workflow / Drama / Production 产品线（Phase A–C）

---

## 保留的工具链（Scroll）

| 工具 | 交互 |
|------|------|
| cutout, upscale, enhance, variation, grid-split | 直接 / 确认弹窗 |
| focus-edit | 点选 + prompt |
| text, blend | prompt / @ 工作台 |

---

## 相关测试

| 场景 | 入口 |
|------|------|
| 引擎决策 | `scripts/test-studio-canvas-view.ts` |
| 死代码检查 | `scripts/test-dead-code-removed.ts` |
| 焦点编辑 E2E | `apps/web/e2e/focus-edit.spec.ts` |
| Studio 冒烟 | `apps/web/e2e/smoke.spec.ts` |
