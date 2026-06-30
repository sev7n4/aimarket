# AIMarket 集成 Infinite Canvas 能力 — 开发 PRD

> 对标 LibTV，借鉴 `/Users/4seven/workspace/infinite-canvas` 开源仓库，将 aimarket 画布从"三套割裂画布 + 替换式 Drama 注入"升级为"统一无限画布 + 节点式工作流 + Agent 对话式操控"。

---

## 一、背景与目标

### 1.1 竞品现状（LibTV）

LibTV 已建立"无限画布 + 节点式工作流 + 20+ 专业工具 + Agent Skill 开放生态"壁垒：
- **无限画布节点工作流**：脚本/分镜/画面/视频/音频 5 种节点自由连线
- **全流程剧本到成片**：剧情梗概 → 角色提取 → 分镜生成 → 视频制作 → 成片导出
- **角色一致性控制**：三视图 + 多角度锁定
- **多机位分镜**：9/25 宫格
- **30+ 模型聚合**：Seedance、可灵、万相、Midjourney、Vidu
- **Agent Skill 接口**：开放 Skill 接口，OpClaw/KimiClaw 等 Agent 直接调用
- **工作流模板复用**：节点组合序列化，批量产出

### 1.2 AIMarket 现状差距

| 维度 | LibTV | AIMarket 现状 | 差距 |
|---|---|---|---|
| 画布引擎 | 统一无限画布（CSS transform 自实现） | 三套画布：ScrollCanvas（时间线）+ FreeCanvas（自由布局）+ CanvasFlow（React Flow 节点图），互不统一 | **核心差距** |
| Drama 集成 | 剧本/角色/分镜/视频作为画布节点共存 | Drama 组件通过 `alternateCanvasContent` **替换式注入**，与画布不共存 | **核心差距** |
| Agent 操控 | function calling 循环，22 个画布工具 | 编译式单轮 LLM 调用，无 function calling，前端无 Agent 对话循环 | **核心差距** |
| 多机位分镜 | 9/25 宫格 + 多机位对比 | 仅基础九宫格（`DramaStoryboardGrid`） | 中等差距 |
| 角色一致性 | 三视图 + 一致性锁定 | ✅ `drama-character-card.tsx` 已有三视图 + 锁定 | 基本对齐 |
| 模型聚合 | 30+ 模型 | ✅ 有多模型路由 | 基本对齐 |
| 模板复用 | 画布节点序列化 + 一键重跑 | 有版本历史但无模板系统 | 中等差距 |

### 1.3 核心目标

1. **统一画布引擎**：用 infinite-canvas 的 CSS transform 引擎替换现有三套画布
2. **Drama 节点化**：剧本/角色/场景/分镜/视频作为画布节点在同一空间共存
3. **Agent 对话式操控**：前端增加 function calling 循环，Agent 可直接操作画布节点
4. **对标 LibTV 专业能力**：多机位分镜、灯光/摄像机控制、模板复用

---

## 二、技术方案

### 2.1 画布引擎选型：复用 infinite-canvas CSS transform 方案

**不使用 React Flow 作为主画布引擎**，理由：
- React Flow 定位是"节点图"，擅长 DAG 流程展示，不擅长自由创意画布（素材混合排版）
- infinite-canvas 的 CSS transform 方案更轻量（215 行核心代码 vs React Flow 体积）、更可控
- aimarket 已有的 `CanvasFlow`（React Flow）可作为辅助视图保留，但主画布迁移到 CSS transform

**从 infinite-canvas 复用的核心代码：**

| 源文件 | 行数 | 复用内容 | 适配改动 |
|---|---|---|---|
| `infinite-canvas.tsx` | ~215 | 视口变换引擎（translate+scale）、wheel 缩放、pointer 平移、网格背景 | 替换 `free-canvas.tsx` 和 `scroll-canvas.tsx` 的底层渲染 |
| `canvas-node.tsx` | ~679 | 节点渲染（绝对定位+transform）、拖拽/缩放/选中/连线锚点/Batch 图片组 | 增加 Drama 专用节点类型渲染（Script/Shot/Character/Scene） |
| `canvas-connections.tsx` | ~78 | SVG 贝塞尔连线 | 直接复用 |
| `canvas-mini-map.tsx` | — | 小地图 | 直接复用 |
| `canvas-zoom-controls.tsx` | — | 缩放控件 | 直接复用 |
| `canvas-agent-ops.ts` | ~96 | `CanvasAgentOp` 8 种操作 + `applyCanvasAgentOps` 纯函数 | 增加 Drama 专用 Op 类型 |
| `canvas-assistant-panel.tsx` | ~1315 | Online Agent function calling 循环 + 22 个工具定义 | 增加 Drama 专用工具 |
| `types.ts` | ~137 | `ViewportTransform` / `CanvasNodeData` / `CanvasConnection` 等核心类型 | 扩展 Drama 节点类型 |
| `constants.ts` | ~44 | 节点默认尺寸 | 增加 Drama 节点默认尺寸 |
| `use-canvas-store.ts` | ~134 | Zustand + localForage 持久化 | 适配 aimarket 的项目数据结构 |

### 2.2 Drama 节点类型扩展

在 infinite-canvas 的 5 种基础节点（`text/image/video/audio/config`）上扩展 4 种 Drama 专用节点：

```typescript
type DramaCanvasNodeType =
  | "text" | "image" | "video" | "audio" | "config"  // 原有 5 种
  | "script"     // 脚本节点：含 title/logline/acts/narratorLines
  | "shot"       // 分镜节点：含 visualPrompt/motionPrompt/cameraSpec/dialogue
  | "character"  // 角色节点：含 visualSignature/promptAnchor/三视图
  | "scene";     // 场景节点：含 location/atmosphere/promptAnchor

// 连线语义
// script  → shot       （脚本产出分镜）
// character → shot     （角色参与分镜）
// scene   → shot       （场景对应分镜）
// shot    → image      （分镜生成首帧）
// image   → video      （首帧生成视频）
// config  → image/video（配置驱动生成）
```

**Drama 节点默认尺寸：**

| 类型 | 宽 | 高 | 默认标题 |
|---|---|---|---|
| Script | 400 | 300 | 新剧本 |
| Shot | 360 | 260 | 新分镜 |
| Character | 340 | 280 | 新角色 |
| Scene | 360 | 240 | 新场景 |

### 2.3 Agent Op 扩展

在 infinite-canvas 的 8 种 `CanvasAgentOp` 基础上增加 Drama 专用 Op：

```typescript
type DramaCanvasAgentOp =
  | CanvasAgentOp  // 原有 8 种：add_node/update_node/delete_node/...
  | { type: "plan_drama"; input: PlanDramaInput }          // 批量规划 → 生成多个 Drama 节点
  | { type: "generate_character_sheet"; nodeId: string }   // 角色三视图生成
  | { type: "generate_shot_image"; nodeId: string }        // 分镜首帧生成
  | { type: "generate_shot_video"; nodeId: string }        // 分镜视频生成
  | { type: "run_drama_production"; projectPatch?: Partial<DramaProjectData> }  // 触发制作流水线
```

### 2.4 Agent 工具扩展

在 infinite-canvas 的 22 个工具基础上增加 Drama 专用工具：

| 工具名 | 用途 | 映射到 Op |
|---|---|---|
| `drama_plan` | 根据用户想法一键生成剧本→分镜→角色的完整规划 | `plan_drama` |
| `drama_create_script` | 创建脚本节点 | `add_node` (type=script) |
| `drama_create_character` | 创建角色节点 | `add_node` (type=character) |
| `drama_create_shot` | 创建分镜节点 | `add_node` (type=shot) |
| `drama_create_scene` | 创建场景节点 | `add_node` (type=scene) |
| `drama_generate_character_sheet` | 为角色生成三视图 | `generate_character_sheet` |
| `drama_generate_shot_image` | 为分镜生成首帧 | `generate_shot_image` |
| `drama_generate_shot_video` | 为分镜生成视频 | `generate_shot_video` |
| `drama_run_production` | 触发制作流水线 | `run_drama_production` |

### 2.5 编译式 + 对话式双模式并存

- **编译式 Agent（保留）**：用于批量规划场景（5 Agent 链式规划），后端执行
- **对话式 Agent（新增）**：用于交互式修改（用户在画布上选节点 → Agent 对话 → function calling → 画布 Op），前端执行

两种模式通过 Op 抽象层统一：编译式 Agent 的输出也转换为 `CanvasAgentOp[]`，由 `applyCanvasAgentOps` 应用到画布。

---

## 三、分阶段实施路径

### Phase 1：无限画布引擎统一（P0 最高优先级）

**目标**：用 infinite-canvas 的 CSS transform 引擎替换现有三套画布，实现统一无限画布。

**这是后续一切工作的基础——没有统一画布，Drama 节点和 Agent 操作都无从落地。**

#### 1.1 移植 infinite-canvas 核心引擎

**产出文件（新建）：**

| 目标文件 | 来源 | 说明 |
|---|---|---|
| `apps/web/src/components/infinite-canvas/InfiniteCanvas.tsx` | 改编自 `infinite-canvas/infinite-canvas.tsx` | 视口变换容器组件 |
| `apps/web/src/components/infinite-canvas/CanvasGrid.tsx` | 改编自 `infinite-canvas/infinite-canvas.tsx` 内部组件 | 网格背景 |
| `apps/web/src/components/infinite-canvas/CanvasNode.tsx` | 改编自 `infinite-canvas/canvas-node.tsx` | 节点渲染组件 |
| `apps/web/src/components/infinite-canvas/CanvasConnections.tsx` | 改编自 `infinite-canvas/canvas-connections.tsx` | SVG 贝塞尔连线 |
| `apps/web/src/components/infinite-canvas/CanvasMiniMap.tsx` | 改编自 `infinite-canvas/canvas-mini-map.tsx` | 小地图 |
| `apps/web/src/components/infinite-canvas/CanvasZoomControls.tsx` | 改编自 `infinite-canvas/canvas-zoom-controls.tsx` | 缩放控件 |
| `apps/web/src/components/infinite-canvas/types.ts` | 改编自 `infinite-canvas/types.ts` | 核心类型定义 |
| `apps/web/src/components/infinite-canvas/constants.ts` | 改编自 `infinite-canvas/constants.ts` | 节点默认尺寸 |
| `apps/web/src/components/infinite-canvas/utils.ts` | 改编自 `infinite-canvas/canvas-agent-ops.ts` | Op 抽象层 + 快照 |

**适配改动点：**
- 类型命名空间调整（`CanvasNodeType` 增加 Drama 类型占位，暂用 union string）
- 主题系统对接（`canvasThemes` → aimarket 的 theme 系统）
- 持久化适配（`localForage` → aimarket 现有的项目存储机制）
- 去除 antd 依赖（infinite-canvas 用了 antd Button/Modal，aimarket 用 shadcn/ui）

#### 1.2 改造 design-canvas.tsx

**改动文件：** `apps/web/src/components/design-canvas.tsx`

- 底层渲染从 `ScrollCanvas` / `FreeCanvas` 切换为 `InfiniteCanvas`
- 保留现有 `DesignCanvasProps` 接口的兼容性
- `alternateCanvasContent` 机制改为"画布内共存"—— Drama 组件作为画布节点渲染，不再替换整个画布
- 工具栏 / Lightbox / 右键菜单 / 撤销重做等上层能力保留
- 增加适配层：`CanvasItem` → `CanvasNodeData` 的双向转换

#### 1.3 改造 studio-canvas-with-orchestration.tsx

**改动文件：** `apps/web/src/components/studio-canvas-with-orchestration.tsx`

- 移除 `alternateCanvasContent` 替换逻辑
- `DramaStudioPanel` 从底部注入改为右侧面板（类似 infinite-canvas 的 `CanvasAssistantPanel` 布局）
- Drama 各组件（镜头时间线、制作进度、成片播放器）作为画布节点渲染在 `InfiniteCanvas` 内

#### 1.4 数据迁移

**改动文件：** 新建 `apps/web/src/components/infinite-canvas/migration.ts`

- `CanvasItem` → `CanvasNodeData` 映射
- `BatchSection` → Batch 图片组节点映射
- 向后兼容：旧项目打开时自动迁移

#### 1.5 验收标准

- [ ] 无限画布支持自由平移/缩放（0.05x-5x），以鼠标中心缩放
- [ ] 节点可拖拽/缩放/选中/多选
- [ ] 连线可创建/删除/选中
- [ ] 小地图和缩放控件正常工作
- [ ] 网格背景跟随视口变化
- [ ] 旧项目数据可无损迁移
- [ ] TypeScript 编译零错误
- [ ] 现有素材生成流程不受影响

---

### Phase 2：Drama 节点化（P1 高优先级）

**目标**：在无限画布上原生支持 Drama 专用节点，剧本/角色/场景/分镜作为节点共存。

**依赖：Phase 1 完成**

#### 2.1 扩展节点类型

**改动文件：**
- `apps/web/src/components/infinite-canvas/types.ts` — 增加 `script/shot/character/scene` 类型
- `apps/web/src/components/infinite-canvas/constants.ts` — 增加 Drama 节点默认尺寸
- `apps/web/src/components/infinite-canvas/CanvasNode.tsx` — 增加 Drama 节点内容渲染器

**Drama 节点渲染组件（新建）：**

| 新建文件 | 功能 |
|---|---|
| `apps/web/src/components/infinite-canvas/drama/ScriptNodeContent.tsx` | 脚本节点渲染：标题 + 梗概 + 三幕折叠 |
| `apps/web/src/components/infinite-canvas/drama/ShotNodeContent.tsx` | 分镜节点渲染：缩略图 + 对白 + 摄影参数角标 |
| `apps/web/src/components/infinite-canvas/drama/CharacterNodeContent.tsx` | 角色节点渲染：三视图 + promptAnchor |
| `apps/web/src/components/infinite-canvas/drama/SceneNodeContent.tsx` | 场景节点渲染：场景图 + 氛围标签 |

#### 2.2 Drama 规划 → 画布节点映射

**改动文件：**
- 新建 `apps/web/src/components/infinite-canvas/drama/drama-plan-to-nodes.ts`

核心逻辑：
```
DramaProjectData (5-Agent 规划输出)
  ↓ dramaPlanToCanvasOps()
CanvasAgentOp[]
  ↓ applyCanvasAgentOps()
画布节点快照更新
```

映射规则：
- `script` → `add_node(type="script")`
- `characters[]` → `add_node(type="character")` × N
- `scenes[]` → `add_node(type="scene")` × N
- `shots[]` → `add_node(type="shot")` × N + `connect_nodes(script→shot)` + `connect_nodes(character→shot)` + `connect_nodes(scene→shot)`
- 节点自动布局：script 在左，character/scene 在中，shot 在右，形成从左到右的数据流

#### 2.3 Drama 面板重构

**改动文件：**
- `apps/web/src/components/drama-studio-panel.tsx` — 从三栏面板重构为右侧属性面板
- `apps/web/src/components/studio-canvas-with-orchestration.tsx` — Drama 面板改为侧栏注入

选中 Drama 节点时，右侧面板展示该节点的详细编辑界面（角色三视图、分镜 prompt 编辑、场景参数等），取代当前的固定三栏布局。

#### 2.4 验收标准

- [ ] 脚本节点可展示标题/梗概/三幕，双击可编辑
- [ ] 角色节点可展示三视图，点击可生成/锁定
- [ ] 场景节点可展示场景图和氛围标签
- [ ] 分镜节点可展示缩略图/对白/摄影参数
- [ ] Drama 节点之间可通过连线锚点连接
- [ ] Drama 规划完成后自动在画布上创建节点和连线
- [ ] 选中 Drama 节点时右侧面板展示对应编辑界面
- [ ] TypeScript 编译零错误

---

### Phase 3：Agent 对话式操控（P1 高优先级）

**目标**：前端增加 function calling 循环，Agent 可通过对话直接操作画布节点。

**依赖：Phase 1 完成，Phase 2 可并行**

#### 3.1 移植 Agent Op 抽象层

**改动文件：**
- `apps/web/src/components/infinite-canvas/utils.ts` — 扩展 `CanvasAgentOp` 增加 Drama 专用 Op
- 新建 `apps/web/src/components/infinite-canvas/drama/drama-agent-ops.ts` — Drama 专用 Op 处理逻辑

`applyCanvasAgentOps` 纯函数扩展：
- `plan_drama` → 调用后端 `/drama/plan/runs` → 将输出转换为 `add_node` + `connect_nodes` ops
- `generate_character_sheet` → 调用后端三视图 API → `update_node` 更新角色节点
- `generate_shot_image` → 调用图片生成 API → `add_node(type="image")` + `connect_nodes(shot→image)`
- `generate_shot_video` → 调用视频生成 API → `add_node(type="video")` + `connect_nodes(image→video)`
- `run_drama_production` → 调用后端制作 API → 触发 SSE 事件流

#### 3.2 移植 Agent 对话面板

**新建文件：**

| 文件 | 来源 | 说明 |
|---|---|---|
| `apps/web/src/components/infinite-canvas/agent/CanvasAssistantPanel.tsx` | 改编自 `infinite-canvas/canvas-assistant-panel.tsx` | Agent 聊天 UI + function calling 循环 |
| `apps/web/src/components/infinite-canvas/agent/agent-tools.ts` | 改编自 `infinite-canvas/canvas-assistant-panel.tsx` 中的工具定义 | 22+9 个工具的 JSON Schema 定义 |
| `apps/web/src/components/infinite-canvas/agent/online-agent-loop.ts` | 提取自 `canvas-assistant-panel.tsx` | Online Agent function calling 循环核心逻辑 |

**Agent 循环流程：**
```
用户输入
  ↓
buildToolAgentMessages()（系统提示 + 画布快照 + 历史消息）
  ↓
requestToolResponse(tools, tool_choice="required")  ← 首轮强制工具调用
  ↓
toolCalls → onlineToolToOps() → CanvasAgentOp[]
  ↓
applyCanvasAgentOps() → 画布状态更新
  ↓
step >= MAX_STEPS(6)? → 终止；否则 → requestToolResponse(tool_choice="auto")
```

**关键参数：**
- `ONLINE_AGENT_MAX_STEPS = 6`（比 infinite-canvas 的 4 略多，因为 Drama 工作流更复杂）
- 首轮 `tool_choice="required"`，后续 `tool_choice="auto"`
- 支持工具确认模式（写操作需用户批准）

#### 3.3 对接 aimarket LLM 路由

**改动文件：**
- `apps/web/src/components/infinite-canvas/agent/online-agent-loop.ts`

infinite-canvas 直接调用 OpenAI API，aimarket 需要改为通过 `@aimarket/agent-core` 的 `completeWithFallback` 路由：
- `requestToolResponse` → 调用 aimarket 后端代理接口（`/api/agent/tool-response`）
- 后端执行 `completeWithFallback`（支持 deepseek/qwen/glm/openai/claude/agnes 多模型 fallback）
- 返回格式兼容 OpenAI Chat Completions（含 `tool_calls` 字段）

#### 3.4 编译式 Agent 输出 → Op 转换

**改动文件：**
- `apps/web/src/components/infinite-canvas/drama/drama-plan-to-nodes.ts`

现有后端 5-Agent 编译式规划的输出（`DramaProjectData`）也转换为 `CanvasAgentOp[]`：
- 前端通过 SSE 收到 `plan_complete` 事件后，调用 `dramaPlanToCanvasOps` 转换
- 统一由 `applyCanvasAgentOps` 应用到画布
- 这样编译式和对话式 Agent 在画布层面使用同一套 Op 抽象

#### 3.5 验收标准

- [ ] 用户可通过对话框让 Agent 在画布上创建/修改/删除节点
- [ ] Agent 可通过 `drama_plan` 工具一键生成完整 Drama 规划（画布上自动创建节点）
- [ ] Agent 可通过 `drama_generate_shot_image` 等工具为分镜节点生成内容
- [ ] 工具确认模式下写操作需用户批准后才执行
- [ ] 编译式规划（后端 5-Agent）和对话式操控（前端 function calling）使用同一套 Op 抽象
- [ ] Agent 对话面板可展开/收起，不遮挡画布主区
- [ ] TypeScript 编译零错误

---

### Phase 4：专业能力补齐（P2 中优先级）

**目标**：对标 LibTV 的专业工具和模板复用能力。

**依赖：Phase 2 完成**

#### 4.1 多机位分镜

**新建文件：**
- `apps/web/src/components/infinite-canvas/drama/MultiCamGrid.tsx` — 多机位宫格渲染
- `apps/api/src/providers/tools/multi-cam-9.ts` — 9 宫格后端 Provider
- `apps/api/src/providers/tools/multi-cam-25.ts` — 25 宫格后端 Provider

实现方式：
- 在 Shot 节点上增加「多机位」模式（9/25 宫格）
- 同一分镜生成多个 cameraSpec 变体的 Image 子节点
- 复用 infinite-canvas 的 `BatchFrame` 组件渲染宫格
- Agent 工具 `drama_multi_cam_9` / `drama_multi_cam_25`

#### 4.2 灯光/摄像机可视化控制

**新建文件：**
- `apps/web/src/components/infinite-canvas/drama/LightingOverlay.tsx` — 灯光编辑叠加层
- `apps/web/src/components/infinite-canvas/drama/CameraOverlay.tsx` — 摄像机控制叠加层

实现方式：
- 选中 Image/Shot 节点时，工具栏出现 `lighting` / `camera` 工具
- 灯光：叠加可拖拽光源点，参数面板（色温/强度/类型）
- 摄像机：俯仰/水平/景别三滑块
- 参数编码为 prompt 约束词，附加到生成请求

#### 4.3 工作流模板保存/复用

**新建文件：**
- `apps/web/src/components/infinite-canvas/TemplateManager.tsx` — 模板管理 UI
- `apps/api/src/routes/drama-templates.ts` — 模板 CRUD API

实现方式：
- 选中节点组 → "保存为模板" → 序列化节点类型/连线/参数为 JSON
- 模板列表 → 选择 → 替换素材 → 一键重跑
- 预置模板：「短剧标准流程」「MV 制作」「广告 TVC」

#### 4.4 视频精准编辑（video-inpaint）

**新建文件：**
- `apps/api/src/providers/tools/video-inpaint.ts` — 视频帧级编辑 Provider

实现方式（简化方案）：
- 用户在关键帧上绘制 mask + 编辑 prompt
- 关键帧 inpaint → i2v 生成编辑后视频

#### 4.5 AI 音乐生成

**新建文件：**
- `apps/api/src/providers/tools/music-gen.ts` — 音乐生成 Provider

对接 Suno/Udio API 或自建音乐模型，接入 MV Skill。

#### 4.6 验收标准

- [ ] 9 宫格工具可生成 9 张不同机位图片
- [ ] 25 宫格工具可生成 25 张连贯分镜
- [ ] 灯光控制可在图片上添加/移动光源，参数正确编码为 prompt
- [ ] 摄像机控制可调整俯仰/水平/景别，正确映射为运镜词
- [ ] 画布节点组合可保存为模板
- [ ] 已保存模板可一键重跑
- [ ] video-inpaint 可对视频关键帧进行局部编辑
- [ ] 音乐生成可产出 30-60 秒背景音乐
- [ ] TypeScript 编译零错误

---

## 四、优先级与排期建议

| 优先级 | Phase | 核心价值 | 依赖 | 预估工作量 |
|---|---|---|---|---|
| **P0** | Phase 1: 无限画布引擎统一 | 消除三套画布割裂，为后续一切奠基 | 无 | 大 |
| **P1** | Phase 2: Drama 节点化 | 可视化编排体验对标 LibTV | Phase 1 | 大 |
| **P1** | Phase 3: Agent 对话式操控 | 对标 LibTV Agent Skill 核心能力 | Phase 1 | 大 |
| **P2** | Phase 4: 专业能力补齐 | 差异化竞争力 | Phase 2 | 中 |

**Phase 2 和 Phase 3 可并行开发**，它们仅共同依赖 Phase 1。

### 推荐执行顺序

```
Phase 1（P0）
    ├── 1.1 移植核心引擎
    ├── 1.2 改造 design-canvas
    ├── 1.3 改造 orchestration
    ├── 1.4 数据迁移
    └── 1.5 验收
         │
         ├── Phase 2（P1，可先启动）
         │    ├── 2.1 扩展节点类型
         │    ├── 2.2 Drama 规划→节点映射
         │    ├── 2.3 Drama 面板重构
         │    └── 2.4 验收
         │
         └── Phase 3（P1，可并行启动）
              ├── 3.1 移植 Op 抽象层
              ├── 3.2 移植 Agent 对话面板
              ├── 3.3 对接 LLM 路由
              ├── 3.4 编译式→Op 转换
              └── 3.5 验收
                    │
                    └── Phase 4（P2）
                         ├── 4.1 多机位分镜
                         ├── 4.2 灯光/摄像机控制
                         ├── 4.3 模板保存/复用
                         ├── 4.4 视频精准编辑
                         ├── 4.5 AI 音乐生成
                         └── 4.6 验收
```

---

## 五、关键设计决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| 画布引擎 | CSS transform（infinite-canvas 方案） | 更轻量、更可控、无 React Flow 黑盒 |
| React Flow 去留 | 保留为辅助视图 | CanvasFlow 作为节点图只读展示仍有价值，但不再作为主画布 |
| Drama 面板位置 | 右侧侧栏 | 对标 LibTV / infinite-canvas 的布局，画布为主区 |
| Agent 模式 | 编译式 + 对话式并存 | 编译式用于批量规划，对话式用于交互修改 |
| Op 抽象层 | 直接复用 infinite-canvas 的 8 种 + 扩展 Drama 专用 | 纯函数、与 UI 解耦、天然支持 undo/redo |
| 持久化 | 适配 aimarket 现有项目存储 | 不引入 localForage，复用 aimarket 的 API 持久化 |
| 主题 | 对接 aimarket theme 系统 | 不引入 infinite-canvas 的 canvasThemes |
| UI 组件库 | aimarket 现有组件（shadcn/ui） | 不引入 antd |

---

## 六、风险与缓解

| 风险 | 影响 | 缓解策略 |
|---|---|---|
| infinite-canvas 代码与 aimarket 架构不兼容 | Phase 1 延期 | 先做 POC（最小画布原型），验证核心渲染可行后再全量移植 |
| 移除 `alternateCanvasContent` 机制影响现有 Drama 流程 | Drama 功能回退 | Phase 1 仅替换底层渲染，保留 `alternateCanvasContent` 兼容层，Phase 2 逐步迁移 |
| function calling 循环 token 消耗大 | 成本上升 | 限制 `MAX_STEPS=6`，工具确认模式减少无效操作，只读工具自动执行 |
| Drama 节点过多导致画布性能下降 | 用户体验差 | 虚拟化渲染（仅渲染视口内节点），节点折叠模式 |
| 后端 LLM 不支持 function calling | Agent 对话不可用 | 降级为文本模式（LLM 输出 JSON → 解析为 Op），或切换到支持 function calling 的模型 |

---

## 七、与现有 Spec 的关系

本 PRD 基于 `.trae/specs/close-libtv-gap/` 已有的 spec/tasks/checklist，但有以下关键差异：

1. **画布引擎选型变更**：原 spec Task 1 使用 React Flow，本 PRD 改为 infinite-canvas CSS transform 方案
2. **Drama 集成方式变更**：原 spec 无 Drama 节点化方案，本 PRD 新增 4 种 Drama 节点类型
3. **Agent 模式变更**：原 spec Task 10 仅设计后端 Agent Tool API，本 PRD 增加前端 function calling 循环
4. **实施路径更具体**：本 PRD 明确了从 infinite-canvas 复用的源文件和适配改动点

**建议**：完成本 PRD 评审后，更新 `.trae/specs/close-libtv-gap/` 的 spec/tasks/checklist 使其与本 PRD 对齐。
