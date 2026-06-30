# Tasks

## Phase 1（P0）：无限画布引擎统一

### Task 1.1: 移植核心类型与常量
- [ ] 1.1.1: 新建 `apps/web/src/components/infinite-canvas/types.ts`
  - 从 `/Users/4seven/workspace/infinite-canvas/web/src/app/(user)/canvas/types.ts` 移植核心类型
  - `Position { x, y }`、`ViewportTransform { x, y, k }`
  - `CanvasNodeType` 枚举（`text/image/video/audio/config` + 预留 Drama 扩展位）
  - `CanvasNodeStatus`（`idle/success/loading/error`）
  - `CanvasNodeMetadata`（扁平化可选字段集合）
  - `CanvasNodeData { id, type, title, position, width, height, metadata }`
  - `CanvasConnection { id, fromNodeId, toNodeId }`
  - `SelectionBox`、`ContextMenuState`
  - **适配**：去除 `CanvasAssistantMessage` / `CanvasAssistantSession` 等对话相关类型（Phase 3 再引入）；命名空间对齐 aimarket 现有约定
- [ ] 1.1.2: 新建 `apps/web/src/components/infinite-canvas/constants.ts`
  - 从 `/Users/4seven/workspace/infinite-canvas/web/src/app/(user)/canvas/constants.ts` 移植
  - `NODE_DEFAULT_SIZE`、`NODE_SPECS`、`getNodeSpec()`
  - **适配**：预留 Drama 节点默认尺寸占位（Phase 2 填充实际值）

### Task 1.2: 移植画布视口变换引擎
- [ ] 1.2.1: 新建 `apps/web/src/components/infinite-canvas/InfiniteCanvas.tsx`
  - 从 `/Users/4seven/workspace/infinite-canvas/web/src/app/(user)/canvas/components/infinite-canvas.tsx` 移植
  - 核心功能：CSS `transform: translate(x,y) scale(k)` 容器组件
  - Wheel 缩放：指数衰减公式 `1.1^(deltaY/100)`，鼠标位置为锚点，范围 `[0.05, 5]`
  - Pointer 平移：中键拖拽 / 空白区域左键拖拽 / Space+左键拖拽
  - `requestAnimationFrame` 节流
  - `onViewportChange` / `onCanvasDeselect` 回调
  - **适配**：主题系统对接 aimarket 的 theme（替换 `canvasThemes[theme]`）；去除 `data-canvas-no-zoom` / `.ant-modal` 等过滤逻辑（按需加回）
- [ ] 1.2.2: 新建 `apps/web/src/components/infinite-canvas/CanvasGrid.tsx`
  - 从 `infinite-canvas.tsx` 内部 `CanvasGrid` 提取
  - 支持 `dots` / `lines` / `blank` 三种背景模式
  - CSS `backgroundImage` + `backgroundSize` + `backgroundPosition` 实现跟随视口
  - **适配**：颜色值对接 aimarket theme

### Task 1.3: 移植节点渲染组件
- [ ] 1.3.1: 新建 `apps/web/src/components/infinite-canvas/CanvasNode.tsx`
  - 从 `/Users/4seven/workspace/infinite-canvas/web/src/app/(user)/canvas/components/canvas-node.tsx` 移植
  - 绝对定位 `div` + `transform: translate(x,y)`
  - `React.memo` 优化
  - `nodeContentRenderers` 映射表（Text→TextContent, Image→ImageNodeContent, Video→VideoNodeContent, Audio→AudioNodeContent, Config→自定义 prop）
  - 拖拽 / 四角 ResizeHandle / 连线锚点 `ConnectionHandleDot`
  - 选中/关联/聚焦三级视觉反馈
  - Batch 图片组 `BatchFrame`（层叠卡片+展开/收起动画）
  - **适配**：去除 antd 依赖（用 shadcn/ui 替代）；去除 `CanvasResourceMentionTextarea`（Phase 3 再引入）；主题对接 aimarket

### Task 1.4: 移植连线渲染组件
- [ ] 1.4.1: 新建 `apps/web/src/components/infinite-canvas/CanvasConnections.tsx`
  - 从 `/Users/4seven/workspace/infinite-canvas/web/src/app/(user)/canvas/components/canvas-connections.tsx` 移植
  - SVG `<path>` + 三次贝塞尔曲线
  - 源节点右侧中点 → 目标节点左侧中点
  - 透明粗路径点击热区 + 可见细路径
  - 选中高亮（发光滤镜 + 加粗）
  - `ActiveConnectionPath`（虚线拖拽中连线 + 吸附）
  - **适配**：颜色值对接 aimarket theme

### Task 1.5: 移植辅助组件
- [ ] 1.5.1: 新建 `apps/web/src/components/infinite-canvas/CanvasMiniMap.tsx`
  - 从 `/Users/4seven/workspace/infinite-canvas/web/src/app/(user)/canvas/components/canvas-mini-map.tsx` 移植
  - 240×160 缩略图，节点类型颜色区分，点击/拖动导航
- [ ] 1.5.2: 新建 `apps/web/src/components/infinite-canvas/CanvasZoomControls.tsx`
  - 从 `/Users/4seven/workspace/infinite-canvas/web/src/app/(user)/canvas/components/canvas-zoom-controls.tsx` 移植
  - range 滑块（5%~500%）+ 重置视图 + 快捷键帮助

### Task 1.6: 移植 Op 抽象层
- [ ] 1.6.1: 新建 `apps/web/src/components/infinite-canvas/utils.ts`
  - 从 `/Users/4seven/workspace/infinite-canvas/web/src/app/(user)/canvas/utils/canvas-agent-ops.ts` 移植
  - `CanvasAgentOp` 联合类型（8 种：add_node / update_node / delete_node / delete_connections / connect_nodes / set_viewport / select_nodes / run_generation）
  - `CanvasAgentSnapshot` 类型
  - `applyCanvasAgentOps(snapshot, ops)` 纯函数
  - `summarizeCanvasAgentOps(ops)` 人类可读摘要
  - **适配**：预留 Drama 专用 Op 扩展位（Phase 3 填充）

### Task 1.7: 改造 design-canvas.tsx
- [ ] 1.7.1: 替换底层渲染
  - 将 `ScrollCanvas` / `FreeCanvas` 渲染路径替换为 `InfiniteCanvas`
  - 保留 `DesignCanvasProps` 接口兼容性（增加适配层）
  - 工具栏 / Lightbox / 右键菜单 / 撤销重做保留
  - `CanvasItem` → `CanvasNodeData` 双向转换函数
- [ ] 1.7.2: 改造 `alternateCanvasContent` 机制
  - Phase 1 保留 `alternateCanvasContent` 兼容层（不破坏现有 Drama 功能）
  - 新增"画布内节点"渲染路径，与 `alternateCanvasContent` 并存
  - 逐步将 Drama 组件从 `alternateCanvasContent` 迁移为画布节点（Phase 2 完成）

### Task 1.8: 改造 studio-canvas-with-orchestration.tsx
- [ ] 1.8.1: Drama 面板位置调整
  - `DramaStudioPanel` 从底部 `orchestrationExtra` 迁移到右侧面板
  - 右侧面板可展开/收起，不遮挡画布主区
- [ ] 1.8.2: 保留现有 Drama 时间线/制作进度/成片播放器功能
  - 短期内仍通过 `alternateCanvasContent` 渲染
  - Phase 2 迁移为画布节点后移除

### Task 1.9: 数据迁移
- [ ] 1.9.1: 新建 `apps/web/src/components/infinite-canvas/migration.ts`
  - `canvasItemToNodeData(item: CanvasItem): CanvasNodeData`
  - `nodeDataToCanvasItem(node: CanvasNodeData): CanvasItem`
  - `batchSectionToBatchNodes(section: BatchSection): CanvasNodeData[]`
  - 向后兼容：旧项目打开时自动迁移，新项目使用新格式

### Task 1.10: 验证
- [ ] 1.10.1: E2E 测试覆盖画布平移/缩放/节点拖拽/连线创建
- [ ] 1.10.2: 旧项目数据无损迁移验证
- [ ] 1.10.3: 现有素材生成流程不受影响验证
- [ ] 1.10.4: TypeScript 编译零错误

---

## Phase 2（P1）：Drama 节点化

### Task 2.1: 扩展节点类型
- [ ] 2.1.1: 更新 `apps/web/src/components/infinite-canvas/types.ts`
  - `CanvasNodeType` 增加 `"script" | "shot" | "character" | "scene"`
  - 定义 `DramaNodeMetadata` 子类型（ScriptMetadata / ShotMetadata / CharacterMetadata / SceneMetadata）
- [ ] 2.1.2: 更新 `apps/web/src/components/infinite-canvas/constants.ts`
  - 增加 Drama 节点默认尺寸（Script: 400×300, Shot: 360×260, Character: 340×280, Scene: 360×240）
  - 增加默认 metadata（ScriptMetadata: `{ title: "", logline: "", acts: [] }` 等）
- [ ] 2.1.3: 更新 `apps/web/src/components/infinite-canvas/CanvasNode.tsx`
  - `nodeContentRenderers` 增加 Drama 类型分派

### Task 2.2: Drama 节点渲染组件
- [ ] 2.2.1: 新建 `apps/web/src/components/infinite-canvas/drama/ScriptNodeContent.tsx`
  - 渲染标题 + 梗概 + 三幕折叠列表
  - 双击进入编辑模式（标题/梗概可编辑）
  - 连线锚点：右侧输出（→shot）
- [ ] 2.2.2: 新建 `apps/web/src/components/infinite-canvas/drama/ShotNodeContent.tsx`
  - 渲染缩略图（如有 image 子节点输出）+ 对白摘要 + 摄影参数角标
  - 双击进入编辑模式（visualPrompt / motionPrompt / cameraSpec 可编辑）
  - 连线锚点：左侧输入（←script, ←character, ←scene），右侧输出（→image）
- [ ] 2.2.3: 新建 `apps/web/src/components/infinite-canvas/drama/CharacterNodeContent.tsx`
  - 渲染三视图缩略图 + promptAnchor 文本 + 锁定状态角标
  - 双击打开三视图编辑面板
  - 连线锚点：右侧输出（→shot）
- [ ] 2.2.4: 新建 `apps/web/src/components/infinite-canvas/drama/SceneNodeContent.tsx`
  - 渲染场景图 + 氛围标签 + location 文本
  - 双击进入编辑模式
  - 连线锚点：右侧输出（→shot）

### Task 2.3: Drama 规划 → 画布节点映射
- [ ] 2.3.1: 新建 `apps/web/src/components/infinite-canvas/drama/drama-plan-to-nodes.ts`
  - `dramaPlanToCanvasOps(project: DramaProjectData): CanvasAgentOp[]`
  - 映射规则：
    - `script` → `add_node(type="script")`
    - `characters[]` → `add_node(type="character")` × N
    - `scenes[]` → `add_node(type="scene")` × N
    - `shots[]` → `add_node(type="shot")` × N
    - 自动连线：`connect_nodes(script→shot)` + `connect_nodes(character→shot)` + `connect_nodes(scene→shot)`
  - 自动布局算法：script 在左(x=0), character/scene 在中(x=500), shot 在右(x=1000)，纵向均匀分布

### Task 2.4: Drama 面板重构
- [ ] 2.4.1: 改造 `apps/web/src/components/drama-studio-panel.tsx`
  - 从固定三栏布局重构为右侧动态属性面板
  - 未选中节点时：展示 Drama 项目概览（标题/状态/制作进度）
  - 选中 script 节点时：展示剧本编辑界面（标题/梗概/三幕/旁白）
  - 选中 character 节点时：展示角色三视图编辑（复用 `DramaCharacterCardView`）
  - 选中 shot 节点时：展示分镜 prompt 编辑 + 摄影参数 + 对白编辑
  - 选中 scene 节点时：展示场景参数编辑 + 参考图上传
- [ ] 2.4.2: 改造 `apps/web/src/components/studio-canvas-with-orchestration.tsx`
  - 移除 `alternateCanvasContent` 替换逻辑
  - Drama 规划完成后调用 `dramaPlanToCanvasOps` 在画布上创建节点
  - Drama 时间线/制作进度/成片播放器迁移为画布节点渲染

### Task 2.5: 验证
- [ ] 2.5.1: Drama 规划完成后画布自动创建所有节点和连线
- [ ] 2.5.2: 各 Drama 节点渲染正确，双击可编辑
- [ ] 2.5.3: 选中节点时右侧面板展示对应编辑界面
- [ ] 2.5.4: 节点连线语义正确（script→shot, character→shot, scene→shot）
- [ ] 2.5.5: TypeScript 编译零错误

---

## Phase 3（P1）：Agent 对话式操控

### Task 3.1: 扩展 Op 抽象层
- [ ] 3.1.1: 更新 `apps/web/src/components/infinite-canvas/utils.ts`
  - `CanvasAgentOp` 增加 Drama 专用 Op：
    - `{ type: "plan_drama"; input: PlanDramaInput }`
    - `{ type: "generate_character_sheet"; nodeId: string }`
    - `{ type: "generate_shot_image"; nodeId: string }`
    - `{ type: "generate_shot_video"; nodeId: string }`
    - `{ type: "run_drama_production"; projectPatch?: Partial<DramaProjectData> }`
  - `applyCanvasAgentOps` 增加 Drama Op 处理分支
- [ ] 3.1.2: 新建 `apps/web/src/components/infinite-canvas/drama/drama-agent-ops.ts`
  - `dramaToolToOps(toolName, args, snapshot): CanvasAgentOp[]`
  - Drama Op → API 调用逻辑：
    - `plan_drama` → 调用后端 `POST /drama/plan/runs` → 转换输出为 add_node + connect_nodes ops
    - `generate_character_sheet` → 调用后端三视图 API → update_node 更新角色节点
    - `generate_shot_image` → 调用图片生成 API → add_node(type="image") + connect_nodes(shot→image)
    - `generate_shot_video` → 调用视频生成 API → add_node(type="video") + connect_nodes(image→video)
    - `run_drama_production` → 调用后端制作 API → 触发 SSE 事件流

### Task 3.2: 移植 Agent 对话面板
- [ ] 3.2.1: 新建 `apps/web/src/components/infinite-canvas/agent/CanvasAssistantPanel.tsx`
  - 从 `/Users/4seven/workspace/infinite-canvas/web/src/app/(user)/canvas/components/canvas-assistant-panel.tsx` 改编
  - 消息列表 + 输入框 + 工具确认卡片 + 事件日志
  - 右侧可展开/收起面板
  - **适配**：去除 antd 依赖（用 shadcn/ui 替代）；去除 local agent 模式（仅保留 online 模式）
- [ ] 3.2.2: 新建 `apps/web/src/components/infinite-canvas/agent/agent-tools.ts`
  - 22 个基础画布工具 JSON Schema（从 `canvas-assistant-panel.tsx` 中的 `ONLINE_AGENT_TOOLS` 提取）
  - 9 个 Drama 专用工具 JSON Schema：
    - `drama_plan` / `drama_create_script` / `drama_create_character` / `drama_create_shot` / `drama_create_scene`
    - `drama_generate_character_sheet` / `drama_generate_shot_image` / `drama_generate_shot_video` / `drama_run_production`
- [ ] 3.2.3: 新建 `apps/web/src/components/infinite-canvas/agent/online-agent-loop.ts`
  - 提取自 `canvas-assistant-panel.tsx` 的核心循环逻辑
  - `runOnlineAgentLoop(messages, tools, maxSteps, onStep)` 函数
  - 首轮 `tool_choice="required"`，后续 `tool_choice="auto"`
  - `ONLINE_AGENT_MAX_STEPS = 6`
  - `buildToolAgentMessages()` 构建系统提示 + 画布快照 + 历史消息
  - `onlineToolToOps()` 工具名 → CanvasAgentOp[] 转换
  - 工具确认模式：写操作暂停等待用户 approve/reject
  - Noop 检测：操作前后快照签名对比

### Task 3.3: 对接 aimarket LLM 路由
- [ ] 3.3.1: 新增后端代理接口 `POST /api/agent/tool-response`
  - 接收前端发送的 messages + tools + tool_choice
  - 调用 `completeWithFallback`（支持 deepseek/qwen/glm/openai/claude/agnes 多模型 fallback）
  - 返回格式兼容 OpenAI Chat Completions（含 `tool_calls` 字段）
  - 流式响应支持（SSE 逐 token 推送）
- [ ] 3.3.2: 更新 `apps/web/src/components/infinite-canvas/agent/online-agent-loop.ts`
  - `requestToolResponse` → 调用 `/api/agent/tool-response` 而非直接调用 OpenAI
  - 解析流式响应，实时更新 assistant 消息

### Task 3.4: 编译式 Agent 输出 → Op 转换
- [ ] 3.4.1: 更新 `apps/web/src/components/infinite-canvas/drama/drama-plan-to-nodes.ts`
  - 前端通过 SSE 收到 `plan_complete` 事件后，调用 `dramaPlanToCanvasOps` 转换
  - 输出 `CanvasAgentOp[]` 统一由 `applyCanvasAgentOps` 应用到画布
  - 编译式和对话式 Agent 在画布层面使用同一套 Op 抽象

### Task 3.5: 集成到画布布局
- [ ] 3.5.1: 更新 `apps/web/src/components/studio-canvas-with-orchestration.tsx`
  - 右侧面板增加 `CanvasAssistantPanel` 入口
  - Agent 面板与 Drama 属性面板共存（Tab 切换）
  - `onApplyOps` 回调连接到画布状态更新

### Task 3.6: 验证
- [ ] 3.6.1: 用户可通过对话框让 Agent 创建/修改/删除画布节点
- [ ] 3.6.2: Agent 可通过 `drama_plan` 一键生成完整规划（画布自动创建节点）
- [ ] 3.6.3: Agent 可通过 `drama_generate_shot_image` 等工具生成分镜内容
- [ ] 3.6.4: 工具确认模式下写操作需用户批准
- [ ] 3.6.5: 编译式和对话式 Agent 使用同一套 Op 抽象
- [ ] 3.6.6: TypeScript 编译零错误

---

## Phase 4（P2）：专业能力补齐

### Task 4.1: 多机位分镜
- [ ] 4.1.1: 新建 `apps/web/src/components/infinite-canvas/drama/MultiCamGrid.tsx`
  - 3×3 / 5×5 宫格渲染组件
  - 点击单格可放大/下载/设为参考
  - 复用 infinite-canvas 的 `BatchFrame` 层叠卡片
- [ ] 4.1.2: 新建 `apps/api/src/providers/tools/multi-cam-9.ts`
  - 注册 `multi-cam-9` 工具
  - 基于参考图生成 9 个不同机位 prompt，批量调用图片生成
- [ ] 4.1.3: 新建 `apps/api/src/providers/tools/multi-cam-25.ts`
  - 注册 `multi-cam-25` 工具
  - LLM 拆解场景为 25 个连贯镜头描述，批量生成图片

### Task 4.2: 灯光/摄像机可视化控制
- [ ] 4.2.1: 新建 `apps/web/src/components/infinite-canvas/drama/LightingOverlay.tsx`
  - 叠加在选中图片上，支持点击添加/拖拽移动/删除光源点
  - 参数面板：色温（暖白/冷白/暖黄）、强度（0-100%）、类型（点光/面光/聚光）
  - 参数编码为 prompt 约束词
- [ ] 4.2.2: 新建 `apps/web/src/components/infinite-canvas/drama/CameraOverlay.tsx`
  - 俯仰角/水平角/景别三滑块
  - 参数映射为运镜描述词

### Task 4.3: 工作流模板保存/复用
- [ ] 4.3.1: 新建 `apps/web/src/components/infinite-canvas/TemplateManager.tsx`
  - 选中节点组 → "保存为模板" → 序列化节点类型/连线/参数为 JSON
  - 模板列表 → 选择 → 替换素材 → 一键重跑
  - 预置模板：「短剧标准流程」「MV 制作」「广告 TVC」
- [ ] 4.3.2: 新建 `apps/api/src/routes/drama-templates.ts`
  - `POST /drama/templates` — 保存模板
  - `GET /drama/templates` — 列表
  - `GET /drama/templates/:id` — 详情
  - `POST /drama/templates/:id/run` — 一键重跑

### Task 4.4: 视频精准编辑
- [ ] 4.4.1: 新建 `apps/api/src/providers/tools/video-inpaint.ts`
  - 关键帧提取 + mask 绘制 + inpaint + i2v 传播

### Task 4.5: AI 音乐生成
- [ ] 4.5.1: 新建 `apps/api/src/providers/tools/music-gen.ts`
  - 对接 Suno/Udio API 或自建音乐模型
  - 接入 MV Skill

### Task 4.6: 验证
- [ ] 4.6.1: 9 宫格工具生成 9 张不同机位图片
- [ ] 4.6.2: 25 宫格工具生成 25 张连贯分镜
- [ ] 4.6.3: 灯光控制参数正确编码为 prompt
- [ ] 4.6.4: 摄像机参数正确映射为运镜词
- [ ] 4.6.5: 模板保存后可一键重跑
- [ ] 4.6.6: video-inpaint 可对视频关键帧局部编辑
- [ ] 4.6.7: 音乐生成产出 30-60 秒背景音乐
- [ ] 4.6.8: TypeScript 编译零错误

---

# Task Dependencies

```
Phase 1:
  Task 1.1 → Task 1.2, 1.3, 1.4, 1.5, 1.6  (类型先行)
  Task 1.2 + 1.3 + 1.4 + 1.5 → Task 1.7     (组件就绪后改造 design-canvas)
  Task 1.7 → Task 1.8                         (design-canvas 就绪后改造 orchestration)
  Task 1.7 → Task 1.9                         (同时做数据迁移)
  Task 1.7 + 1.8 + 1.9 → Task 1.10            (全部就绪后验证)

Phase 2（依赖 Phase 1 完成）:
  Task 2.1 → Task 2.2, 2.3                    (类型扩展先行)
  Task 2.2 + 2.3 → Task 2.4                   (节点+映射就绪后重构面板)
  Task 2.4 → Task 2.5                         (重构后验证)

Phase 3（依赖 Phase 1 完成，可与 Phase 2 并行）:
  Task 3.1 → Task 3.2, 3.3                    (Op 扩展先行)
  Task 3.2 + 3.3 → Task 3.4, 3.5              (Agent 面板+LLM 路由就绪后集成)
  Task 3.4 + 3.5 → Task 3.6                   (集成后验证)

Phase 4（依赖 Phase 2 完成）:
  Task 4.1, 4.2, 4.3, 4.4, 4.5 可并行
  全部 → Task 4.6                              (验证)
```
