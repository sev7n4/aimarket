# InfiniteCanvas 节点增删 — 开发任务跟踪

> Phase 4.6.1 分支：`feature/phase-4.6.1-connection-crud`

## P0（#259 已合并）

- [x] `NodeCreateMenu` — 空白右键 + 工具栏 `+` 添加节点
- [x] `mergeSnapshotToCanvasItems` — text/config 节点写入 `canvas_layout`（`infiniteNodeType`）
- [x] `applyDramaCanvasOps` — Drama 角色/场景/分镜增删写回 `DramaProjectPayload`
- [x] 统一删除：右键 / Del 键 → `delete_node` Op（图片 + Drama）

## P1（#260 本 PR）

- [x] 连线右键删除 UI + `delete_connections` 持久化
- [x] 输出端口「+」快速创建下游 Config/Text 节点（`data-connection-create-menu`）
- [x] Drama 节点拖拽坐标写回（`canvas_layout.dramaNodePositions`）
- [x] 空白双击弹出创建菜单

## P2（本 PR 含）

- [x] `canvas_flow` REST API 桥接到 `canvas_layout`（`canvas-flow-layout-bridge`）
- [x] `e2e/canvas-node-crud.spec.ts`：空白加 text → 删 → 端口+连线 → 删连线
- [x] close-libtv-gap Task 1.7 全量 E2E 覆盖（含一对多分支连线用例）

## 已知限制

- 图片/视频节点仍由生成任务创建，端口「+」仅支持下游 Config/Text
- 无制片草稿时不展示 Drama 类创建项
- 模板仍存于 `canvas_flow` 遗留 JSON 的 `templates` 字段
