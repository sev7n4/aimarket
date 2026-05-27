# 画布渐进反馈规范

> Studio 边创作边看效果：分实时层级，画布为主视图。

---

## 1. 反馈层级

| 类型 | 实时性 | 位置 | 实现 |
|------|--------|------|------|
| 结构预览 | 即时 | 对话区 / 槽位表单 | 灵感变量、Agent 计划、积分预估 |
| 生成预览 | 异步 | **左侧画布** | `message_outputs` 增量写入 + `loadCanvas` |
| 工具预览 | 半实时 | 画布 overlay | 蒙版/扩图框（Fabric，后续） |
| 批量进度 | 流式 | 画布角标 | Job SSE `completed/count` |

---

## 2. 套图渐进出图（已实现）

### 后端

- 多 slide Job（`slideLabels.length > 1`）在 `processGenerationJob` 中：
  1. 预先创建 assistant 消息
  2. 每完成一张 → 写入 `job_outputs` + `message_outputs`（含 `label`）
  3. 全部完成后更新消息摘要与 Job 状态

### SSE / 轮询

- `GET /ai/jobs/:id/stream` 在 **status 或 output 数量变化** 时推送：
  - `status`, `outputs`, `count`, `completed`

### 前端

- `studio-workspace`：`watchJob` 收到 `completed` 增加 → `loadCanvas()` + 可选 `focusLatestCanvasItem`
- `CanvasJobOverlay`：
  - 首张未出：全屏模糊 + 状态文案
  - 已有部分输出：右下角角标 `套图生成 2/4`（不挡画布对比）

---

## 3. 工具 Overlay 预览（规范，待 Fabric 增强）

| 工具 | Overlay 行为 |
|------|----------------|
| expand | 虚线扩图框 + 方向手柄 |
| erase / inpaint | 蒙版笔刷，提交前不调用 API |
| crop | 裁剪框（clientOnly） |
| cutout | 选中图后一键，无蒙版 |

原则：**能本地预览的不发 Job**；发 Job 后走同一 SSE 进度模型。

---

## 4. 移动端

- 画布全屏优先；Job 角标仍在右下
- 对话区为底部抽屉（见 MOBILE_COLLAB_PLAN.md）

---

## 5. 验收

1. 电商套图 4 张：画布上逐张出现，带主图/卖点/场景/详情 label
2. SSE 断开时轮询仍能渐进刷新
3. 单张生成仍使用全屏 overlay，完成后 fit + pulse
