# 对标 LibTV 能力差距补齐 Spec

## Why
LibTV 作为竞品已建立"无限画布节点工作流 + 20+ 专业控制功能 + Agent Skill 开放生态"三位一体壁垒。AIMarket Studio 后端编排能力不弱，但交互范式落后、专业控制工具缺失、Agent 生态封闭，需要系统性补齐差距。

## What Changes

### P0：交互范式升级
- **节点式无限画布**：将当前线性画布升级为节点式无限画布，支持脚本/图片/视频/音频/脚本 5 种节点类型，支持自由拖拽、连线、分支、非线性编排
- **可视化灯光控制**：新增 `lighting` 工具，在图片上叠加可拖拽光源点，生成时将光源参数编码进 prompt 或 controlnet
- **可视化摄像机控制**：新增 `camera` 工具，拖拽调整俯仰/水平/景别，映射为 prompt 中的运镜描述词

### P1：专业控制工具补齐
- **多机位 9 宫格**：新增 `multi-cam-9` 工具，基于参考图批量生成 9 个不同机位画面，前端宫格展示
- **25 宫格连贯分镜**：新增 `multi-cam-25` 工具，将场景拆解为 25 个连贯镜头构图
- **剧情推演四宫格**：新增 `storyboard-evolve` 工具，给定关键帧推演前序/过程/后续画面
- **宫格切分器**：新增 `grid-split` 工具，将多宫格图一键切分为独立分镜
- **视频精准编辑**：新增 `video-inpaint` 工具 + Provider，支持视频帧级局部修改
- **AI 音乐生成**：集成音乐生成 API，接入 MV Skill

### P2：Agent 生态与工作流复用
- **Agent 操控画布节点 API**：设计画布节点 CRUD API，Agent 通过 Tool Call 直接操作画布节点
- **Skill 开放生态 SDK**：抽取 Skill SDK，支持第三方开发者编写 YAML 并注册到市场
- **工作流模板保存/复用**：画布节点组合序列化为模板，一键重跑
- **更多模型聚合**：接入 Kling 3.0、Seedance 2.0、Vidu、PixVerse 等

### P3：长尾专业功能
- **360 度角度呈现**：角色全方位 8 向视图生成
- **官网转产品片 Skill**：爬取 URL → LLM 提炼 → 自动编排
- **大师运镜预设**：10+ 经典运镜模板（推/拉/摇/跟/升/降）

## Impact
- Affected specs: Studio 画布交互范式、工具矩阵、Agent 编排、Skill 生态、模型路由
- Affected code:
  - `apps/web/src/components/studio-workspace.tsx` — 画布核心组件需重构
  - `apps/web/src/lib/canvas-tools.ts` — 画布工具集需扩展
  - `apps/api/src/lib/tools.ts` — 工具注册表需新增
  - `apps/api/src/providers/tools/` — 新增多个工具 Provider
  - `apps/api/src/lib/agent/` — Agent 需支持画布节点操作
  - `apps/api/src/routes/sessions.ts` — 画布 API 需扩展
  - `packages/agent-skills/` — Skill SDK 需重构

## ADDED Requirements

### Requirement: 节点式无限画布
系统 SHALL 提供节点式无限画布，支持脚本节点、图片节点、视频节点、音频节点、脚本节点五种基础类型，用户可自由拖拽、连线、分支编排，替代现有线性画布。

#### Scenario: 创建节点工作流
- **WHEN** 用户双击画布空白处
- **THEN** 弹出节点类型选择器（脚本/图片/视频/音频/脚本），选择后在画布创建对应节点

#### Scenario: 节点连线
- **WHEN** 用户从节点 A 的输出端口拖拽到节点 B 的输入端口
- **THEN** 建立数据流连线，节点 B 可消费节点 A 的输出

#### Scenario: 节点分支
- **WHEN** 用户从一个节点输出端口连线到多个节点
- **THEN** 支持一对多连线，形成分支工作流

### Requirement: 可视化灯光控制
系统 SHALL 提供 `lighting` 工具，允许用户在图片上叠加可拖拽光源点，设置光源位置/色温/强度，生成时编码进 prompt。

#### Scenario: 添加灯光
- **WHEN** 用户选中图片后点击 `lighting` 工具
- **THEN** 图片上叠加光源编辑层，用户可点击添加光源点，拖拽调整位置

#### Scenario: 设置光源参数
- **WHEN** 用户选中某个光源点
- **THEN** 弹出参数面板，可调整色温（暖白/冷白/暖黄）、强度（0-100%）、类型（点光/面光/聚光）

#### Scenario: 灯光参数传递
- **WHEN** 用户确认灯光设置并提交生成
- **THEN** 系统将光源位置/色温/强度编码为 prompt 约束词（如"左侧暖黄聚光，强度80%"），附加到生成 prompt

### Requirement: 可视化摄像机控制
系统 SHALL 提供 `camera` 工具，允许用户拖拽调整摄像机俯仰角/水平角/景别，映射为 prompt 中的运镜描述词。

#### Scenario: 调整摄像机
- **WHEN** 用户选中图片后点击 `camera` 工具
- **THEN** 图片上叠加摄像机控制 UI，包含俯仰/水平/景别三个可拖拽滑块

#### Scenario: 摄像机参数映射
- **WHEN** 用户调整摄像机参数后提交生成
- **THEN** 系统将摄像机参数映射为运镜描述词（如"低角度仰拍，广角远景"），附加到生成 prompt

### Requirement: 多机位宫格生成
系统 SHALL 提供 `multi-cam-9` 和 `multi-cam-25` 工具，基于参考图批量生成不同机位/连贯镜头画面。

#### Scenario: 9 宫格生成
- **WHEN** 用户选中参考图后点击 `multi-cam-9` 工具
- **THEN** 系统批量生成 9 个不同机位画面（俯拍/仰拍/左45°/右45°/正面/背面/近景/远景/特写），以 3×3 宫格展示

#### Scenario: 25 宫格连贯分镜
- **WHEN** 用户输入场景描述后点击 `multi-cam-25` 工具
- **THEN** 系统将场景拆解为 25 个连贯镜头，以 5×5 宫格展示，镜头间保持叙事连贯性

### Requirement: 剧情推演四宫格
系统 SHALL 提供 `storyboard-evolve` 工具，给定关键帧推演前序/过程/后续画面。

#### Scenario: 推演画面
- **WHEN** 用户选中关键帧后点击 `storyboard-evolve` 工具
- **THEN** 系统生成 2×2 宫格：左上"3秒前"、右上"当前帧"、左下"3秒后"、右下"5秒后"

### Requirement: 宫格切分器
系统 SHALL 提供 `grid-split` 工具，将多宫格图一键切分为独立分镜。

#### Scenario: 切分宫格图
- **WHEN** 用户选中 9/25 宫格图后点击 `grid-split` 工具
- **THEN** 系统自动检测网格线，将每个格子切分为独立图片，添加到画布

### Requirement: 视频精准编辑
系统 SHALL 提供 `video-inpaint` 工具，支持视频帧级局部修改。

#### Scenario: 视频局部编辑
- **WHEN** 用户选中视频后进入 `video-inpaint` 模式，在关键帧上绘制 mask 并输入编辑 prompt
- **THEN** 系统将编辑效果传播到相邻帧，输出修改后的完整视频

### Requirement: AI 音乐生成
系统 SHALL 集成音乐生成 API，支持根据风格描述生成背景音乐，并接入 MV Skill。

#### Scenario: 生成背景音乐
- **WHEN** 用户输入风格描述（如"轻快电子风，120BPM"）并提交
- **THEN** 系统调用音乐生成 API 生成 30-60 秒背景音乐

### Requirement: Agent 操控画布节点
系统 SHALL 提供画布节点 CRUD API，Agent 通过 Tool Call 直接操作画布节点。

#### Scenario: Agent 创建节点
- **WHEN** Agent 执行 plan 步骤需要创建图片节点
- **THEN** Agent 调用 `canvas_create_node` tool，在画布指定位置创建节点并关联生成结果

#### Scenario: Agent 连线节点
- **WHEN** Agent 需要建立节点间数据流
- **THEN** Agent 调用 `canvas_connect_nodes` tool，建立源节点输出到目标节点输入的连线

### Requirement: Skill 开放生态 SDK
系统 SHALL 抽取 Skill SDK，支持第三方开发者编写 YAML 并注册到市场。

#### Scenario: 第三方开发者创建 Skill
- **WHEN** 开发者按照 SDK 文档编写 skill.yaml 并提交到市场
- **THEN** 系统校验 YAML 格式和步骤合法性，通过后发布到 Skill 市场

### Requirement: 工作流模板保存/复用
系统 SHALL 支持画布节点组合序列化为模板，用户可一键重跑。

#### Scenario: 保存工作流为模板
- **WHEN** 用户在画布完成一组节点编排后点击"保存为模板"
- **THEN** 系统将节点类型/连线关系/参数配置序列化为模板资产

#### Scenario: 从模板一键重跑
- **WHEN** 用户选择模板并替换输入素材后点击"重跑"
- **THEN** 系统按模板定义的节点和连线依次执行生成任务

### Requirement: 更多模型聚合
系统 SHALL 接入 Kling 3.0、Seedance 2.0、Vidu、PixVerse 等主流视频生成模型。

#### Scenario: 切换视频模型
- **WHEN** 用户在视频车道选择模型下拉
- **THEN** 可选择 Kling 3.0 / Seedance 2.0 / Vidu / PixVerse / Wan 2.6 等模型

### Requirement: 360 度角度呈现
系统 SHALL 提供角色全方位 8 向视图生成能力。

#### Scenario: 生成 360 度视图
- **WHEN** 用户上传角色参考图后选择"360度呈现"
- **THEN** 系统生成 8 个方向（正/左前/左/左后/背/右后/右/右前）的角色视图

### Requirement: 官网转产品片 Skill
系统 SHALL 提供输入产品官网 URL 自动生成产品宣传视频的 Skill。

#### Scenario: URL 转产品片
- **WHEN** 用户输入产品官网 URL
- **THEN** 系统爬取页面内容、LLM 提炼卖点、设计展示节奏、生成宣传视频

### Requirement: 大师运镜预设
系统 SHALL 提供 10+ 经典运镜模板。

#### Scenario: 应用运镜预设
- **WHEN** 用户选中图片后选择运镜预设（如"推镜头"）
- **THEN** 系统将运镜参数映射到视频生成 prompt，生成对应运镜效果的视频
