# Infinite Canvas 集成 Spec

## Why
LibTV 已建立"无限画布 + 节点式工作流 + Agent Skill 开放生态"壁垒。AIMarket 现有三套割裂画布（ScrollCanvas / FreeCanvas / CanvasFlow），Drama 组件通过 `alternateCanvasContent` 替换式注入，前端无 Agent 对话循环。需借鉴 `/Users/4seven/workspace/infinite-canvas` 开源仓库，统一画布引擎，实现 Drama 节点化和 Agent 对话式操控。

PRD 文档：`/Users/4seven/workspace/aimarket/.trae/documents/infinite-canvas-integration-prd.md`

## What Changes

### Phase 1（P0）：无限画布引擎统一
- 从 infinite-canvas 仓库移植 CSS transform 画布引擎，替换现有 ScrollCanvas + FreeCanvas
- 改造 design-canvas.tsx 底层渲染为 InfiniteCanvas
- 改造 studio-canvas-with-orchestration.tsx 移除 alternateCanvasContent 替换逻辑
- 数据迁移：CanvasItem → CanvasNodeData 双向转换

### Phase 2（P1）：Drama 节点化
- 扩展节点类型：新增 script / shot / character / scene 四种 Drama 节点
- 实现 Drama 规划输出 → 画布节点映射（DramaProjectData → CanvasAgentOp[]）
- 重构 Drama 面板为右侧属性面板

### Phase 3（P1）：Agent 对话式操控
- 移植 Op 抽象层并扩展 Drama 专用 Op（8→13 种）
- 移植 Agent 对话面板，实现前端 function calling 循环
- 对接 aimarket LLM 路由（completeWithFallback 多模型 fallback）
- 统一编译式和对话式 Agent 的 Op 抽象

### Phase 4（P2）：专业能力补齐
- 多机位分镜（9/25 宫格）
- 灯光/摄像机可视化控制
- 工作流模板保存/复用
- 视频精准编辑（video-inpaint）
- AI 音乐生成

## Impact
- Affected code:
  - `apps/web/src/components/design-canvas.tsx` — 底层画布渲染替换
  - `apps/web/src/components/studio-canvas-with-orchestration.tsx` — Drama-Canvas 集成方式重构
  - `apps/web/src/components/free-canvas.tsx` — 被 InfiniteCanvas 替代
  - `apps/web/src/components/scroll-canvas.tsx` — 被 InfiniteCanvas 替代
  - `apps/web/src/components/drama-studio-panel.tsx` — 从三栏面板重构为右侧属性面板
  - `apps/web/src/lib/canvas-tools.ts` — CanvasItem → CanvasNodeData 适配
  - `apps/web/src/components/infinite-canvas/` — 新建目录，移植 infinite-canvas 核心代码
  - `apps/api/src/routes/drama.ts` — 新增模板 API
  - `packages/agent-core/src/llm/` — 新增 function calling 支持

## Requirements

### Requirement: 无限画布引擎
系统 SHALL 提供基于 CSS transform 的无限画布，支持自由平移/缩放（0.05x-5x），以鼠标中心缩放，支持节点拖拽/缩放/选中/多选，支持 SVG 贝塞尔连线创建/删除/选中。

#### Scenario: 画布平移缩放
- **WHEN** 用户在空白区域拖拽或使用鼠标滚轮
- **THEN** 画布视口相应平移或缩放，缩放以鼠标位置为中心

#### Scenario: 节点交互
- **WHEN** 用户在画布上拖拽节点
- **THEN** 节点位置实时更新，关联连线端点跟随移动

#### Scenario: 连线创建
- **WHEN** 用户从节点 A 的输出锚点拖拽到节点 B 的输入锚点
- **THEN** 建立一条贝塞尔曲线连线，表示数据流关系

### Requirement: Drama 节点类型
系统 SHALL 在无限画布上支持 script / shot / character / scene 四种 Drama 专用节点，各节点有独立的渲染组件和默认尺寸。

#### Scenario: 脚本节点
- **WHEN** Drama 规划完成后
- **THEN** 画布自动创建脚本节点，展示标题/梗概/三幕，双击可编辑

#### Scenario: 角色节点
- **WHEN** 用户选中角色节点
- **THEN** 右侧面板展示角色三视图编辑界面，可生成/锁定

#### Scenario: 分镜节点
- **WHEN** 用户选中分镜节点
- **THEN** 节点展示缩略图/对白/摄影参数，右侧面板展示 prompt 编辑界面

#### Scenario: 节点连线语义
- **WHEN** Drama 规划完成后自动创建连线
- **THEN** script→shot（脚本产出分镜）、character→shot（角色参与分镜）、scene→shot（场景对应分镜）

### Requirement: Agent 对话式操控
系统 SHALL 提供前端 function calling 循环，Agent 可通过对话直接操作画布节点，支持工具确认模式。

#### Scenario: Agent 创建节点
- **WHEN** 用户通过对话框要求 Agent 创建分镜
- **THEN** Agent 调用 `drama_create_shot` 工具，在画布上创建分镜节点

#### Scenario: Agent 一键规划
- **WHEN** 用户通过对话框输入创意
- **THEN** Agent 调用 `drama_plan` 工具，一键生成完整 Drama 规划并在画布上创建所有节点和连线

#### Scenario: 工具确认
- **WHEN** Agent 执行写操作且工具确认模式开启
- **THEN** 显示确认卡片，用户批准后才执行操作

#### Scenario: 编译式与对话式统一
- **WHEN** 后端 5-Agent 编译式规划完成
- **THEN** 输出通过 dramaPlanToCanvasOps 转换为 CanvasAgentOp[]，与对话式 Agent 使用同一套 Op 抽象

### Requirement: 多机位分镜
系统 SHALL 支持基于参考图批量生成 9/25 个不同机位画面，以宫格展示。

#### Scenario: 9 宫格生成
- **WHEN** 用户在分镜节点上选择多机位模式
- **THEN** 生成 9 个不同机位画面，以 3×3 宫格展示

### Requirement: 工作流模板保存/复用
系统 SHALL 支持画布节点组合序列化为模板，用户可一键重跑。

#### Scenario: 保存模板
- **WHEN** 用户选中节点组并点击"保存为模板"
- **THEN** 系统将节点类型/连线/参数序列化为模板资产

#### Scenario: 一键重跑
- **WHEN** 用户选择模板并替换素材后点击"重跑"
- **THEN** 系统按模板定义依次执行生成任务
