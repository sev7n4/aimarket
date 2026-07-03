# InfiniteCanvas 节点增删 — 开发任务跟踪

> Phase 4.6 分支：`feature/phase-4.6-node-crud`

## P0（本 PR 目标）

- [x] `NodeCreateMenu` — 空白右键 + 工具栏 `+` 添加节点
- [x] `mergeSnapshotToCanvasItems` — text/config 节点写入 `canvas_layout`（`infiniteNodeType`）
- [x] `applyDramaCanvasOps` — Drama 角色/场景/分镜增删写回 `DramaProjectPayload`
- [x] `studio-canvas` 接线 `onApplyAssistantOps` → `saveDramaDraft`
- [x] 统一删除：右键 / Del 键 → `delete_node` Op（图片 + Drama）
- [x] Agent `add_node` / `delete_node` 与手动操作共用 `commitCanvasOps`

## P1（下一步）

- [ ] 连线右键删除 UI + `delete_connections` 持久化
- [ ] 输出端口「+」快速创建下游 Config/Image 节点（`data-connection-create-menu`）
- [ ] Drama 节点拖拽坐标写回（当前重算布局会覆盖手动位置）
- [ ] 空白双击弹出创建菜单（对标 LibTV spec 1.5）

## P2（后续）

- [ ] 废弃/迁移 `canvas_flow` REST API → 与 `canvas_layout` / InfiniteCanvas 统一
- [ ] `e2e/canvas-node-crud.spec.ts`：空白加 text → 删 → 连线 → 删连线
- [ ] close-libtv-gap Task 1.7 全量 E2E 覆盖

## 已知限制（P0）

- 图片/视频节点仍由生成任务创建，不支持空占位手动添加
- 无制片草稿时不展示 Drama 类创建项
- 连线创建后尚未持久化到 session（与 Phase 1 相同）
